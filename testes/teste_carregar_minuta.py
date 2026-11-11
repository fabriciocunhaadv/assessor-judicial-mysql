"""Carregar uma minuta (resultado sai de 'nenhum' para 'minuta') não pode dar erro React #310; o botão Adaptar a paradigma aparece e abre a janela. Rodar: /usr/bin/python3 testes/teste_carregar_minuta.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_vt.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/viewer_troca.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(); erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}'))
        pg.goto("http://127.0.0.1:5198/testes/gigantes/viewer_troca.html"); pg.wait_for_function("window.pronto")
        pg.click("#carregar")
        pg.wait_for_selector("[data-testid=btn-adaptar-paradigma]", timeout=15000)
        ok(not erros, f"carregar a minuta não gera erro de renderização {erros}")
        pg.click("[data-testid=btn-adaptar-paradigma]"); pg.wait_for_selector("[data-testid=adaptar-paradigma]")
        ok(not erros, f"abrir a janela também não {erros}")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
