"""Retomada de análise que ficou no servidor: o painel mostra o CARTÃO de progresso (etapa, %, tempo), explica o que acontece, tem "Parar de aguardar"; ao terminar, a minuta aparece e vai ao Histórico.
Rodar: /usr/bin/python3 testes/gigantes/teste_cartao_retomada.py (sobe o servidor, o Gemini de mentira e o Vite)."""
import glob, json, os, subprocess, sys, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
PM, PS, PV = 8897, 3000, 5198
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
def esperar_http(url, n=120):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
MINUTA = {"minute": {"title": "DESPACHO", "header": "VARA ÚNICA", "processNumber": "5221961-78.2026.8.09.0166", "judicialUnit": "Vara Única", "parties": {"author": "AUTORA RETOMADA", "defendant": "REU RETOMADO"}, "relatorio": "Relatório da análise retomada.", "fundamentacao": "Fundamentação da análise retomada.", "dispositivo": "Cumpra-se."}, "auditAnalysis": {"fatoVsProva": [], "regularidadeDocumental": {}, "competenciaCheck": {}, "normasAplicadas": [], "alertasProcessuais": []}}
def main():
    procs = []
    try:
        procs.append(subprocess.Popen([sys.executable, os.path.join(AQUI, "mock_gemini.py"), str(PM), "250000", "3000"], start_new_session=True))
        env = {**os.environ, "GOOGLE_GEMINI_BASE_URL": f"http://127.0.0.1:{PM}", "NODE_ENV": "production", "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"}
        os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
        procs.append(subprocess.Popen(["npx", "tsx", "server.ts"], cwd=RAIZ, env=env, stdout=open("/tmp/claude-0/work/teste/server_cr.log", "w"), stderr=subprocess.STDOUT, start_new_session=True))
        procs.append(subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_cr.log", "w"), stderr=subprocess.STDOUT, start_new_session=True))
        esperar_http(f"http://127.0.0.1:{PS}/api/native-key-info"); esperar_http(f"http://127.0.0.1:{PV}/")
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
            def abrir():
                pg = b.new_page(viewport={"width": 1300, "height": 950}); pg.set_default_timeout(30000); pg.erros = []; pg.on("pageerror", lambda e: pg.erros.append(str(e)[:200]))
                pend = {"progId": "prog-ana-1", "tipo": "analise", "iniciadoEm": int(time.time() * 1000), "uid": "teste-uid", "promptTitle": "Outros Área Judicial - Família e Sucessões", "processNumber": "5221961-78.2026.8.09.0166", "unitId": "montes_claros"}
                perfil = {"uid": "teste-uid", "email": "assessor@teste.gov.br", "name": "Assessor de Teste", "role": "admin", "isActive": True, "tenantId": "gab_teste", "createdAt": 1700000000000, "allowedUnits": ["montes_claros"], "canUseNativeKey": True, "completedTours": []}
                pg.route("**/api/auth/me", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"perfil": perfil})))
                pg.add_init_script("localStorage.setItem('assessor_sessao_v1','token-de-teste'); localStorage.setItem('assessor_tour_off','1'); localStorage.setItem('assessor_analise_pendente', " + json.dumps(json.dumps(pend)) + ");")
                pg.pronta = False
                def resultado(r):
                    if pg.pronta: return r.fulfill(status=200, content_type="application/json", body=json.dumps({"pronto": True, "status": 200, "body": "   " + json.dumps(MINUTA)}))
                    r.fulfill(status=200, content_type="application/json", body=json.dumps({"pronto": False, "andamento": {"texto": "Etapa 1 — o Google está sobrecarregado: aguardando 93s por um modelo completo", "decorridoSeg": 36}}))
                pg.route("**/api/resultado/**", resultado)
                pg.route("**/api/progresso/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"texto": "Etapa 1 — o Google está sobrecarregado: aguardando 93s por um modelo completo", "pct": 30, "teto": 55, "idadeSeg": 1})))
                pg.goto(f"http://127.0.0.1:{PV}/"); return pg
            # 1) o cartão aparece no painel durante a retomada
            pg = abrir()
            try: pg.wait_for_selector("[data-testid=cartao-retomada]", timeout=40000)
            except Exception:
                print("DEBUG corpo:", pg.inner_text("body")[:700].replace("\n", " | ")); print("DEBUG pendente:", pg.evaluate("localStorage.getItem('assessor_analise_pendente')")); print("DEBUG erros:", pg.erros); pg.screenshot(path="/tmp/claude-0/work/teste/cartao_debug.png"); raise
            t = pg.inner_text("[data-testid=cartao-retomada]")
            ok("Retomando a análise que ficou no servidor" in t.replace("RETOMANDO A ANÁLISE QUE FICOU NO SERVIDOR", "Retomando a análise que ficou no servidor") or "RETOMANDO A ANÁLISE QUE FICOU NO SERVIDOR" in t.upper(), "o cartão tem o título da retomada")
            pg.wait_for_function("() => document.querySelector('[data-testid=cartao-retomada]').innerText.includes('aguardando 93s')", timeout=15000)
            t = pg.inner_text("[data-testid=cartao-retomada]")
            ok("aguardando 93s" in t and "%" in t and ":" in t, "mostra a etapa, a porcentagem e o tempo")
            ok("já estava rodando no servidor" in pg.inner_text("[data-testid=retomada-explicacao]") and "Histórico" in pg.inner_text("[data-testid=retomada-explicacao]"), "explica o que está acontecendo")
            ok(pg.locator("[data-testid=retomada-parar]").count() == 1, "tem o botão Parar de aguardar")
            pg.screenshot(path="/tmp/claude-0/work/teste/cartao_retomada.png")
            # 2) a análise termina no servidor: o cartão some, a minuta aparece e vai ao Histórico
            pg.pronta = True
            pg.wait_for_function("() => document.body.innerText.includes('Análise recuperada')", timeout=30000)
            ok(pg.locator("[data-testid=cartao-retomada]").count() == 0, "ao terminar o cartão some")
            pg.wait_for_function("() => document.body.innerText.includes('AUTORA RETOMADA') || document.body.innerText.includes('Relatório da análise retomada')", timeout=15000); ok(True, "a minuta recuperada aparece na tela")
            ok(pg.evaluate("localStorage.getItem('assessor_analise_pendente')") is None, "o marcador de pendência foi apagado")
            ok(not pg.erros, f"sem erros de página: {pg.erros[:2]}"); pg.close()
            # 3) Parar de aguardar: o cartão some e o marcador é apagado
            pg = abrir(); pg.wait_for_selector("[data-testid=retomada-parar]", timeout=40000); pg.click("[data-testid=retomada-parar]")
            pg.wait_for_function("() => !document.querySelector('[data-testid=cartao-retomada]')", timeout=10000); ok(True, "Parar de aguardar tira o cartão")
            ok(pg.evaluate("localStorage.getItem('assessor_analise_pendente')") is None, "e apaga o marcador (não busca mais)")
            pg.close(); b.close()
        print("FALHAS:", falhas)
    finally:
        for pr in procs:
            try: os.killpg(pr.pid, 9)
            except Exception: pass
    raise SystemExit(1 if falhas else 0)
if __name__ == "__main__": main()
