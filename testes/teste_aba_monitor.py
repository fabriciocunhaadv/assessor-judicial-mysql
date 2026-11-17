"""Aba Monitor do Super Admin: mostra uso de IA, erros agrupados e tamanho do banco, só lendo /api/monitor. Rodar: /usr/bin/python3 testes/teste_aba_monitor.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
USO = {"horas": 24, "truncado": False, "execucoes": 12, "tokens": 345000, "custoBrl": 4.2,
       "porModulo": [{"modulo": "gigante", "chamadas": 8, "tokens": 300000, "custoBrl": 3.1}, {"modulo": "lupa_magistrado", "chamadas": 4, "tokens": 45000, "custoBrl": 1.1}],
       "porUsuario": [{"usuario": "juiz@tjgo.jus.br", "chamadas": 9, "tokens": 320000, "modulos": {"gigante": 8, "lupa_magistrado": 1}}],
       "porHora": [{"hora": "2026-11-17T09h", "chamadas": 5, "tokens": 100000}, {"hora": "2026-11-17T10h", "chamadas": 7, "tokens": 245000}],
       "porModelo": [{"modelo": "gemini-3.6-flash", "chamadas": 12, "tokens": 345000}],
       "maiores": [{"quando": "2026-11-17T10:05:00Z", "rotulo": "Processo gigante: leitura de um trecho", "tokens": 90000, "modulo": "gigante", "usuario": "juiz@tjgo.jus.br"}]}
SAUDE = {"grupos": [{"tipo": "ia", "modulo": "esteira", "severidade": "erro", "mensagem": "Esteira de IA esgotada sem resultado: cota do Google", "ocorrencias": 129, "primeiro": "2026-11-16T18:01:28Z", "ultimo": "2026-11-16T20:00:59Z", "usuarios": 0}], "porHora": []}
BANCO = {"tabelas": [{"nome": "docs", "linhasAprox": 52000, "mb": 380.5}], "colecoes": [{"colecao": "gabinetes/g1/usageLogs", "docs": 9000, "ultimaAlteracao": "2026-11-17T10:00:00Z"}]}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 1400, "height": 1000}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pedidos = []
    def rota(r):
        u = r.request.url; pedidos.append((r.request.method, u))
        corpo = USO if "/uso" in u else SAUDE if "/saude" in u else BANCO
        r.fulfill(content_type="application/json", body=json.dumps(corpo))
    pg.route("**/api/monitor/**", rota)
    pg.goto("http://127.0.0.1:5198/testes/gigantes/monitor.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=monitor-cartoes]", timeout=15000)
    t = pg.inner_text("[data-testid=painel-monitor]")
    ok("345.000" in t and "R$" in t and "12" in t, "cartões: execuções, tokens e custo")
    ok("gigante" in t and "juiz@tjgo.jus.br" in t, "uso por módulo e por usuário")
    ok("Processo gigante: leitura de um trecho" in t, "maiores execuções")
    ok("cota do Google" in pg.inner_text("[data-testid=monitor-saude]") and "129" in pg.inner_text("[data-testid=monitor-saude]"), "erros agrupados com a contagem")
    ok("docs" in pg.inner_text("[data-testid=monitor-banco]") and "usageLogs" in pg.inner_text("[data-testid=monitor-banco]"), "tabelas e coleções do banco")
    ok(pg.locator("[data-testid=monitor-grafico] > div").count() == 2, "gráfico de tokens por hora (2 barras)")
    ok(all(m == "GET" for m, _ in pedidos) and len(pedidos) >= 3, f"só GETs, nada é gravado ({len(pedidos)} pedidos)")
    pg.select_option("[data-testid=monitor-periodo]", "168"); pg.wait_for_timeout(800)
    ok(any("horas=168" in u for _, u in pedidos), "trocar o período pede 7 dias")
    pg.screenshot(path="/tmp/claude-0/work/teste/aba_monitor.png", full_page=True)
    pg.unroute("**/api/monitor/**"); pg.route("**/api/monitor/**", lambda r: r.fulfill(status=404, content_type="application/json", body='{"erro":"monitor desligado"}'))
    pg.click("[data-testid=monitor-atualizar]"); pg.wait_for_selector("[data-testid=monitor-erros]", timeout=10000)
    ok("monitor desligado" in pg.inner_text("[data-testid=monitor-erros]"), "falha do monitor aparece como aviso, sem quebrar a tela")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
