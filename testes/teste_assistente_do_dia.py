"""Assistente do dia: aparece na 1ª entrada do dia (depois do tutorial), fica no canto direito, perfil assessor/magistrado, botões levam às funções, fechar guarda o dia.
Rodar: /usr/bin/python3 testes/teste_assistente_do_dia.py"""
import datetime, glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
URL = "http://127.0.0.1:5198/testes/gigantes/assistente.html"
HOJE = datetime.date.today().isoformat()
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_as.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen(URL, timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
        def pagina(init="", viewport=None):
            pg = b.new_page(viewport=viewport or {"width": 1280, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            pg.add_init_script(init); pg.goto(URL); pg.wait_for_function("window.pronto"); return pg
        TOUR = "localStorage.setItem('assessor_tour_app_tour','1');"
        # 1) primeira entrada do dia, assessor, sem extensão: conversa com poucas escolhas
        pg = pagina(TOUR); pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000)
        ok("O que você quer fazer hoje?" in pg.inner_text("[data-testid=assistente-saudacao]"), "aparece na primeira entrada do dia perguntando o que fazer")
        ids = pg.eval_on_selector_all("[data-testid^=assistente-op-]", "els => els.map(e => e.dataset.testid.replace('assistente-op-',''))")
        ok(ids[0] == "fila" and "PRINCIPAL" in pg.locator("[data-testid=assistente-op-fila]").inner_text() and len(ids) <= 5, f"poucas escolhas; a fila é a principal para o assessor ({ids})")
        ok("lupa" not in ids and "lupa_fila" not in ids, "a Lupa não aparece para assessor")
        ok(pg.locator("[data-testid=assistente-instalar]").count() == 1, "sem a extensão: avisa e oferece instalar")
        ok(pg.locator("text=Como fazer").count() == 0 and pg.locator("[data-testid^=assistente-perfil-]").count() == 0, "sem 'Como fazer' e sem pergunta de perfil")
        caixa = pg.locator("[data-testid=assistente-boas-vindas]").bounding_box()
        ok(caixa["x"] + caixa["width"] <= 1280 and caixa["x"] > 800 and caixa["y"] >= 100 and caixa["y"] + caixa["height"] <= 800, f"canto direito, dentro da tela ({caixa})")
        # 2) submenus
        pg.click("[data-testid=assistente-op-audiencias]")
        ids = pg.eval_on_selector_all("[data-testid^=assistente-op-]", "els => els.map(e => e.dataset.testid.replace('assistente-op-',''))")
        ok(ids == ["mesa", "sentenca_individual", "sentenca_fila"], f"Audiências abre 3 escolhas ({ids})")
        pg.click("[data-testid=assistente-inicio]")
        pg.click("[data-testid=assistente-op-outras]")
        ids = pg.eval_on_selector_all("[data-testid^=assistente-op-]", "els => els.map(e => e.dataset.testid.replace('assistente-op-',''))")
        ok(ids == ["turbo", "grandes", "teses", "conhecer"], f"Outras funções ({ids})")
        pg.click("[data-testid=assistente-voltar]")
        ok(pg.locator("[data-testid=assistente-op-fila]").count() == 1, "Voltar retorna ao início")
        # 3) botões da extensão: sem a extensão abre a loja; extensão antiga orienta na própria conversa; nova abre aba
        pg.evaluate("window.__cliques = []; HTMLAnchorElement.prototype.click = function () { window.__cliques.push(this.href + '|' + this.target); }; window.open = (u) => { window.__cliques.push('open:' + u); return null; }")
        pg.click("[data-testid=assistente-op-fila]")
        pg.click("[data-testid=assistente-acao-ext-painel]")
        cl = pg.evaluate("window.__cliques")
        ok(any(c.startswith("open:https://chromewebstore.google.com") for c in cl) and "não foi detectada" in pg.inner_text("[data-testid=assistente-msg-extensao]"), f"sem extensão: abre a instalação ({cl})")
        pg.evaluate("document.documentElement.dataset.assessorExtensao = '2.0.5'; window.__cliques = []")
        pg.click("[data-testid=assistente-acao-ext-painel]"); pg.wait_for_timeout(300)
        t = pg.inner_text("[data-testid=assistente-msg-extensao]")
        ok(pg.evaluate("window.__cliques") == [] and "Abrir painel completo" in t and "quebra-cabeça" in t, "extensão antiga: explica na conversa onde clicar (ícone e botão)")
        pg.evaluate("document.documentElement.dataset.assessorExtensaoId = 'abcdefghijklmnopabcdefghijklmnop'; window.__cliques = []")
        pg.click("[data-testid=assistente-acao-ext-painel]")
        ok(pg.evaluate("window.__cliques") == ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/painel.html|_blank"] and pg.locator("[data-testid=assistente-pilula]").count() == 1, "extensão nova: abre o painel em aba nova e o assistente vira pílula")
        pg.click("[data-testid=assistente-pilula]"); pg.wait_for_selector("[data-testid=assistente-saudacao]")
        ok(pg.locator("[data-testid=assistente-op-fila]").count() == 1 and pg.locator("[data-testid^=assistente-resposta-]").count() == 0, "a pílula reabre a conversa do começo (não a tela anterior)")
        pg.evaluate("window.__cliques = []")
        pg.click("[data-testid=assistente-op-audiencias]"); pg.click("[data-testid=assistente-op-sentenca_fila]"); pg.click("[data-testid=assistente-acao-ext-pauta]")
        ok(pg.evaluate("window.__cliques") == ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/pauta.html|_blank"], "fila de sentenças com vídeo abre a pauta da extensão")
        pg.click("[data-testid=assistente-pilula]"); pg.click("[data-testid=assistente-op-historico]"); pg.click("[data-testid=assistente-acao-historico]")
        ok(pg.evaluate("window.acoes") == ["historico"] and pg.locator("[data-testid=assistente-pilula]").count() == 1, "o botão abre a função e o assistente vira pílula")
        pg.click("[data-testid=assistente-pilula]"); pg.wait_for_selector("[data-testid=assistente-boas-vindas]")
        # 4) fechar guarda o dia
        pg.click("[data-testid=assistente-fechar]")
        ok(pg.locator("[data-testid=assistente-boas-vindas]").count() == 0 and pg.evaluate("localStorage.getItem('assessor_assistente_dia_teste-uid')") == HOJE, "fechar esconde e guarda o dia")
        pg.reload(); pg.wait_for_function("window.pronto"); pg.wait_for_timeout(1500)
        ok(pg.locator("[data-testid=assistente-boas-vindas]").count() == 0, "no mesmo dia, ao recarregar, não volta")
        pg.evaluate("window.dispatchEvent(new Event('assessor:abrir-assistente'))")
        ok(pg.locator("[data-testid=assistente-boas-vindas]").count() == 1, "o botão do menu lateral reabre quando a pessoa quiser")
        pg.close()
        # 5) outro dia volta; com a extensão detectada
        ontem = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        pg = pagina(TOUR + f"localStorage.setItem('assessor_assistente_dia_teste-uid','{ontem}'); document.addEventListener('DOMContentLoaded',()=>{{document.documentElement.dataset.assessorExtensao='2.0.5'}});")
        pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000); pg.wait_for_function("document.querySelector('[data-testid=assistente-extensao]').innerText.includes('Extensão instalada')", timeout=8000)
        ok("Extensão instalada" in pg.inner_text("[data-testid=assistente-extensao]") and pg.locator("[data-testid=assistente-instalar]").count() == 0, "no dia seguinte aparece de novo; com a extensão detectada não pede para instalar")
        pg.close()
        # 6) tutorial inicial ainda pendente: espera
        pg = pagina(""); pg.wait_for_timeout(3500)
        ok(pg.locator("[data-testid=assistente-boas-vindas]").count() == 0, "enquanto o tutorial inicial não terminou, o assistente espera (não aparece por cima dele)")
        pg.close()
        # 7) perfil magistrado pelo cadastro
        pg = pagina(TOUR + "window.__juiz = true;"); pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000)
        ids3 = pg.eval_on_selector_all("[data-testid^=assistente-op-]", "els => els.map(e => e.dataset.testid.replace('assistente-op-',''))")
        ok(ids3[0] == "lupa" and "lupa_fila" in ids3, f"usuário com função de magistrado vê as opções do magistrado: Lupa primeiro e fila para a Lupa ({ids3[:3]})")
        pg.close()
        # 8) celular: não estoura a tela
        pg = pagina(TOUR, {"width": 390, "height": 760}); pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000)
        c = pg.locator("[data-testid=assistente-boas-vindas]").bounding_box()
        ok(c["x"] >= 0 and c["x"] + c["width"] <= 390 and c["y"] + c["height"] <= 760, f"no celular cabe na tela ({c})")
        pg.screenshot(path="/tmp/claude-0/work/teste/assistente_celular.png"); pg.close()
        pg = pagina(TOUR); pg.wait_for_selector("[data-testid=assistente-boas-vindas]"); pg.screenshot(path="/tmp/claude-0/work/teste/assistente.png")
        ok(not erros, f"sem erros {erros}")
        b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("TUDO OK")
