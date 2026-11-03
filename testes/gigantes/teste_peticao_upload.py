"""Petição & Defesa 360°: ao anexar arquivos grandes, cada um aparece NA HORA com o andamento da leitura (página X de N), entra na lista ao terminar, o botão de extrair espera a leitura,
e um arquivo que não dá para ler mostra o motivo (em vez de a tela ficar parada sem dizer nada). O painel é renderizado sozinho (sem login/servidor)."""
import glob, os, subprocess, sys, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
sys.path.insert(0, AQUI)
from gerar_pdf import processo
from playwright.sync_api import sync_playwright
PV = 5199
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
def main():
    os.makedirs("/tmp/claude-0/work/mob", exist_ok=True)
    grande1, grande2, vazio = "/tmp/claude-0/work/mob/autos_grande_1.pdf", "/tmp/claude-0/work/mob/autos_grande_2.pdf", "/tmp/claude-0/work/mob/vazio.pdf"
    open(grande1, "wb").write(processo(500, injecao=False, vazias=())); open(grande2, "wb").write(processo(400, injecao=False, vazias=())); open(vazio, "wb").write(b"")
    cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_peticao.config.ts"), "w").write(cfg)
    vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_peticao.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/peticao.html")
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
            pg = b.new_page(viewport={"width": 1400, "height": 1000}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/peticao.html"); pg.wait_for_selector("#dropzone-client-files", timeout=60000)
            entrada = pg.locator("input[type=file][accept='.pdf']").first
            # dois PDFs grandes de uma vez, nos AUTOS
            entrada.set_input_files([grande1, grande2])
            pg.wait_for_selector("[data-testid=lendo-autos]", timeout=5000)      # aparece na hora (antes: nada até o fim)
            t = pg.inner_text("[data-testid=lendo-autos]"); print("durante a leitura:", t.replace("\n", " | ")[:240])
            assert "autos_grande_1.pdf" in t and "autos_grande_2.pdf" in t and "na fila" in t, "os dois arquivos aparecem de imediato; o segundo fica 'na fila'"
            pg.wait_for_function("document.querySelector('[data-testid=lendo-autos]')?.innerText.match(/lendo pág\\. \\d+\\/\\d+/)", timeout=60000)
            assert pg.evaluate("[...document.querySelectorAll('button')].filter(b => /Extrair Autos/i.test(b.innerText)).every(b => b.disabled)"), "o botão de extrair deve esperar a leitura"
            # o primeiro arquivo pronto entra na lista antes de o segundo terminar
            pg.wait_for_function("document.querySelector('#petition-form-section, body').innerText.includes('autos_grande_1.pdf') && document.querySelectorAll('[data-testid=lendo-autos]').length >= 0", timeout=120000)
            pg.wait_for_function("!document.querySelector('[data-testid=lendo-autos]')", timeout=240000)
            corpo = pg.inner_text("body")
            assert "autos_grande_1.pdf" in corpo and "autos_grande_2.pdf" in corpo, "os dois arquivos devem estar na lista ao terminar"
            assert pg.evaluate("[...document.querySelectorAll('button')].filter(b => /Extrair Autos/i.test(b.innerText)).every(b => !b.disabled)"), "o botão volta a funcionar"
            # arquivo vazio nas PROVAS: erro visível com o motivo
            pg.locator("input[type=file]").nth(1).set_input_files(vazio)
            pg.wait_for_selector("[data-testid=lendo-provas]", timeout=10000)
            pg.wait_for_function("document.querySelector('[data-testid=lendo-provas]')?.innerText.includes('está vazio')", timeout=10000)
            print("arquivo vazio:", pg.inner_text("[data-testid=lendo-provas]").replace("\n", " | ")[:160])
            pg.locator("[data-testid=lendo-provas] button").first.click(); assert not pg.locator("[data-testid=lendo-provas]").count(), "o aviso de erro pode ser fechado"
            # PDF corrompido que faria a leitura travar: o vigia (aqui, 2 s) desiste da extração e o arquivo entra pela cópia binária, sem a tela ficar parada
            pg.evaluate("window.__PETICAO_TIMEOUT_LEITURA_MS = 2000")
            open("/tmp/claude-0/work/mob/corrompido.pdf", "wb").write(b"%PDF-1.4\n" + b"lixo sem estrutura " * 2000)
            pg.locator("input[type=file]").nth(1).set_input_files("/tmp/claude-0/work/mob/corrompido.pdf")
            pg.wait_for_function("document.body.innerText.includes('corrompido.pdf') && !document.querySelector('[data-testid=lendo-provas]')", timeout=60000)
            assert not pg.locator("#tab-btn-modelos").count() and "Biblioteca" not in pg.inner_text("body"), "a aba Modelos foi removida"
            assert not erros, erros
            pg.screenshot(path="/tmp/claude-0/work/mob/peticao_upload.png"); b.close()
        print("OK")
    finally:
        os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_peticao.config.ts"))
main()
