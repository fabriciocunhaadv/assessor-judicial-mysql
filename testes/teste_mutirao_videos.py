"""Mutirão Expresso: vídeo a vídeo (cada degravação é guardada ao terminar e a nova tentativa só refaz o que falta), erro que fica na tela e autos grandes com tratamento de gigante.
Rodar: /usr/bin/python3 testes/teste_mutirao_videos.py"""
import glob, json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_mv.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/mutirao.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); ctx = b.new_context(); pg = ctx.new_page(); erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        prompt = [{"id": "p1", "title": "Outros Área Judicial - Cível", "promptText": "PROMPT DO JUIZ", "category": "civel", "scope": "judicial", "createdAt": 1, "updatedAt": 1}]
        pg.add_init_script("localStorage.setItem('assessor_fabricio_prompts_v3_gabinete_default', %s)" % json.dumps(json.dumps(prompt)))
        st = {"deg": {}, "falhar_b": True, "finais": [], "partes": 0}
        def api(rota):
            u = rota.request.url
            if "/api/mutirao-midia/parte" in u: st["partes"] += 1; rota.fulfill(content_type="application/json", body='{"ok":true}')
            elif "/api/mutirao-degravar" in u:
                c = json.loads(rota.request.post_data or "{}"); nome = c["midia"]["nomeMidia"]; st["deg"][nome] = st["deg"].get(nome, 0) + 1
                if nome == "b.mp4" and st["falhar_b"]: rota.fulfill(status=500, content_type="application/json", body=json.dumps({"success": False, "error": "O Google não conseguiu processar a mídia \"b.mp4\"."}))
                else: rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "texto": "[00:10] Testemunha de %s: conheço as partes e presenciei a entrega das chaves do imóvel." % nome, "idx": c["idx"], "nomeMidia": nome, "usage": {"totalTokenCount": 10}}))
            elif "/api/mutirao-video" in u:
                corpo = (rota.request.post_data_buffer or b"").decode("utf-8", "replace"); st["finais"].append(corpo)
                rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "usage": {"totalTokenCount": 10}, "data": {"transcription": "x", "sentenceText": "SENTENÇA\n\nRelatório. Dispositivo: julgo procedente o pedido."}}))
            elif "/api/progresso/" in u: rota.fulfill(content_type="application/json", body="{}")
            else: rota.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}')
        pg.route("**/api/**", api)
        pg.goto("http://127.0.0.1:5198/testes/gigantes/mutirao.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=modo-midia]")
        pg.set_input_files("input[type=file][accept='video/*,audio/*']", [{"name": "a.mp4", "mimeType": "video/mp4", "buffer": b"\x00" * 3000}, {"name": "b.mp4", "mimeType": "video/mp4", "buffer": b"\x01" * 4000}])
        pg.wait_for_selector("[data-testid=lista-midias]")
        ok(pg.locator("[data-testid=video-degravado]").count() == 0, "antes de começar, nenhum vídeo está marcado como degravado")
        pg.click("[data-testid=gerar-sentenca-midia]"); pg.wait_for_selector("[data-testid=erro-geracao]", timeout=20000)
        erro = pg.inner_text("[data-testid=erro-geracao]")
        ok(st["deg"] == {"a.mp4": 1, "b.mp4": 1}, f"cada vídeo foi degravado em uma chamada própria {st['deg']}")
        ok("Vídeo 2 de 2" in erro and "b.mp4" in erro and "ficaram guardadas" in erro, f"o erro diz qual vídeo falhou e que o outro ficou guardado: {erro[:160]}")
        ok(pg.locator("[data-testid=video-degravado]").count() == 1, "o vídeo 1 aparece como '✓ degravado'")
        ok(len(st["finais"]) == 0, "a sentença NÃO foi redigida (falta um vídeo)")
        time.sleep(1.5); ok(pg.locator("[data-testid=erro-geracao]").count() == 1, "o erro continua na tela (não some sozinho)")
        # nova tentativa: só o vídeo 2 é refeito
        st["falhar_b"] = False
        pg.click("[data-testid=gerar-sentenca-midia]"); pg.wait_for_function("window.sessao.ler('step') === 'sentence'", timeout=20000)
        ok(st["deg"] == {"a.mp4": 1, "b.mp4": 2}, f"na nova tentativa só o vídeo que faltava foi refeito {st['deg']}")
        ok(len(st["finais"]) == 1 and "degravacaoPronta" in st["finais"][0] and "VÍDEO/ÁUDIO 1 DE 2" in st["finais"][0] and "VÍDEO/ÁUDIO 2 DE 2" in st["finais"][0], "a sentença é redigida com a degravação dos dois vídeos, na ordem")
        ok('name="midias"\r\n\r\n[]' in st["finais"][0], "nenhuma mídia vai junto na etapa da sentença (só texto)")
        ok(pg.locator("[data-testid=erro-geracao]").count() == 0, "o aviso de erro some quando dá certo")
        # autos grandes: tratamento de gigante
        pg.evaluate("() => { window.sessao.definir('step', 'ata'); window.sessao.definir('pdfFullText', 'Petição. ' .repeat(60000)); }")
        pg.wait_for_selector("[data-testid=gerar-sentenca-midia]")
        antes = len(st["finais"]); pg.click("[data-testid=gerar-sentenca-midia]"); pg.wait_for_function("window.__abriu > 0", timeout=20000)
        ok(len(st["finais"]) == antes, "autos grandes NÃO vão pela rota direta (o servidor cortaria o meio)")
        jobs = pg.evaluate("window.gerente.lista().map(j => ({ n: j.nome, direto: !!j.config.direto, instr: j.config.instrucao || '', act: j.config.actType, origem: j.config.origem }))")
        ok(len(jobs) >= 1 and jobs[0]["direto"] and jobs[0]["act"] == "sentenca" and jobs[0]["origem"] == "mutirao", f"criou um trabalho gigante (autos inteiros, em segundo plano) {jobs[:1]}")
        ok("PROVA ORAL" in jobs[0]["instr"] and "VÍDEO/ÁUDIO 2 DE 2" in jobs[0]["instr"], "a degravação segue como prova oral dentro do trabalho gigante")
        ok(not erros, f"sem erros na página {erros}")
        b.close()
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
