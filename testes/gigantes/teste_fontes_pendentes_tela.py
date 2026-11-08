"""Central de fontes > Fontes pendentes: lista (só pendentes por padrão), badge com a contagem, busca pela extensão (só leis), entregas da extensão (sucesso grava, falha registra), CRUD e editor de sites de busca. Extensão antiga: botões desativados."""
import base64, glob, json, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5199
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_fontes_pend.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_fontes_pend.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
def item(i, rotulo, tipo, esfera, ente="", numero="", ano=0, orgao="", status="pendente", oc=3, motores=None):
    return {"id": i, "chave": i, "tipo": tipo, "esfera": esfera, "ente": ente, "numero": numero, "ano": ano, "orgao": orgao, "rotulo": rotulo, "status": status, "ocorrencias": oc, "motores": motores or {"normal": 2, "turbo": 1}, "primeira": 1794000000000, "ultima": 1794100000000, "tentativas": []}
ITENS = [item("mun", "Lei Municipal 1234/2015 (Montes Claros de Goiás)", "lei", "municipal", "Montes Claros de Goiás", "1234", 2015), item("est", "Lei Estadual 21792/2023", "lei", "estadual", "Goiás", "21792", 2023, motores={"lupa": 1}),
         item("sum", "Súmula 999 do STJ", "súmula", "federal", "", "999", 0, "STJ"), item("trat", "Convenção sobre os Direitos da Criança", "tratado", "federal"), item("inc", "Lei Estadual 1/2000", "lei", "estadual", "Goiás", "1", 2000, status="incluida"), item("ign", "Lei Municipal 9/1999", "lei", "municipal", "X", "9", 1999, status="ignorada")]
