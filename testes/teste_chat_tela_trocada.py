"""Chat x esteira: (1) enquanto o chat está em uso o app sinaliza `data-assessor-ocupado`; (2) se a tela trocar de processo antes de a IA responder, a resposta NÃO sobrescreve a tela nova.
Rodar: /usr/bin/python3 testes/teste_chat_tela_trocada.py"""
import glob, json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_ct.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/viewer_chat.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(viewport={"width": 1200, "height": 900}); erros = []; pend = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:300]))
        def api(rota):
            u = rota.request.url
            if "/api/chat-agaia" in u: pend.append(rota)      # a IA 'demora': a resposta só sai depois de a tela trocar de processo
            else: rota.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"itens":[],"docs":[],"data":null}')
        pg.route("**/api/**", api)
        pg.goto("http://127.0.0.1:5198/testes/gigantes/viewer_chat.html"); pg.wait_for_function("window.pronto")
        pg.get_by_text("Editar com o chat Gemini").first.click()      # o painel do chat começa recolhido
        ta = pg.locator("textarea[placeholder^='Comande alterações']"); ta.wait_for(timeout=15000)
        ta.fill("ajuste o relatório")
        ok(pg.evaluate("document.documentElement.dataset.assessorOcupado") == "1", "digitando no chat: o app sinaliza ocupado para a esteira")
        ta.press("Enter")
        for _ in range(100):
            if pend: break
            pg.wait_for_timeout(100)
        assert pend, "o chat não enviou o pedido"
        pg.evaluate("window.trocar()")      # a esteira joga outro processo na tela enquanto a IA ainda responde
        pg.wait_for_timeout(300)
        pend[0].fulfill(content_type="application/json", body=json.dumps({"reply": "Feito.", "hasMinuteUpdate": True, "updatedMinute": {"title": "DECISÃO INTERLOCUTÓRIA", "relatorio": "RELATORIO-ALTERADO-PELO-CHAT", "fundamentacao": "f", "dispositivo": "d"}, "usage": {"totalTokenCount": 10}}))
        pg.wait_for_function("document.body.innerText.includes('Feito.') || document.body.innerText.includes('já mostra outro processo')", timeout=20000)
        pg.wait_for_timeout(500)
        ok(pg.evaluate("window.atualizacoes.length") == 0, "a resposta atrasada do chat NÃO sobrescreve a tela do processo novo")
        ok("já mostra outro processo" in pg.inner_text("body"), "a pessoa é avisada de que a minuta antiga foi atualizada no Histórico")
        ok(pg.evaluate("document.documentElement.dataset.assessorOcupado") != "1", "terminou o chat: o sinal de ocupado é retirado")
        ok(not erros, f"sem erros {erros}")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
