"""Painel de Gigantes: etiqueta com a serventia em que o processo foi cadastrado (a do envio, não a unidade atual). Rodar: /usr/bin/python3 testes/teste_gigante_etiqueta_serventia.py (vite na porta 5198)."""
import glob
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 900, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/gigantes_etiqueta.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=gigante-job]", timeout=15000)
    jobs = pg.locator("[data-testid=gigante-job]"); ok(jobs.count() == 2, f"dois processos na lista ({jobs.count()})")
    et = pg.locator("[data-testid=gigante-serventia]"); ok(et.count() == 1, "a etiqueta aparece só no processo que tem serventia gravada")
    ok("Palmeiras de Goiás / Vara Única" in et.first.inner_text() and "Montes Claros" not in et.first.inner_text(), f"mostra a serventia do ENVIO (não a unidade atual): {et.first.inner_text()}")
    ok("Cadastrado na serventia" in et.first.get_attribute("title"), "a dica explica o que é")
    pg.screenshot(path="/tmp/claude-0/work/teste/gigante_etiqueta.png")
    ok(not erros, f"sem erros de página: {erros[:2]}"); b.close()
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
