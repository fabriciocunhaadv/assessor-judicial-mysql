"""Barra de espera (tempo que vai diminuindo) no cartão de progresso e no painel de Gigantes. Rodar: /usr/bin/python3 testes/teste_barra_espera.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    # 1) o componente: o nível desce e o tempo diminui; no fim mostra "tentando de novo"
    pg = b.new_page(viewport={"width": 700, "height": 400}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.add_init_script("window.__t0 = Date.now();")
    pg.goto("http://127.0.0.1:5198/testes/gigantes/barra.html"); pg.wait_for_selector("[data-testid=barra-espera]")
    n = lambda: pg.evaluate("() => parseFloat(document.querySelector('[data-testid=barra-espera-nivel]').style.width)")
    t = lambda: pg.inner_text("[data-testid=barra-espera-tempo]")
    a, ta = n(), t(); pg.wait_for_timeout(3000); c, tc = n(), t()
    ok(a > c and a <= 100 and c > 0, f"a barra diminui: {a:.0f}% → {c:.0f}%")
    ok(ta != tc and ":" in ta, f"o tempo diminui: {ta} → {tc}")
    pg.screenshot(path="/tmp/claude-0/work/teste/barra_espera.png")
    pg.evaluate("() => { window.__x = 1; }"); pg.wait_for_function("() => document.querySelector('[data-testid=barra-espera]').innerText.includes('Tentando de novo')", timeout=30000)
    ok(True, "quando o tempo acaba, a barra avisa 'Tentando de novo agora…'")
    pg.close()
    # 2) no cartão de progresso: aparece quando o servidor informa a espera e some quando não informa
    pg = b.new_page(viewport={"width": 700, "height": 500}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    estado = {"espera": True}
    def prog(r):
        j = {"texto": "Etapa 1 — o Google está sobrecarregado: aguardando 45s por um modelo completo", "pct": 30, "teto": 55, "idadeSeg": 1}
        if estado["espera"]: j["espera"] = {"restanteSeg": 30, "totalSeg": 45}
        r.fulfill(status=200, content_type="application/json", body=json.dumps(j))
    pg.route("**/api/progresso/**", prog)
    pg.goto("http://127.0.0.1:5198/testes/gigantes/barra.html?modo=painel"); pg.wait_for_selector("[data-testid=barra-espera]", timeout=15000)
    ok("Esperando o Google liberar um modelo completo" in pg.inner_text("[data-testid=painel-progresso]"), "o cartão de progresso mostra a barra quando há espera")
    pg.screenshot(path="/tmp/claude-0/work/teste/barra_painel.png")
    estado["espera"] = False; pg.wait_for_function("() => !document.querySelector('[data-testid=barra-espera]')", timeout=15000); ok(True, "e ela some quando o servidor deixa de informar a espera")
    ok(not erros, f"sem erros de página: {erros[:2]}"); b.close()
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
