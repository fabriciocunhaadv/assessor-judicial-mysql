"""Central de fontes > Testes de acesso: botão 'Testar também pelo navegador' (extensão), coluna 'Seu navegador' preenchida pelos resultados da extensão e coluna 'Melhor caminho' (servidor, navegador ou envio manual)."""
import glob, json, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5197
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_fontes_nav.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_fontes_nav.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
SITES = [{"id": "stf", "grupo": "STF", "nome": "STF • Súmulas", "url": "https://portal.stf.jus.br/x"}, {"id": "tjgo", "grupo": "TJGO", "nome": "TJGO • Portal", "url": "https://www.tjgo.jus.br/"}, {"id": "plan", "grupo": "Planalto", "nome": "Planalto • CPC", "url": "https://www.planalto.gov.br/x.htm"}, {"id": "leis", "grupo": "Outras", "nome": "Leis municipais", "url": "https://leis.org/municipais"}]
SERVIDOR = [{**SITES[0], "status": 200, "bytes": 61000, "ms": 300, "amostra": "Supremo"}, {**SITES[1], "status": 403, "bytes": 5000, "ms": 40, "bloqueio": "BLOQUEADO: Cloudflare"}, {**SITES[2], "status": 200, "bytes": 1000, "ms": 80, "bloqueio": "BLOQUEADO: Acesso Negado"}, {**SITES[3], "status": 403, "bytes": 5000, "ms": 40, "bloqueio": "BLOQUEADO"}]
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        def nova(versao):
            pg = b.new_page(viewport={"width": 1300, "height": 1000}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
            pg.add_init_script(f"const __v = setInterval(() => {{ if (document.documentElement) {{ document.documentElement.dataset.assessorExtensao = '{versao}'; clearInterval(__v); }} }}, 5); window.addEventListener('projudi:leis-pedido', () => {{ window.__pedido = JSON.parse(document.documentElement.dataset.projudiLeisPedido); delete document.documentElement.dataset.projudiLeisPedido; }});")
            pg.route("**/api/fontes/sites-teste", lambda r, _q=None: r.fulfill(status=200, content_type="application/json", body=json.dumps({"sites": SITES})))
            pg.route("**/api/fontes/reconhecer", lambda r, _q=None: r.fulfill(status=200, content_type="application/json", body=json.dumps({"resultados": SERVIDOR})))
            pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html"); pg.get_by_text("Abrir central").first.click(); pg.get_by_test_id("menu-leis").click(); pg.wait_for_selector("text=Constituição Federal de 1988", timeout=60000)
            pg.get_by_test_id("menu-testes").click()
            return pg, erros
        pg, erros = nova("1.0.88"); assert pg.get_by_test_id("testar-pelo-navegador").is_disabled(), "extensão 1.0.88 não sabe testar"; pg.close()
        pg, erros = nova("1.0.89")
        assert not pg.get_by_test_id("testar-pelo-navegador").is_disabled()
        pg.get_by_role("button", name="Testar acesso aos sites oficiais").click(); pg.wait_for_selector("[data-testid=tabela-teste-acesso]")
        assert pg.get_by_test_id("caminho-stf").inner_text() == "servidor", "só com o teste do servidor: o que o servidor alcança já é o caminho"
        assert pg.get_by_test_id("caminho-tjgo").inner_text() == "…", "bloqueado no servidor e ainda não testado no navegador: aguardando"
        pg.get_by_test_id("testar-pelo-navegador").click(); pg.wait_for_function("window.__pedido"); ped = pg.evaluate("window.__pedido"); print("pedido:", ped["modo"], [l["id"] for l in ped["leis"]])
        assert ped["modo"] == "teste" and [l["id"] for l in ped["leis"]] == ["stf", "tjgo", "plan", "leis"]
        for r in ({"id": "stf", "status": 200, "bytes": 61000, "ms": 700}, {"id": "tjgo", "status": 200, "bytes": 90000, "ms": 900, "amostra": "Tribunal de Justiça"}, {"id": "plan", "status": 200, "bytes": 400000, "ms": 1200, "amostra": "Presidência"}, {"id": "leis", "status": 403, "bytes": 5000, "ms": 50, "bloqueio": "BLOQUEADO"}):
            pg.evaluate("(r) => { document.documentElement.dataset.projudiTesteEntrega = JSON.stringify({ pedidoId: 't', resultado: r }); window.dispatchEvent(new Event('projudi:teste-entrega')); }", r)
            pg.wait_for_function("!document.documentElement.dataset.projudiTesteEntrega", timeout=5000)
        pg.wait_for_selector("text=4 de 4 sites testados", timeout=5000)
        cam = {i: pg.get_by_test_id("caminho-" + i).inner_text() for i in ("stf", "tjgo", "plan", "leis")}; print(cam)
        assert cam == {"stf": "servidor", "tjgo": "navegador (extensão)", "plan": "navegador (extensão)", "leis": "envio manual"}, cam
        assert "200" in pg.get_by_test_id("nav-tjgo").inner_text() and "403" in pg.get_by_test_id("nav-leis").inner_text()
        pg.evaluate("() => { document.documentElement.dataset.projudiLeisFim = JSON.stringify({ modo: 'teste', feitas: 3, falhas: 1 }); window.dispatchEvent(new Event('projudi:leis-fim')); }")
        pg.wait_for_selector("[data-testid=progresso-teste-navegador]", state="detached", timeout=5000)
        assert not erros, erros; b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_fontes_nav.config.ts"))
