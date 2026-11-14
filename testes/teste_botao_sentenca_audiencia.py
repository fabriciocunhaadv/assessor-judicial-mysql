"""Menu lateral: botão "Sentença da audiência" abre a Mesa já no Mutirão Expresso (o botão "Audiências" continua abrindo a Mesa normal). Rodar: /usr/bin/python3 testes/teste_botao_sentenca_audiencia.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_mesa.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/mesa.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(viewport={"width": 1600, "height": 900}); erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}'))
        pg.goto("http://127.0.0.1:5198/testes/gigantes/mesa.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=btn-sentenca-audiencia]")
        ok("Sentença da audiência" in pg.inner_text("[data-testid=btn-sentenca-audiencia]"), "o botão aparece no menu, mesmo para quem não é juiz nem super admin")
        ok("Mutirão" in (pg.get_attribute("[data-testid=btn-sentenca-audiencia]", "title") or ""), "a dica explica o que o botão faz")
        pg.click("[data-testid=btn-sentenca-audiencia]")
        pg.get_by_text("1. Autos").first.wait_for(timeout=15000)
        ok(pg.get_by_text("2. Mídia").count() >= 1 and pg.get_by_text("3. Sentença").count() >= 1, "abriu direto o Mutirão Expresso (passos Autos, Mídia e Sentença)")
        # fecha e abre pelo botão "Audiências": volta a Mesa normal? (o modo escolhido fica; só o novo botão força o Mutirão)
        pg.screenshot(path="/tmp/claude-0/work/teste/botao_sentenca.png")
        ok(not erros, f"sem erros na página {erros}")
        b.close()
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