SITES = [{"id": "m", "nome": "Câmara", "esfera": "municipal", "ente": "Montes Claros de Goiás", "url": "https://acessoainformacao.montesclarosdegoias.go.leg.br/cidadao/legislacao/leis", "ativa": True}, {"id": "off", "nome": "Desligado", "esfera": "estadual", "ente": "Goiás", "url": "https://leisestaduais.com.br/go", "ativa": False}]
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        def nova(versao):
            pg = b.new_page(viewport={"width": 1300, "height": 1000}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300])); chamadas = []; estado = {"itens": json.loads(json.dumps(ITENS))}
            pg.add_init_script(f"const __v = setInterval(() => {{ if (document.documentElement) {{ document.documentElement.dataset.assessorExtensao = '{versao}'; clearInterval(__v); }} }}, 5); window.addEventListener('projudi:leis-pedido', () => {{ window.__pedido = JSON.parse(document.documentElement.dataset.projudiLeisPedido); delete document.documentElement.dataset.projudiLeisPedido; }});")
            def rota(r, _q=None):
                req = r.request; path = req.url.split("/api/fontes/pendentes")[1].split("?")[0]; m = req.method; corpo = req.post_data_buffer; chamadas.append((m, path, corpo))
                def ok(o, status=200): r.fulfill(status=status, content_type="application/json", body=json.dumps(o))
                if m == "GET": return ok({"itens": estado["itens"], "fontesBusca": SITES, "hostsPermitidos": ["leisestaduais.com.br", "acessoainformacao.montesclarosdegoias.go.leg.br"]})
                if m == "POST" and path == "": novo = item("novo", "Lei Municipal 500/2010 (Montes Claros de Goiás)", "lei", "municipal", "Montes Claros de Goiás", "500", 2010, oc=0, motores={}); estado["itens"].insert(0, novo); return ok({"item": novo})
                if m == "PUT" and path == "/config-busca": return ok({"fontesBusca": json.loads(corpo)["fontes"]})
                iid = path.strip("/").split("/")[0]; it = next((x for x in estado["itens"] if x["id"] == iid), None)
                if m == "POST" and path.endswith("/incluir"):
                    if iid == "est": return ok({"erro": "não reconheci nenhum artigo no arquivo", "item": it}, 400)
                    it["status"] = "incluida"; return ok({"item": it, "lei": {"artigos": 6}})
                if m == "PUT": d = json.loads(corpo); it.update({k: v for k, v in d.items() if k in ("status", "link", "nota", "esfera", "ente", "rotulo")}); 
                if m == "PUT" and d.get("tentativa"): it["tentativas"].append({"em": 1, "via": d["tentativa"]["via"], "resultado": d["tentativa"]["resultado"]})
                if m == "DELETE": estado["itens"] = [x for x in estado["itens"] if x["id"] != iid]; return ok({"ok": True})
                return ok({"item": it})
            pg.route("**/api/fontes/pendentes**", rota)
            pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html"); pg.get_by_text("Abrir central").first.click(); pg.wait_for_selector("text=Constituição Federal de 1988", timeout=60000)
            return pg, erros, chamadas, estado
        pg, erros, ch, est = nova("1.0.89"); pg.get_by_role("button", name="Fontes pendentes (4)", exact=True).click(); pg.wait_for_selector("[data-testid=aba-fontes-pendentes]")
        assert pg.get_by_test_id("buscar-todas-pendentes").is_disabled() and pg.get_by_test_id("buscar-mun").is_disabled(), "extensão antiga: busca desativada"; pg.close()
        pg, erros, ch, est = nova("1.0.90")
        assert "Fontes pendentes (4)" in pg.inner_text("body"), "badge com a contagem de pendentes (mun, est, súmula, tratado)"
        pg.get_by_role("button", name="Fontes pendentes (4)").click(); pg.wait_for_selector("[data-testid=aba-fontes-pendentes]")
        corpo = pg.inner_text("[data-testid=aba-fontes-pendentes]"); assert "Lei Municipal 1234/2015" in corpo and "Súmula 999 do STJ" in corpo and "Lei Estadual 1/2000" not in corpo and "Lei Municipal 9/1999" not in corpo, "só pendentes por padrão"
        assert pg.get_by_test_id("buscar-sum").count() == 0 and pg.get_by_test_id("buscar-trat").count() == 0, "súmula e tratado não têm busca automática"
        assert not pg.get_by_test_id("buscar-todas-pendentes").is_disabled() and "(2)" in pg.get_by_test_id("buscar-todas-pendentes").inner_text(), "2 leis buscáveis"
        pg.get_by_test_id("buscar-todas-pendentes").click(); pg.wait_for_function("window.__pedido"); ped = pg.evaluate("window.__pedido")
        print("pedido:", ped["modo"], [l["id"] for l in ped["leis"]], [s["id"] for s in ped["fontesBusca"]])
        assert ped["modo"] == "fonte" and [l["id"] for l in ped["leis"]] == ["mun", "est"] and [s["id"] for s in ped["fontesBusca"]] == ["m"], "só leis pendentes; só sites ativos"
        assert ped["leis"][0]["numero"] == "1234" and ped["leis"][0]["ente"] == "Montes Claros de Goiás"
        assert pg.get_by_test_id("progresso-fontes").count() == 1
        pdf = base64.b64encode(b"<html><body>Art. 1o x</body></html>").decode()
        for e in ({"id": "mun", "nome": "815.htm", "b64": pdf, "contentType": "text/html", "url": "https://x/815"}, {"id": "est", "erro": "não encontrei o texto da lei nos sites consultados", "tentativas": ["https://leisestaduais.com.br/go → HTTP 404"]}):
            pg.evaluate("(e) => { document.documentElement.dataset.projudiFonteEntrega = JSON.stringify({ pedidoId: 'p', ...e }); window.dispatchEvent(new Event('projudi:fonte-entrega')); }", e)
            pg.wait_for_function("!document.documentElement.dataset.projudiFonteEntrega", timeout=5000)
        pg.wait_for_selector("[data-testid=msg-mun]:has-text('Incluída em')", timeout=8000); pg.wait_for_selector("[data-testid=msg-est]:has-text('não encontrei')", timeout=8000)
        inc = [c for c in ch if c[1].endswith("/incluir")]; assert len(inc) == 1 and inc[0][1].startswith("/mun/"), "só a entrega com arquivo vira inclusão"; assert any(c[0] == "PUT" and c[1] == "/est" for c in ch), "falha registrada como tentativa"
        pg.evaluate("() => { document.documentElement.dataset.projudiLeisFim = JSON.stringify({ modo: 'fonte', feitas: 1, falhas: 1 }); window.dispatchEvent(new Event('projudi:leis-fim')); }")
        pg.wait_for_selector("[data-testid=progresso-fontes]", state="detached", timeout=5000)
        # CRUD
        pg.get_by_test_id("adicionar-fonte").click(); pg.get_by_test_id("form-nova-fonte").get_by_label("Número").fill("500"); pg.get_by_test_id("form-nova-fonte").get_by_role("button", name="Adicionar").click(); pg.wait_for_selector("text=Lei Municipal 500/2010")
        pg.get_by_test_id("pendente-sum").get_by_role("button", name="Ignorar").click(); pg.wait_for_selector("[data-testid=pendente-sum]", state="detached", timeout=5000)
        pg.get_by_role("button", name="Ignoradas (2)").click(); pg.wait_for_selector("[data-testid=pendente-sum]")
        pg.once("dialog", lambda d: d.accept()); pg.get_by_test_id("pendente-ign").get_by_role("button", name="Excluir").click(); pg.wait_for_selector("[data-testid=pendente-ign]", state="detached", timeout=5000)
        pg.get_by_test_id("editar-sites").click(); assert pg.get_by_test_id("editor-sites").count() == 1; pg.get_by_test_id("editor-sites").get_by_role("button", name="Salvar").click(); pg.wait_for_selector("[data-testid=editor-sites]", state="detached", timeout=5000)
        assert any(c[0] == "PUT" and c[1] == "/config-busca" for c in ch)
        assert not erros, erros; b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_fontes_pend.config.ts"))
