"""Linha do Tempo do processo: cada ato mostra de onde veio (Agaia, Studio, sentença com vídeo). Rodar: /usr/bin/python3 testes/teste_linha_do_tempo_origem.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_lt.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/linha.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(viewport={"width": 1100, "height": 900}); erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true}'))
        pg.goto("http://127.0.0.1:5198/testes/gigantes/linha.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=legenda-origem]")
        tipos = pg.eval_on_selector_all("[data-testid^=ato-origem-]", "els => els.map(e => e.dataset.testid.replace('ato-origem-',''))")
        rot = pg.eval_on_selector_all("[data-testid=etiqueta-origem]", "els => els.map(e => e.textContent)")
        print(tipos, rot)
        ok(tipos == ["agaia", "studio", "video"], "cada ato recebe a origem certa na ordem da linha do tempo")
        ok("Agaia" in rot[0] and "Studio" in rot[1] and "vídeo" in rot[2], "as etiquetas dizem Agaia, Studio e Sentença c/ vídeo")
        ok(pg.locator("[data-testid=legenda-origem]").count() == 1, "a legenda das cores aparece")
        pg.screenshot(path="/tmp/claude-0/work/teste/linha.png")
        ok(not erros, f"sem erros {erros}")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
