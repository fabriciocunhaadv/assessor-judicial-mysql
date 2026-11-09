"""Layout do painel Super Admin (menu lateral no computador, seletor no celular). Rodar: /usr/bin/python3 testes/teste_superadmin_layout.py"""
import glob, json, os, subprocess, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_sa.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/superadmin.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
            for nome, w, h in (("desktop", 1440, 900), ("notebook", 1100, 700), ("celular", 390, 800)):
                pg = b.new_page(viewport={"width": w, "height": h}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
                pg.route("**/api/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"motores": [], "gabinetes": [], "grupos": [], "decisoes": [], "iaExterna": [], "erros": [], "versoes": {"usuarios": [], "porVersao": [], "atual": ""}, "avisos": []})))
                pg.goto("http://127.0.0.1:5198/testes/gigantes/superadmin.html"); pg.wait_for_selector("text=Painel Super Admin", timeout=30000); pg.wait_for_timeout(800)
                sobra = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                assert not sobra, f"{nome}: rolagem lateral na página"
                if w >= 768:
                    n = pg.locator("[data-testid=abas-super-admin] button").count(); assert n == 12, n
                    for t in ("aba-central", "aba-calibragem", "aba-saude", "aba-gabinetes", "aba-usuarios", "aba-snapshots", "aba-comunicado", "aba-migracao", "aba-tokens", "aba-monitor-erros", "aba-monitor-operacao", "aba-utilizacao"):
                        assert pg.locator(f"[data-testid={t}]").is_visible(), f"{nome}: {t} escondido"
                    pg.click("[data-testid=aba-calibragem]"); pg.wait_for_selector("[data-testid=painel-calibragem]")
                    pg.click("[data-testid=aba-central]"); pg.wait_for_selector("[data-testid=painel-central]")
                    assert pg.locator("[data-testid=aba-central]").get_attribute("aria-current") == "page"
                else:
                    assert pg.locator("#seletor-aba-super option").count() == 12
                    pg.select_option("#seletor-aba-super", "calibragem"); pg.wait_for_selector("[data-testid=painel-calibragem]")
                    pg.select_option("#seletor-aba-super", "central"); pg.wait_for_selector("[data-testid=painel-central]")
                assert pg.locator("button:has-text('Modo de Atualização')").first.is_visible(), f"{nome}: botão Modo de Atualização escondido"
                pg.wait_for_timeout(500); pg.screenshot(path=f"/tmp/claude-0/work/teste/sa_{nome}.png"); pg.close()
            b.close()
        assert not erros, erros[:3]; print("OK layout do Super Admin")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
