"""Menu lateral: em telas de notebook (menu recolhido) os ícones têm de aparecer inteiros (antes ficavam espremidos até sumir). Rodar: /usr/bin/python3 testes/teste_sidebar_icones.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
URL = "http://127.0.0.1:5198/testes/gigantes/sidebar_icones.html"
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_sb.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
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
        for largura, recolhido in ((1280, True), (1366, True), (1536, False), (1920, False)):
            pg = b.new_page(viewport={"width": largura, "height": 800}, device_scale_factor=1.5); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            pg.add_init_script("localStorage.removeItem('sidebar_collapsed');"); pg.goto(URL); pg.wait_for_function("window.pronto"); pg.wait_for_timeout(500)
            lado = pg.locator("#sidebar-principal").bounding_box(); ok((lado["width"] <= 70) == recolhido, f"{largura}px: menu {'recolhido' if recolhido else 'aberto'} (largura {lado['width']:.0f})")
            ic = pg.evaluate("""() => [...document.querySelectorAll('[data-testid=sidebar-conteudo] button svg')].map((s) => { const r = s.getBoundingClientRect(); const b = s.closest('button').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(b.width), Math.round(r.left - b.left), Math.round(b.right - r.right)]; })""")
            ok(len(ic) >= 8, f"{largura}px: {len(ic)} botões com ícone")
            ok(all(w >= 14 and h >= 14 for w, h, *_ in ic), f"{largura}px: todos os ícones com tamanho inteiro (≥14px): menor = {min((w for w, *_ in ic), default=0)}px")
            if recolhido:
                ruim = [x for x in ic if not (abs(x[3] - x[4]) <= 5 and x[2] >= 40)]
                ok(not ruim, f"{largura}px: ícones centralizados em botões de ≥40px (fora do padrão: {ruim[:4]})")
            pg.screenshot(path=f"/tmp/claude-0/work/teste/sidebar_{largura}.png", clip={"x": 0, "y": 0, "width": 340, "height": 800}); pg.close()
        ok(not erros, f"sem erros de página: {erros[:2]}"); b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
