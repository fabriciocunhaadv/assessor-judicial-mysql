"""Central de fontes: bloqueio do Planalto aparece em amarelo (com a cópia em uso), não como falha; 'Atualizar todas' fica desativado enquanto houver bloqueio; 'Com erro' conta só erro de verdade."""
import glob, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5195
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_fontes.config.ts"), "w").write(cfg)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_fontes.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
try:
    esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1200, "height": 900}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/fontes.html")
        pg.get_by_text("Abrir central").first.click()
        pg.wait_for_selector("text=Constituição Federal de 1988", timeout=60000)
        corpo = pg.inner_text("body")
        avisos = pg.locator("[data-testid=aviso-bloqueio-planalto]"); assert avisos.count() == 2, avisos.count()
        t0 = avisos.nth(0).inner_text(); t1 = avisos.nth(1).inner_text(); print(t0, "|", t1)
        assert "continua em uso" in t0 and "Reenvie" in t0 and "Envie o arquivo salvo" in t1
        assert "Falha: o Planalto bloqueou" not in corpo, "bloqueio não pode aparecer como Falha vermelha"
        assert "Falha: a página não tem artigos" in corpo, "erro de verdade continua como Falha"
        assert "Com erro (1)" in corpo, "só o erro de verdade conta"
        todas = pg.get_by_role("button", name="Atualizar todas pelo site (bloqueado pelo Planalto)"); assert todas.count() == 1 and todas.is_disabled()
        assert not pg.get_by_role("button", name="Atualizar pelo site").first.is_disabled(), "o botão de cada lei continua para testar de novo"
        assert not erros, erros
        b.close()
    print("OK")
finally:
    os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_fontes.config.ts"))
