"""Aviso de vencimento do Histórico: o toast tem o botão "Ver essas minutas no Histórico" e o aviso FIXO (1 dia) aparece com o botão "Ver no Histórico"; sem minutas vencendo, o aviso não aparece."""
import glob, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5197
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_venc.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_venc.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/venc.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1000, "height": 600}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/venc.html"); pg.wait_for_selector("[data-testid=aviso-vencimento-fixo]", timeout=60000)
        t = pg.inner_text("[data-testid=aviso-vencimento-fixo]"); print("aviso fixo:", t.replace("\n", " | ")); assert "1 minuta" in t and "Ver no Histórico" in t
        r = pg.evaluate("(() => { const e = document.querySelector('[data-testid=aviso-vencimento-fixo]').getBoundingClientRect(); return [e.left, innerHeight - e.bottom]; })()"); print("posição (esq, base):", r); assert r[0] < 30 and r[1] >= 8, r      # acima do botão Cadastros (que ocupa ~48px da base)
        pg.wait_for_selector("[data-testid=toast-ver-vencendo]", timeout=10000)
        pg.click("[data-testid=toast-ver-vencendo]"); pg.wait_for_timeout(300)
        pg.click("[data-testid=aviso-vencimento-ver]"); pg.wait_for_timeout(300)
        c = pg.evaluate("window.__cliques"); print("cliques registrados (toast=1, aviso fixo=10):", c); assert c == 11, c
        assert not erros, erros
        b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_venc.config.ts"))
