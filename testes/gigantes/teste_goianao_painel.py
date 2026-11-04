"""Painel do Goianão (grupo 21): cálculo ao digitar, números do Studio nas homologatórias, valores salvos no navegador."""
import glob, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5196
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_goi.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_goi.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/goianao.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1280, "height": 1500}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/goianao.html"); pg.wait_for_selector("[data-testid=goianao-total]", timeout=60000); pg.wait_for_timeout(600)
        T = lambda s: pg.inner_text(f"[data-testid={s}]")
        # Studio: 3 homologatórias de 7 julgamentos = 42,86% → 10 + floor(17,86/0,5)=35 → máx. 20
        assert T("goianao-hom-pontos").startswith("20"), T("goianao-hom-pontos")
        assert T("goianao-total").startswith("20"), T("goianao-total")
        pg.fill("[data-testid=in-meta1-novos]", "100"); pg.fill("[data-testid=in-meta1-julgados]", "95"); pg.fill("[data-testid=in-iad-novos]", "200"); pg.fill("[data-testid=in-iad-baixados]", "180")
        assert T("goianao-meta1-pontos").startswith("40") and T("goianao-iad-pontos").startswith("30"), (T("goianao-meta1-pontos"), T("goianao-iad-pontos"))
        pg.click("[data-testid=in-quadrante-1]"); pg.fill("[data-testid=in-peticao]", "9"); pg.click("[data-testid=in-reuniao1]")
        assert T("goianao-total").startswith("170"), T("goianao-total")      # 20 + 40 + 30 + 50 + 20 + 10
        print("total:", T("goianao-total").replace("\n", " "), "| faltam p/ Diamante:", T("goianao-falta-diamante"))
        pg.screenshot(path="/tmp/claude-0/work/goianao_painel.png", full_page=True)
        pg.reload(); pg.wait_for_selector("[data-testid=goianao-total]"); pg.wait_for_timeout(400)
        assert T("goianao-total").startswith("170"), "os valores digitados devem ficar salvos no navegador"
        pg.click("[data-testid=goianao-detalhes-botao]"); assert "Studio" in T("goianao-detalhes") and pg.locator("[data-testid=goianao-sem-classificacao]").count() == 1
        assert not erros, erros
        b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_goi.config.ts"))
