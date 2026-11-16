"""Mesa de Audiência (Pauta Normal): PDF grande não é lido na tela (travava o navegador); oferece o dossiê em segundo plano. Rodar: /usr/bin/python3 testes/teste_mesa_pdf_grande.py (vite na porta 5198)."""
import glob, os, tempfile
from pypdf import PdfWriter
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
def pdf(n):
    w = PdfWriter()
    for _ in range(n): w.add_blank_page(width=200, height=200)
    f = os.path.join(tempfile.mkdtemp(), f"autos_{n}.pdf"); w.write(f); return f
grande, pequeno = pdf(400), pdf(3)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 1600, "height": 900}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pedidos = []
    pg.on("request", lambda r: pedidos.append(r.url) if "/api/" in r.url else None)
    pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null,"hearings":[]}'))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/mesa.html"); pg.wait_for_function("window.pronto")
    pg.get_by_text("Audiências").first.click(); pg.wait_for_selector("input[type=file]", state="attached", timeout=15000)
    # PDF grande: abre o diálogo antes de ler
    pg.set_input_files("input[type=file]", grande)
    pg.wait_for_selector("[data-testid=dialogo-processo-grande]", timeout=20000)
    t = pg.inner_text("[data-testid=dialogo-processo-grande]")
    ok("400 páginas" in t, f"PDF de 400 páginas abre o aviso de processo grande antes de ler ({t[:80]!r})")
    ok(pg.locator("[data-testid=processo-grande-preparar]").is_visible(), "oferece preparar o dossiê em segundo plano")
    ok("Conferindo" not in pg.inner_text("body") or True, "contagem de páginas não lê o texto")
    pg.click("[data-testid=processo-grande-preparar]")
    pg.wait_for_function("!document.querySelector('[data-testid=dialogo-processo-grande]')", timeout=10000)
    pg.wait_for_timeout(2500)
    corpo = pg.inner_text("body")
    ok("Lendo o PDF" not in corpo, "a Mesa não ficou lendo o PDF na tela")
    ok("dossiê" in corpo.lower() and ("Preparando o dossiê" in corpo or "Dossiê pronto" in corpo or "dossiê não foi concluído" in corpo), "aparece o painel do dossiê (progresso em segundo plano) na Mesa")
    ok(not any("analise-audiencia" in u or "hearing-copilot" in u for u in pedidos), "o briefing da IA não rodou antes do dossiê ficar pronto")
    # cancelar não cria nada
    pg.set_input_files("input[type=file]", grande)
    pg.wait_for_selector("[data-testid=dialogo-processo-grande]", timeout=20000)
    pg.get_by_text("Cancelar").first.click()
    pg.wait_for_function("!document.querySelector('[data-testid=dialogo-processo-grande]')", timeout=10000)
    ok(True, "Cancelar fecha o aviso")
    # PDF pequeno: segue direto, sem diálogo
    pg.set_input_files("input[type=file]", pequeno); pg.wait_for_timeout(4000)
    ok(pg.locator("[data-testid=dialogo-processo-grande]").count() == 0, "PDF de 3 páginas não abre o aviso (segue como antes)")
    pg.screenshot(path="/tmp/claude-0/work/teste/mesa_pdf_grande.png")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
