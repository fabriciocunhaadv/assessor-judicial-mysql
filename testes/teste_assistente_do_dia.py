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
        # 1) primeira entrada do dia, assessor, sem extensão
        pg = pagina(TOUR); pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000)
        ok("O que você quer fazer hoje?" in pg.inner_text("[data-testid=assistente-boas-vindas]"), "aparece na primeira entrada do dia perguntando o que fazer")
        primeira = pg.locator("[data-testid^=assistente-tarefa-]").first.get_attribute("data-testid")
        ok(primeira == "assistente-tarefa-fila" and "PRINCIPAL" in pg.locator("[data-testid=assistente-tarefa-fila]").inner_text(), "para o assessor a fila de processos é a função principal")
        ok(pg.locator("[data-testid=assistente-instalar]").count() == 1, "sem a extensão: avisa e oferece instalar")
        pg.click("[data-testid=assistente-como-fila]")
        ok("Abrir painel completo" in pg.inner_text("[data-testid=assistente-passos-fila]"), "'Como fazer' explica o caminho na extensão (painel completo)")
        caixa = pg.locator("[data-testid=assistente-boas-vindas]").bounding_box()
        ok(caixa["x"] + caixa["width"] <= 1280 and caixa["x"] > 800 and caixa["y"] >= 100 and caixa["y"] + caixa["height"] <= 800, f"fica no canto direito, abaixo do cabeçalho e dentro da tela ({caixa})")
        ids = pg.eval_on_selector_all("[data-testid^=assistente-tarefa-]", "els => els.map(e => e.dataset.testid.replace('assistente-tarefa-',''))")
        ok(all(x in ids for x in ["avulso", "historico", "mesa", "sentenca_individual", "sentenca_fila", "turbo", "grandes", "teses", "conhecer"]) and "lupa" not in ids, f"as demais funções estão lá e a Lupa não aparece para assessor ({ids})")
        # 2) magistrado
        pg.click("[data-testid=assistente-perfil-magistrado]")
        ids2 = pg.eval_on_selector_all("[data-testid^=assistente-tarefa-]", "els => els.map(e => e.dataset.testid.replace('assistente-tarefa-',''))")
        ok(ids2[0] == "lupa" and "lupa_fila" in ids2, f"para o magistrado a Lupa vem primeiro e há a fila para a Lupa ({ids2[:3]})")
        # 3) ação e minimizar
        pg.click("[data-testid=assistente-acao-lupa]")
        ok(pg.evaluate("window.acoes") == ["lupa"] and pg.locator("[data-testid=assistente-pilula]").count() == 1, "o botão abre a função e o assistente vira uma pílula (sai do caminho)")
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
        ok(pg.locator("[data-testid^=assistente-tarefa-]").first.get_attribute("data-testid") == "assistente-tarefa-lupa", "usuário magistrado já abre no perfil de magistrado")
        pg.close()
        # 8) celular: não estoura a tela
        pg = pagina(TOUR, {"width": 390, "height": 760}); pg.wait_for_selector("[data-testid=assistente-boas-vindas]", timeout=8000)
        c = pg.locator("[data-testid=assistente-boas-vindas]").bounding_box()
        ok(c["x"] >= 0 and c["x"] + c["width"] <= 390 and c["y"] + c["height"] <= 760, f"no celular cabe na tela ({c})")
        pg.screenshot(path="/tmp/claude-0/work/teste/assistente_celular.png"); pg.close()
        pg = pagina(TOUR); pg.wait_for_selector("[data-testid=assistente-boas-vindas]"); pg.click("[data-testid=assistente-como-fila]"); pg.screenshot(path="/tmp/claude-0/work/teste/assistente.png")
        ok(not erros, f"sem erros {erros}")
        b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("TUDO OK")
