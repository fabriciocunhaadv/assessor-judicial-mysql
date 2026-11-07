"""Lado do app da ponte: recolhe a fila deixada pela extensão, envia a /api/saude/evento e confirma pelo atributo. Rodar: /usr/bin/python3 testes/teste_saude_ponte_app.py"""
import glob, json, os, subprocess, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_ponte.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
try:
    for _ in range(60):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/ponte.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(); recebidos = []
        pg.route("**/api/saude/evento", lambda r, _q=None: (recebidos.append(json.loads(r.request.post_data)), r.fulfill(status=200, content_type="application/json", body='{"ok":true}')))
        pg.goto("http://127.0.0.1:5198/testes/gigantes/ponte.html"); pg.wait_for_function("window.pronto")
        pg.evaluate("""() => { document.documentElement.dataset.projudiSaudeFila = JSON.stringify([{ id: 'a1', versao: '1.0.87', modulo: 'ocr', severidade: 'erro', mensagem: 'Falhou o OCR' }, { id: 'a2', versao: '1.0.87', modulo: 'extensao', severidade: 'info', mensagem: 'Extensão ativa' }]); window.dispatchEvent(new Event('projudi:saude')); }""")
        pg.wait_for_function("document.documentElement.dataset.projudiSaudeAck", timeout=5000)
        assert json.loads(pg.evaluate("document.documentElement.dataset.projudiSaudeAck")) == ["a1", "a2"]
        assert pg.evaluate("document.documentElement.dataset.projudiSaudeFila") is None
        pg.wait_for_timeout(4500)
        evs = [e for r in recebidos for e in r["eventos"]]; print(evs)
        assert len(evs) == 2 and evs[0]["tipo"] == "extensao" and evs[0]["modulo"] == "ocr" and evs[0]["severidade"] == "erro" and evs[0]["mensagem"].startswith("[v1.0.87] Falhou"), evs
        b.close()
    print("OK ponte (lado do app)")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
