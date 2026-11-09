"""Abrir chamado pelo celular (texto + print + PDF, sem áudio), rotas simuladas. Rodar: /usr/bin/python3 testes/teste_chamado_painel.py"""
import glob, json, os, subprocess, time, urllib.request, base64
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_ch.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/chamado.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []; envios = []
            pg = b.new_page(viewport={"width": 390, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
            def anexo(r):
                envios.append((r.request.headers.get("content-type"), r.request.headers.get("x-nome"), len(r.request.post_data_buffer or b"")))
                r.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "a" * 32, "nome": "print.png", "tipo": "image/png", "tamanho": 70}))
            pg.route("**/api/chamados/anexos", anexo)
            pg.route("**/api/fila/minha", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"resumo": {"total": 10, "aguardando": 2, "analisando": 1, "concluidos": 6, "erros": 1, "pausados": 0, "modo": "ia", "ia": "Jusbrasil", "ultimoErro": "ChatGPT: login", "versao": "1.0.96"}, "online": True, "ultimoSinal": 1, "prefs": {}, "aparelhos": 0})))
            pg.goto("http://127.0.0.1:5198/testes/gigantes/chamado.html"); pg.wait_for_timeout(800)
            pg.evaluate("window.dispatchEvent(new CustomEvent('chamado:abrir'))"); pg.wait_for_selector("[data-testid=novo-chamado]")
            t = pg.inner_text("[data-testid=novo-chamado]"); assert "Print ou foto" in t and "PDF" in t and "digite" in t.lower(), t[:300]
            assert not any(x in t.lower() for x in ("gravar", "áudio", "audio", "microfone", "voz")), "não deve haver áudio"
            pg.click("[data-testid=chamado-enviar]"); pg.wait_for_timeout(300)
            assert pg.locator("[data-testid=novo-chamado]").is_visible(), "sem título e texto não envia"
            pg.fill("[data-testid=chamado-titulo]", "A fila parou"); pg.fill("[data-testid=chamado-texto]", "Parou no processo 12 e não voltou.")
            pg.set_input_files("[data-testid=chamado-input-img]", files=[{"name": "print.png", "mimeType": "image/png", "buffer": PNG}])
            pg.set_input_files("[data-testid=chamado-input-pdf]", files=[{"name": "autos.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 teste"}])
            pg.wait_for_selector("[data-testid=chamado-anexos] li"); assert pg.locator("[data-testid=chamado-anexos] li").count() == 2
            pg.screenshot(path="/tmp/claude-0/work/teste/chamado.png", full_page=True)
            pg.click("[data-testid=chamado-enviar]"); pg.wait_for_selector("[data-testid=novo-chamado]", state="detached", timeout=15000)
            assert [e[0] for e in envios] == ["image/png", "application/pdf"] and envios[0][1] == "print.png", envios
            guardado = pg.evaluate("() => Object.entries(localStorage).filter(([k]) => k.startsWith('agaia_support_tickets_')).map(([k, v]) => v)")
            tk = json.loads(guardado[0])[0]; print("chamado:", tk["title"], "|", tk["type"], "|", len(tk["anexos"]), "anexo(s)")
            assert tk["title"] == "A fila parou" and tk["type"] == "reporte_erro" and len(tk["anexos"]) == 2 and "6 de 10 concluídos" in tk["description"] and "Parou no processo 12" in tk["description"], tk["description"]
            b.close()
        assert not erros, erros[:3]; print("OK chamado pelo celular")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
