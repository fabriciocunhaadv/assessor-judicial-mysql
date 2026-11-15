"""Layout da minuta: barra de ações em grupos e avisos num dock flutuante na lateral direita. Rodar: /usr/bin/python3 testes/teste_layout_minuta.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_lm.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
def sobrepoe(a, b): return not (a["x"] + a["width"] <= b["x"] + 0.5 or b["x"] + b["width"] <= a["x"] + 0.5 or a["y"] + a["height"] <= b["y"] + 0.5 or b["y"] + b["height"] <= a["y"] + 0.5)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/minuta.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
        for nome, w, h in [("desktop", 1600, 900), ("celular", 390, 800)]:
            pg = b.new_page(viewport={"width": w, "height": h}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}'))
            pg.goto("http://127.0.0.1:5198/testes/gigantes/minuta.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=barra-acoes-minuta]")
            # ---- barra de ações
            grupos = pg.eval_on_selector_all("[data-testid=barra-acoes-minuta] [role=group]", "els => els.map(e => e.getAttribute('aria-label'))")
            ok(grupos == ["Ato", "Modelos", "Exportar", "Tela"], f"{nome}: botões em quatro grupos {grupos}")
            caixas = pg.eval_on_selector_all("[data-testid=barra-acoes-minuta] button", "els => els.map(e => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim(), x: r.x, y: r.y, width: r.width, height: r.height }; })")
            textos = [c["t"] for c in caixas]
            for esperado in ["Marcar lançado", "Editar", "Aplicar modelo / paradigma", "Conferir modelos do Projudi", "Salvar Tese", "Copiar", "Gerar PDF", "DOCX", "Raio-X", "Expandir Minuta", "Excluir"]:
                ok(any(esperado in t for t in textos), f"{nome}: botão '{esperado}' continua na barra")
            sobre = [(a["t"], c["t"]) for i, a in enumerate(caixas) for c in caixas[i + 1:] if sobrepoe(a, c)]
            ok(not sobre, f"{nome}: nenhum botão por cima de outro {sobre[:2]}")
            alturas = {round(c["height"]) for c in caixas}
            ok(len(alturas) == 1, f"{nome}: todos os botões têm a mesma altura {alturas}")
            ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"{nome}: sem rolagem horizontal da página")
            # ---- dock dos avisos
            dock = pg.locator("[data-testid=avisos-da-minuta]"); dock.wait_for()
            bx = dock.bounding_box()
            if nome == "desktop": ok(bx["x"] + bx["width"] > w - 80 and bx["x"] > w * 0.6, f"{nome}: o dock de avisos fica na lateral DIREITA {bx}")
            else: ok(bx["y"] > h * 0.6 and bx["x"] >= 0 and bx["x"] + bx["width"] <= w + 1, f"{nome}: no celular o dock vira uma faixa embaixo, dentro da tela {bx}")
            ok(pg.evaluate("getComputedStyle(document.querySelector('[data-testid=avisos-da-minuta]')).position") == "fixed", f"{nome}: o dock flutua (posição fixa)")
            ids = pg.eval_on_selector_all("[data-testid^=chip-]", "els => els.map(e => e.getAttribute('data-testid'))")
            for esperado in ["chip-injecao", "chip-fontes", "chip-argumentos", "chip-fase"]: ok(esperado in ids, f"{nome}: botão {esperado} no dock")
            ok(pg.locator("[data-testid=avisos-painel-flutuante]").is_hidden(), f"{nome}: nenhum painel aberto no início")
            pg.click("[data-testid=chip-argumentos]")
            ok(pg.locator("[data-testid=aviso-argumentos]").is_visible() and "prescrição da pretensão" in pg.inner_text("[data-testid=aviso-argumentos]"), f"{nome}: clicar abre o painel do aviso")
            pb = pg.locator("[data-testid=avisos-painel-flutuante]").bounding_box()
            if nome == "desktop": ok(pb["x"] + pb["width"] <= bx["x"] + 2 and pb["x"] >= 0, f"{nome}: o painel abre ao lado do dock, dentro da tela {pb}")
            else: ok(pb["y"] + pb["height"] <= bx["y"] + 2 and pb["x"] >= 0 and pb["x"] + pb["width"] <= w + 1, f"{nome}: o painel abre acima da faixa, dentro da tela {pb}")
            pg.click("[data-testid=chip-fase]")
            ok(pg.locator("[data-testid=aviso-fase]").is_visible() and not pg.locator("[data-testid=aviso-argumentos]").is_visible(), f"{nome}: abre um aviso por vez")
            pg.keyboard.press("Escape")
            ok(pg.locator("[data-testid=avisos-painel-flutuante]").is_hidden(), f"{nome}: Esc fecha o painel")
            pg.click("[data-testid=chip-citacao]"); pg.click("[data-testid=avisos-fechar]")
            ok(pg.locator("[data-testid=avisos-painel-flutuante]").is_hidden(), f"{nome}: o X fecha o painel")
            if nome == "desktop":
                pg.click("[data-testid=avisos-alternar-nomes]")
                ok("Argumentos sem resposta" in pg.inner_text("[data-testid=chip-argumentos]"), "desktop: o botão Avisos mostra os nomes ao lado dos ícones")
                pg.screenshot(path="/tmp/claude-0/work/teste/layout_minuta_nomes.png")
                pg.click("[data-testid=avisos-alternar-nomes]")
                pg.click("[data-testid=chip-argumentos]")
            pg.screenshot(path=f"/tmp/claude-0/work/teste/layout_minuta_{nome}.png")
            pg.close()
        ok(not erros, f"sem erros na página {erros}")
        b.close()
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
