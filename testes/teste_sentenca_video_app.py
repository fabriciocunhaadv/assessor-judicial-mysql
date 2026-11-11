"""Lado do app da sentença com vídeo: recebe PDF e vídeos em partes (pela ponte), lê os autos, monta a ata, envia as mídias, pede a sentença e devolve o resultado.
Rodar: /usr/bin/python3 testes/teste_sentenca_video_app.py"""
import base64, glob, json, os, subprocess, sys, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.join(RAIZ, "testes", "gigantes"))
from gerar_pdf import pdf as gerar
from playwright.sync_api import sync_playwright
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
AUTOS = gerar(["Petição inicial. O autor pede auxílio por incapacidade temporária. " * 12, "Contestação do INSS. Impugna a incapacidade alegada e requer a produção de prova pericial. " * 12])
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_sv.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/sv.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(); chamadas = []; erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        def api(rota):
            u = rota.request.url; chamadas.append((rota.request.method, u.split("5198")[1][:60]))
            if "/api/mutirao-extract-ata" in u: rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "data": {"processNumber": "5428441-88.2026.8.09.0166", "author": "EZIO BORGES SANTOS", "defendant": "INSS", "ataText": "ATA prévia"}}))
            elif "/api/mutirao-midia/parte" in u: rota.fulfill(content_type="application/json", body='{"ok":true}')
            elif "/api/mutirao-video" in u:
                corpo = rota.request.post_data_buffer or b""; chamadas.append(("corpo", "midias" if b"midias" in corpo else "sem-midias"))
                chamadas.append(("tem-prompt", "PROMPT DO JUIZ" in corpo.decode("latin1")))
                rota.fulfill(content_type="application/json", body=json.dumps({"success": True, "usage": {"totalTokenCount": 100}, "data": {"transcription": "[00:10] Testemunha 1: conheço a autora.", "sentenceText": "SENTENÇA. Julgo procedente o pedido."}}))
            elif "/api/progresso/" in u: rota.fulfill(content_type="application/json", body="{}")
            elif "/api/resultado/" in u: rota.fulfill(content_type="application/json", body='{"desconhecido":true}')
            else: rota.fulfill(content_type="application/json", body='{"ok":true,"success":true,"items":[],"docs":[],"data":null}')
        pg.route("**/api/**", api)
        pg.goto("http://127.0.0.1:5198/testes/gigantes/sv.html"); pg.wait_for_function("window.pronto")
        assert pg.evaluate("document.documentElement.dataset.assessorSentencaVideo") == "1", "o Studio avisa que sabe fazer"
        pg.evaluate("""() => { document.documentElement.dataset.assessorAuto = '1'; window.__r = []; window.addEventListener('message', (e) => { if (e.data && e.data.__projudiResp === 'sv') window.__r.push(e.data); }); }""")
        enviar = lambda o: pg.evaluate("(o) => window.postMessage({ __projudi: 'sv', reqId: 'R1', ...o }, location.origin)", o)
        b64 = lambda bs: base64.b64encode(bs).decode()
        def partes(idx, nome, tipo, dados, tam=6000):
            for n in range(max(1, -(-len(dados) // tam))): enviar({"fase": "parte", "idx": idx, "n": n, "dados": b64(dados[n * tam:(n + 1) * tam]), "nome": nome, "tipo": tipo})
        partes(0, "5428441-OCR.pdf", "application/pdf", AUTOS); partes(1, "testemunha1.mp4", "video/mp4", bytes(20000)); partes(2, "testemunha2.webm", "video/webm", bytes(9000))
        pg.wait_for_function("window.__r.filter(r => r.tipo === 'parte-ok').length >= 5", timeout=10000)
        enviar({"fase": "iniciar", "processo": "5428441-88.2026.8.09.0166", "pdfIdx": 0, "videosIdx": [1, 2], "promptTitulo": "Previdenciário", "promptTexto": "PROMPT DO JUIZ", "promptCategoria": "previdenciario"})
        pg.wait_for_function("window.__r.some(r => r.tipo === 'resultado')", timeout=90000)
        res = pg.evaluate("window.__r.filter(r => r.tipo === 'resultado')[0]"); print({k: (v if k != 'minuta' else v[:40]) for k, v in res.items()})
        andamentos = [r["texto"] for r in pg.evaluate("window.__r") if r["tipo"] == "andamento"]; print(andamentos)
        assert res["ok"] and res["minuta"].startswith("SENTENÇA") and "conheço a autora" in res["transcricao"] and res["processo"] == "5428441-88.2026.8.09.0166", res
        assert res["autor"] == "EZIO BORGES SANTOS" and res["historicoId"], res
        partes_enviadas = [c for c in chamadas if isinstance(c[1], str) and c[1].startswith("/api/mutirao-midia/parte")]
        assert len(partes_enviadas) == 2, "as duas mídias foram enviadas ao servidor em partes: " + str(len(partes_enviadas))
        assert ("corpo", "midias") in chamadas and ("tem-prompt", True) in chamadas, "o servidor recebe a lista de mídias e o prompt escolhido"
        assert any("Lendo os autos" in a for a in andamentos) and any("ata" in a.lower() for a in andamentos) and any("Mídia 2 de 2" in a for a in andamentos), andamentos
        assert not erros, erros
        # arquivos incompletos: erro claro, sem rodar
        enviar({"fase": "parte", "reqId": "R2", "idx": 0, "n": 0, "dados": b64(b"x"), "nome": "a.pdf", "tipo": "application/pdf"}) if False else None
        pg.evaluate("() => window.postMessage({ __projudi: 'sv', reqId: 'R2', fase: 'iniciar', processo: '1', pdfIdx: 0, videosIdx: [1] }, location.origin)")
        pg.wait_for_function("window.__r.some(r => r.reqId === 'R2' && r.tipo === 'resultado')", timeout=10000)
        r2 = pg.evaluate("window.__r.filter(r => r.reqId === 'R2' && r.tipo === 'resultado')[0]"); assert not r2["ok"] and "não recebeu os arquivos" in r2["erro"], r2
        b.close()
    print("OK sentença com vídeo (lado do app)")
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
