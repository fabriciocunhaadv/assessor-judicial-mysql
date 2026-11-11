"""Central de fontes + extensão: o app pede as leis pendentes pelo atributo da página; as entregas da extensão (uma por vez) viram POST em importar-arquivo com o id da lei e os bytes originais; o fim limpa o andamento. Com extensão antiga, os botões ficam desativados."""
import base64, glob, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5196
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_fontes_ext.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_fontes_ext.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
HTML = "<html><body>Art. 1º Fica proibida a ação — ç</body></html>".encode("cp1252")      # byte 0xE7 (ç) tem de chegar intacto ao servidor
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        def nova(versao):
            pg = b.new_page(viewport={"width": 1200, "height": 900}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300])); posts = []
            pg.add_init_script(f"const __v = setInterval(() => {{ if (document.documentElement) {{ document.documentElement.dataset.assessorExtensao = '{versao}'; clearInterval(__v); }} }}, 5); window.addEventListener('projudi:leis-pedido', () => {{ window.__pedido = JSON.parse(document.documentElement.dataset.projudiLeisPedido); delete document.documentElement.dataset.projudiLeisPedido; }});")
            def rota(r, _q=None):
                req = r.request; posts.append((req.url, req.headers.get("x-nome-arquivo"), req.post_data_buffer))
                idl = req.url.split("id=")[1]
                r.fulfill(status=200, content_type="application/json", body='{"lei":{"id":"%s","nome":"Lei %s","url":"https://www.planalto.gov.br/ccivil_03/%s.htm","baixadoEm":1794000000000,"total":10,"revogados":0,"vetados":1}}' % (idl, idl, idl))
            pg.route("**/api/fontes/leis/importar-arquivo*", rota)
            pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html"); pg.get_by_text("Abrir central").first.click(); pg.get_by_test_id("menu-leis").click(); pg.wait_for_selector("text=Constituição Federal de 1988", timeout=60000)
            return pg, erros, posts
        # extensão antiga: botões desativados
        pg, erros, posts = nova("1.0.87")
        assert pg.get_by_test_id("buscar-pendentes-extensao").is_disabled() and pg.get_by_test_id("buscar-todas-extensao").is_disabled(); pg.close()
        # extensão nova
        pg, erros, posts = nova("1.0.88")
        bt = pg.get_by_test_id("buscar-pendentes-extensao"); assert not bt.is_disabled(), "extensão 1.0.88 libera o botão"; print(bt.inner_text())
        bt.click(); pg.wait_for_function("window.__pedido"); ped = pg.evaluate("window.__pedido"); print("pedido:", [(l["id"], l["url"][-12:]) for l in ped["leis"]])
        assert [l["id"] for l in ped["leis"]] == ["l1", "l2"], "só as pendentes"
        assert pg.get_by_test_id("progresso-extensao").count() == 1
        b64 = base64.b64encode(HTML).decode()
        for lid in ("l1", "l2"):      # a extensão entrega uma de cada vez e só entrega a próxima quando o app limpa o atributo
            pg.evaluate("([id, b64, ped]) => { document.documentElement.dataset.projudiLeiEntrega = JSON.stringify({ pedidoId: ped, id, nome: id + '.htm', b64 }); window.dispatchEvent(new Event('projudi:lei-entrega')); }", [lid, b64, ped["pedidoId"]])
            pg.wait_for_function("!document.documentElement.dataset.projudiLeiEntrega", timeout=5000)
        pg.wait_for_function("window.__n === undefined", timeout=1000)
        pg.wait_for_selector("text=Lei l2: 10 artigos", timeout=10000)
        assert len(posts) == 2, posts; assert posts[0][0].endswith("?id=l1") and posts[1][0].endswith("?id=l2")
        assert posts[0][2] == HTML, "os bytes (windows-1252) chegam sem alteração"; assert posts[0][1] == "l1.htm"
        assert "(pela extensão)" in pg.inner_text("body")
        pg.evaluate("() => { document.documentElement.dataset.projudiLeisFim = JSON.stringify({ feitas: 2, falhas: 0, bloqueios: 0 }); window.dispatchEvent(new Event('projudi:leis-fim')); }")
        pg.wait_for_selector("[data-testid=progresso-extensao]", state="detached", timeout=5000)
        # fim com bloqueio mostra o aviso
        pg.evaluate("() => { document.documentElement.dataset.projudiLeisFim = JSON.stringify({ feitas: 1, falhas: 1, bloqueios: 1 }); window.dispatchEvent(new Event('projudi:leis-fim')); }")
        pg.wait_for_selector("text=bloqueou 1 página", timeout=5000)
        assert not erros, erros; pg.close(); b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_fontes_ext.config.ts"))
