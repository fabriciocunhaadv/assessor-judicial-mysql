"""Assistente do dia (O que fazer hoje): fecha pelo X, clicando fora e com Esc; o botão do menu lateral fica marcado e, na 1ª vez que a pessoa fecha, aparece uma abinha ("é só me chamar aqui") que some ao clicar fora.
Rodar: /usr/bin/python3 testes/teste_assistente_fechar_e_abinha.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
URL = "http://127.0.0.1:5198/testes/gigantes/assistente_menu.html"
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_ab.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1
    print(("ok: " if c else "FALHOU: ") + m)
try:
    for _ in range(90):
        try: urllib.request.urlopen(URL, timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
        pg = b.new_page(viewport={"width": 1280, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.add_init_script("localStorage.setItem('assessor_tour_app_tour','1');"); pg.goto(URL); pg.wait_for_function("window.pronto")
        pg.wait_for_selector("[data-testid=assistente-overlay]", timeout=10000)
        ok("Bom dia" in pg.inner_text("[data-testid=assistente-titulo]") or "Boa" in pg.inner_text("[data-testid=assistente-titulo]"), f"saudação pelo horário: {pg.inner_text('[data-testid=assistente-titulo]')}")
        btn = pg.locator("[data-testid=btn-assistente-do-dia]")
        ok("border-indigo-500" in btn.get_attribute("class") and "bg-gradient-to-r" in btn.get_attribute("class"), "o botão 'O que fazer hoje?' do menu já fica marcado (destacado)")
        ok(pg.locator("[data-testid=assistente-abinha]").count() == 0, "enquanto a janela está aberta, não há abinha")
        # 1) dentro da janela, clicar não fecha
        pg.mouse.click(640, 150); pg.wait_for_timeout(200); ok(pg.locator("[data-testid=assistente-overlay]").count() == 1, "clicar DENTRO da janela não fecha")
        # 2) X fecha; 1ª vez: aparece a abinha ao lado do botão
        pg.click("[data-testid=assistente-fechar]"); pg.wait_for_selector("[data-testid=assistente-abinha]", timeout=4000)
        ok(pg.locator("[data-testid=assistente-overlay]").count() == 0, "o X fecha a janela")
        ab = pg.locator("[data-testid=assistente-abinha]"); cb = btn.bounding_box(); ba = ab.bounding_box()
        ok("Primeira vez por aqui?" in ab.inner_text() and "me chamar aqui" in ab.inner_text(), "a abinha diz: primeira vez, é só me chamar aqui")
        ok(ba["x"] >= cb["x"] + cb["width"] and abs((ba["y"] + ba["height"] / 2) - (cb["y"] + cb["height"] / 2)) < 12, f"a abinha fica ao lado do botão (botão {cb}, abinha {ba})")
        pg.screenshot(path="/tmp/claude-0/work/teste/assistente_abinha.png")
        # 3) clicar fora fecha a abinha; o botão continua marcado
        pg.mouse.click(900, 500); pg.wait_for_timeout(300)
        ok(pg.locator("[data-testid=assistente-abinha]").count() == 0, "clicar fora fecha a abinha")
        ok("border-indigo-500" in btn.get_attribute("class"), "o botão continua marcado")
        # 4) reabre pelo botão; clicar fora da janela fecha; a abinha NÃO volta (só na 1ª vez)
        btn.click(); pg.wait_for_selector("[data-testid=assistente-overlay]"); pg.mouse.click(8, 8); pg.wait_for_timeout(400)
        ok(pg.locator("[data-testid=assistente-overlay]").count() == 0, "clicar fora da janela (no fundo escuro) fecha")
        ok(pg.locator("[data-testid=assistente-abinha]").count() == 0, "a abinha só aparece na 1ª vez")
        # 5) Esc fecha
        btn.click(); pg.wait_for_selector("[data-testid=assistente-overlay]"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        ok(pg.locator("[data-testid=assistente-overlay]").count() == 0, "Esc fecha a janela")
        # 6) clicar no botão com a abinha aberta: fecha a abinha e abre a janela (outra pessoa/outro navegador vê a abinha de novo)
        pg.evaluate("() => localStorage.removeItem('assessor_assistente_dica_teste-uid')")
        btn.click(); pg.wait_for_selector("[data-testid=assistente-overlay]"); pg.click("[data-testid=assistente-fechar]"); pg.wait_for_selector("[data-testid=assistente-abinha]", timeout=4000)
        btn.click(); pg.wait_for_selector("[data-testid=assistente-overlay]"); ok(pg.locator("[data-testid=assistente-abinha]").count() == 0, "ao abrir de novo pelo botão, a abinha some")
        ok(not erros, f"sem erros de página: {erros[:2]}"); b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
