"""Upload de PDF no Studio: tratado pela extensão; sem extensão bloqueia com o link (só o celular segue sem ela). Rodar: /usr/bin/python3 testes/teste_upload_extensao.py <pdf>"""
import glob, json, os, subprocess, sys, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
PDF = open(sys.argv[1], "rb").read() if len(sys.argv) > 1 else None
LINK = "https://chromewebstore.google.com/detail/conclus%C3%B5es-projudi/ioiadaafdnannofgkoioefhejkpmlgpe?hl=pt-BR"
# extensão de mentira: responde ao protocolo do script do Studio (início, partes, fim) e devolve andamento + resultado
FALSA = """(() => { const cmd = window.__modoFalso || 'ok'; const resp = (o) => window.postMessage({ __projudiResp: 'pdf-tratar', ...o }, location.origin); const recebidos = {}; window.__partes = 0;
  window.addEventListener('message', (e) => { const d = e.data; if (e.source !== window || !d || d.__projudi !== 'pdf-tratar') return;
    if (d.fase === 'inicio') resp({ id: d.id, tipo: 'pronto' });
    else if (d.fase === 'parte') { window.__partes++; resp({ id: d.id, tipo: 'parte-ok', n: d.n }); }
    else if (d.fase === 'fim') { resp({ id: d.id, tipo: 'fim-ok' }); resp({ id: d.id, tipo: 'progresso', etapa: 'OCR nas páginas de imagem', feitas: 1, total: 2 });
      setTimeout(() => resp(window.__falhar ? { id: d.id, tipo: 'resultado', ok: false, erro: 'OCR falhou' } : { id: d.id, tipo: 'resultado', ok: true, texto: '[Página 1 de 2]\\nTexto normal.\\n\\n[Página 2 de 2]\\nTEXTO LIDO POR OCR NA EXTENSAO', paginas: 2, ocr: 1, paginasOcr: [2], puladas: [], segundos: 1 }), 150); } }); })();"""
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_up.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(90):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/upload.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
            arq = {"name": "autos.pdf", "mimeType": "application/pdf", "buffer": PDF}
            def abrir(ua=None, com_ext=False, auto=False, falhar=False):
                ctx = b.new_context(viewport={"width": 1100, "height": 800}, **({"user_agent": ua} if ua else {})); pg = ctx.new_page(); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
                ini = ""
                if com_ext: ini += "document.documentElement.dataset.assessorExtensao='1.0.99'; document.documentElement.dataset.assessorExtensaoRecursos='pdf';"
                if auto: ini += "document.documentElement.dataset.assessorAuto='1';"
                ini = "document.addEventListener('DOMContentLoaded', () => { " + ini + " });" + ("window.__falhar = true;" if falhar else "")
                pg.add_init_script(ini + FALSA); pg.goto("http://127.0.0.1:5198/testes/gigantes/upload.html"); pg.wait_for_timeout(800)
                return ctx, pg
            # 1) computador SEM extensão: bloqueia, mostra o link, não adiciona nada
            ctx, pg = abrir(); pg.set_input_files("input[type=file]", files=[arq]); pg.wait_for_selector("[data-testid=aviso-instalar-extensao]", timeout=15000)
            assert pg.get_attribute("[data-testid=link-instalar-extensao]", "href") == LINK, "link da loja"
            assert pg.evaluate("window.__adicionados.length") == 0, "nada é adicionado sem a extensão"
            assert "Instale a extensão" in pg.inner_text("[data-testid=aviso-instalar-extensao]") and "F5" in pg.inner_text("[data-testid=aviso-instalar-extensao]")
            pg.click("[data-testid=btn-tentar-de-novo]"); pg.wait_for_selector("[data-testid=extensao-ainda-nao]", timeout=10000)
            pg.screenshot(path="/tmp/claude-0/work/teste/upload_bloqueio.png")
            # a pessoa instalou e recarregou: a extensão passa a existir; "tentar de novo" processa o arquivo guardado
            pg.evaluate("document.documentElement.dataset.assessorExtensao='1.0.99'; document.documentElement.dataset.assessorExtensaoRecursos='pdf';")
            pg.click("[data-testid=btn-tentar-de-novo]"); pg.wait_for_function("window.__adicionados.length === 1", timeout=30000)
            a = pg.evaluate("window.__adicionados[0]"); assert "TEXTO LIDO POR OCR NA EXTENSAO" in a["extractedText"] and a["pageCount"] == 2 and a["paginasOcr"] == [2] and not a.get("base64"), a.keys()
            ctx.close()
            # 2) com a extensão: o texto vem dela, o PDF não segue (sem base64) e o arquivo foi enviado em partes
            ctx, pg = abrir(com_ext=True); pg.set_input_files("input[type=file]", files=[arq]); pg.wait_for_function("window.__adicionados.length === 1", timeout=30000)
            a = pg.evaluate("window.__adicionados[0]"); assert "TEXTO LIDO POR OCR NA EXTENSAO" in a["extractedText"] and not a.get("base64") and pg.evaluate("window.__partes") >= 1
            assert pg.locator("[data-testid=aviso-instalar-extensao]").count() == 0; ctx.close()
            # 3) celular SEM extensão: não bloqueia; o Studio lê o PDF sozinho
            ctx, pg = abrir(ua="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"); pg.set_input_files("input[type=file]", files=[arq]); pg.wait_for_function("window.__adicionados.length === 1", timeout=60000)
            a = pg.evaluate("window.__adicionados[0]"); assert "alimentos" in a["extractedText"].lower() and pg.locator("[data-testid=aviso-instalar-extensao]").count() == 0 and pg.evaluate("window.__partes") == 0, "celular: leitura do próprio Studio"; ctx.close()
            # 4) esteira da extensão (automático): não trata de novo
            ctx, pg = abrir(com_ext=True, auto=True); pg.set_input_files("input[type=file]", files=[arq]); pg.wait_for_function("window.__adicionados.length === 1", timeout=60000)
            assert pg.evaluate("window.__partes") == 0, "esteira: sem novo tratamento"; ctx.close()
            # 5) a extensão falha: aviso e o Studio lê o arquivo sozinho (não trava o usuário)
            ctx, pg = abrir(com_ext=True, falhar=True); pg.set_input_files("input[type=file]", files=[arq]); pg.wait_for_function("window.__adicionados.length === 1", timeout=60000)
            a = pg.evaluate("window.__adicionados[0]"); assert "alimentos" in a["extractedText"].lower(), "fallback do Studio"; assert "OCR falhou" in pg.inner_text("body"); ctx.close()
            b.close()
        assert not erros, erros[:3]; print("OK upload com extensão")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
