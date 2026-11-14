"""Mutirão Expresso: opção de COLAR a transcrição da audiência (em vez de enviar vídeo). Rodar: /usr/bin/python3 testes/teste_mutirao_transcricao.py"""
import glob, json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_mut.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
TRANSC = "[00:05] Juiz: Bom dia. Vamos colher o depoimento pessoal do autor. " + "[00:40] Autor: Eu contratei a obra verbalmente e paguei R$ 62.676,02 adiantado. " * 6
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/mutirao.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); ctx = b.new_context(); pg = ctx.new_page(); erros = []; pedidos = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        prompt = [{"id": "p1", "title": "Outros Área Judicial - Cível", "promptText": "PROMPT DO JUIZ", "category": "civel", "scope": "judicial", "createdAt": 1, "updatedAt": 1}]
        pg.add_init_script("localStorage.setItem('assessor_fabricio_prompts_v3_gabinete_default', %s)" % json.dumps(json.dumps(prompt)))
        def api(rota):
            u = rota.request.url
            if "/api/mutirao-video" in u:
                corpo = (rota.request.post_data_buffer or b"").decode("latin1")
                pedidos.append({"midias": '"midias"' in corpo and '[]' not in corpo.split('name="midias"')[1][:12], "degr": "degravacaoPronta" in corpo, "tem_texto": "paguei R$ 62.676,02" in corpo})
                rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "usage": {"totalTokenCount": 10}, "data": {"transcription": TRANSC, "sentenceText": "SENTENÇA\n\nRelatório. Fundamentação. Dispositivo: julgo procedente o pedido."}}))
            elif "/api/progresso/" in u: rota.fulfill(content_type="application/json", body="{}")
            else: rota.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}')
        pg.route("**/api/**", api)
        pg.goto("http://127.0.0.1:5198/testes/gigantes/mutirao.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=modo-midia]")
        ok(pg.locator("[data-testid=gerar-sentenca-midia]").is_disabled(), "sem vídeo e sem texto o botão fica desligado")
        pg.click("[data-testid=modo-midia-texto]"); pg.wait_for_selector("[data-testid=transcricao-colada]")
        ok("Cole a transcrição" in pg.inner_text("[data-testid=area-transcricao]") or pg.get_attribute("[data-testid=transcricao-colada]", "placeholder").startswith("Cole aqui"), "aparece o campo para colar a transcrição")
        ok(pg.locator("[data-testid=gerar-sentenca-midia]").is_disabled(), "campo vazio: botão desligado")
        pg.fill("[data-testid=transcricao-colada]", "curto demais")
        ok(pg.locator("[data-testid=gerar-sentenca-midia]").is_disabled() and "mínimo" in pg.inner_text("[data-testid=transcricao-contagem]"), "texto curto: botão desligado e avisa o mínimo")
        pg.fill("[data-testid=transcricao-colada]", TRANSC)
        ok(not pg.locator("[data-testid=gerar-sentenca-midia]").is_disabled(), "texto suficiente: botão liga")
        ok("Gerar Sentença com a Transcrição" in pg.inner_text("[data-testid=gerar-sentenca-midia]"), "o botão diz que vai usar a transcrição")
        pg.click("[data-testid=modo-midia-video]"); pg.click("[data-testid=modo-midia-texto]")
        ok(pg.input_value("[data-testid=transcricao-colada]") == TRANSC, "trocar de aba não perde o texto colado")
        pg.click("[data-testid=gerar-sentenca-midia]"); pg.wait_for_function("window.sessao.ler('step') === 'sentence'", timeout=20000)
        ok(len(pedidos) == 1 and pedidos[0]["degr"] and pedidos[0]["tem_texto"], f"o servidor recebe a transcrição como degravação pronta {pedidos}")
        ok(not pedidos[0]["midias"], "nenhuma mídia é enviada")
        ok("julgo procedente" in (pg.evaluate("window.sessao.ler('sentenceText')") or ""), "a sentença aparece na tela")
        ok("paguei R$ 62.676,02" in (pg.evaluate("window.sessao.ler('transcription')") or ""), "a transcrição fica na aba de degravação")
        ok(not erros, f"sem erros na página {erros}")
        b.close()
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
