"""Aviso visível quando a minuta sai em contingência (modelo leve + expansão falhou). Rodar: /usr/bin/python3 testes/teste_aviso_profundidade.py (vite na porta 5198)."""
import glob
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 1500, "height": 1000}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true}'))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/minuta.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=barra-acoes-minuta]")
    ok(pg.locator("[data-testid=chip-profundidade]").count() == 0, "sem o aviso quando a minuta veio do modelo forte")
    pg.goto("http://127.0.0.1:5198/testes/gigantes/minuta.html?prof=1"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=chip-profundidade]", timeout=10000)
    pg.click("[data-testid=chip-profundidade]"); pg.wait_for_selector("[data-testid=aviso-profundidade]")
    t = pg.inner_text("[data-testid=aviso-profundidade]")
    ok("contingência" in t and "modelo mais leve" in t, "o aviso explica o que houve")
    pg.screenshot(path="/tmp/claude-0/work/teste/aviso_profundidade.png")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
