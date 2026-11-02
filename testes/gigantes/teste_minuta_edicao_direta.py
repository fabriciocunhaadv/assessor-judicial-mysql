"""Edição direta da minuta na tela (sem o botão Editar): clicar no trecho abre um campo no mesmo lugar, o texto é salvo sozinho (com atraso) e ao sair; selecionar texto não abre
a edição; Esc volta à visão formatada; a minuta (relatório/fundamentação/dispositivo e texto completo) é atualizada. MinuteViewer renderizado sozinho (sem login/servidor)."""
import glob, os, subprocess, sys, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
PV = 5199
from playwright.sync_api import sync_playwright
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
def main():
    S = lambda t, suf="": f"[data-testid={t}{suf}]"; R = "minuta-secao-relatorio"; F = "minuta-secao-fundamentacao"; D = "minuta-secao-dispositivo"
    cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_edicao.config.ts"), "w").write(cfg)
    vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_edicao.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/chat.html")
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
            pg = b.new_page(viewport={"width": 1400, "height": 900}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/chat.html"); pg.wait_for_selector(S("minuta-secao-relatorio"), timeout=60000)
            pass
            # 1) selecionar texto NÃO abre a edição
            pg.evaluate("""() => { const el = document.querySelector('[data-testid=minuta-secao-relatorio] p, [data-testid=minuta-secao-relatorio] div'); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""")
            pg.locator(R).click(position={"x": 30, "y": 8}, modifiers=[]) if False else None
            pg.evaluate("document.querySelector('[data-testid=minuta-secao-relatorio]').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
            assert not pg.locator(S(R, "-campo")).count(), "selecionar texto não pode abrir a edição"
            pg.evaluate("getSelection().removeAllRanges()")
            # 2) clique simples abre o campo, já com o texto gravado
            pg.locator(S(R)).click(); pg.wait_for_selector(S(R, "-campo"))
            campo = pg.locator(S(R, "-campo")); assert "Relatório de teste." in campo.input_value(), campo.input_value()
            assert pg.evaluate("document.activeElement === document.querySelector('[data-testid=minuta-secao-relatorio-campo]')")
            # 3) digitar: salva sozinho depois de uma pausa (não a cada tecla) e atualiza a minuta
            n0 = pg.evaluate("window.__salvos.length")
            campo.press("End"); pg.keyboard.type(" Acrescentei esta frase direto na tela.")
            assert pg.evaluate("window.__salvos.length") == n0, "não deve salvar a cada tecla"
            pg.wait_for_function("window.__salvos.length > %d" % n0, timeout=5000)
            m = pg.evaluate("window.__minuta"); assert m["relatorio"].endswith("Acrescentei esta frase direto na tela."), m["relatorio"]
            assert "Acrescentei esta frase" in m["fullFormattedText"] and "I - RELATÓRIO" in m["fullFormattedText"], m["fullFormattedText"][:300]
            pg.wait_for_selector(S(R, "-estado") + ":has-text('Salvo')")
            # 4) apagar também vale; Esc volta à visão formatada e mostra o texto novo
            campo.press("Control+a"); pg.keyboard.type("Relatório reescrito à mão."); pg.keyboard.press("Escape")
            pg.wait_for_selector(S(R, "-campo"), state="detached")
            assert "Relatório reescrito à mão." in pg.inner_text(S(R)) and pg.evaluate("window.__minuta.relatorio") == "Relatório reescrito à mão."
            # 5) fundamentação e dispositivo também; sair clicando fora salva o que ficou pendente
            pg.locator(S(F)).click(); pg.wait_for_selector(S(F, "-campo")); pg.locator(S(F, "-campo")).press("Control+End"); pg.keyboard.type(" Fim editado.")
            pg.locator(S(D)).click()      # clicar noutro trecho: salva a anterior e abre este
            pg.wait_for_selector(S(D, "-campo"))
            assert pg.evaluate("window.__minuta.fundamentacao").endswith("Fim editado."), "sair do campo deve salvar o pendente"
            pg.locator(S(D, "-campo")).fill("Defiro o pedido."); pg.keyboard.press("Escape")
            pg.wait_for_selector(S(D, "-campo"), state="detached")
            assert pg.evaluate("window.__minuta.dispositivo") == "Defiro o pedido."
            assert not erros, erros
            pg.screenshot(path="/tmp/claude-0/work/mob/edicao_direta.png"); b.close()
        print("OK")
    finally:
        os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_edicao.config.ts"))
main()
