"""Tela 'Adaptar a paradigma': modelo sugerido já marcado, resultado lado a lado, avisos e aceitar/descartar. Rodar: /usr/bin/python3 testes/teste_adaptar_paradigma.py"""
import glob, json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_ad.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/adaptar.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(); erros = []; corpos = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        def api(rota):
            if "/api/reestruturar-minuta" in rota.request.url:
                corpos.append(json.loads(rota.request.post_data or "{}"))
                rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "minute": {"title": "SENTENÇA", "relatorio": "Relatório no modelo.", "fundamentacao": "Fundamentação no modelo.", "dispositivo": "Dispositivo no modelo.", "closing": "Intimem-se.", "fullFormattedText": "TEXTO COMPLETO NO MODELO"}, "avisos": ["Valores da minuta original que não aparecem na reorganizada: R$5.000,00."]}))
            else: rota.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}')
        pg.route("**/api/**", api)
        pg.goto("http://127.0.0.1:5198/testes/gigantes/adaptar.html"); pg.wait_for_function("window.pronto")
        pg.wait_for_selector("[data-testid=adaptar-paradigma]")
        sel = pg.eval_on_selector("[data-testid=adaptar-select]", "e => ({v: e.value, n: e.options.length, t: e.selectedOptions[0]?.textContent})")
        print("select:", sel)
        ok(sel["n"] > 2, "lista os modelos cadastrados")
        ok(sel["v"] != "" and "Sugerido" in (sel["t"] or ""), "o modelo sugerido já vem marcado")
        pg.click("[data-testid=adaptar-rodar]"); pg.wait_for_selector("[data-testid=adaptar-resultado]")
        ok(len(corpos) == 1 and corpos[0]["paradigmText"] and corpos[0]["minute"]["relatorio"].startswith("Ação declaratória"), "envia a minuta e o texto do modelo escolhido (sem reler os autos)")
        ok("TEXTO COMPLETO NO MODELO" in pg.inner_text("[data-testid=adaptar-depois]"), "mostra o depois ao lado do antes")
        ok("R$5.000,00" in pg.inner_text("[data-testid=adaptar-resultado]"), "mostra os avisos de conferência")
        pg.click("[data-testid=adaptar-aceitar]")
        ap = pg.evaluate("window.aplicado")
        ok(ap and ap["n"]["fullFormattedText"] == "TEXTO COMPLETO NO MODELO" and ap["n"]["processNumber"] == "5656408-27.2026.8.09.0166" and ap["t"], "aceitar devolve a minuta nova mantendo o número do processo e o título do modelo")
        ok(pg.locator("[data-testid=adaptar-paradigma]").count() == 0, "a janela fecha ao aceitar")
        ok(not erros, f"sem erros na página {erros}")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
