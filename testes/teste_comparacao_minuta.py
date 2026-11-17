"""Botão “Buscar minuta lançada” (só Super Admin) e a janela de comparação. Rodar: /usr/bin/python3 testes/teste_comparacao_minuta.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
LANCADO = "<p>SENTENÇA</p><p>I - RELATÓRIO</p><p>Relatório de teste.</p><p>II - FUNDAMENTAÇÃO</p><p>Parágrafo 1 da fundamentação: texto da minuta texto da minuta, com um acréscimo do assessor.</p><p>Parágrafo 2 da fundamentação: texto da minuta que o assessor reescreveu por inteiro de outro jeito.</p><p>III - DISPOSITIVO</p><p>Julgo improcedente.</p><p>Goiânia, data do sistema</p>"
BRIDGE = """(modo) => { document.documentElement.dataset.assessorExtensao = '3.0.6'; document.documentElement.dataset.assessorExtensaoRecursos = modo === 'antiga' ? 'pdf,sv' : 'pdf,sv,modelos,modelos-atualizar,minuta-lancada';
  window.__pedidos = [];
  window.addEventListener('message', (e) => { const d = e.data; if (!d || d.__projudi !== 'minuta-lancada') return; window.__pedidos.push(d);
    const r = (o) => window.postMessage({ __projudiResp: 'minuta-lancada', reqId: d.reqId, ...o }, location.origin);
    r({ tipo: 'progresso', texto: 'abrindo a pré-análise…' });
    setTimeout(() => r(window.__falhar ? { tipo: 'fim', ok: false, erro: 'não achei o editor de texto', tela: 'Pré-Analisar Autos Conclusos' } : { tipo: 'fim', ok: true, html: window.__html }), 250); }); }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    # 1) sem ser Super Admin: o botão nem existe
    pg = b.new_page(viewport={"width": 1500, "height": 1000}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true}'))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/minuta.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=barra-acoes-minuta]")
    ok(pg.locator("[data-testid=btn-buscar-minuta-lancada]").count() == 0, "usuário comum NÃO vê o botão “Buscar minuta lançada”")
    pg.close()
    # 2) Super Admin: vê o botão, clica, a extensão (simulada) devolve o texto e a comparação aparece
    pg = b.new_page(viewport={"width": 1500, "height": 1000}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    posts = []
    def api(r):
        if "/api/comparacoes-minuta" in r.request.url and r.request.method == "POST": posts.append(json.loads(r.request.post_data or "{}"))
        r.fulfill(content_type="application/json", body='{"ok":true,"id":"x"}')
    pg.route("**/api/**", api)
    pg.goto("http://127.0.0.1:5198/testes/gigantes/minuta.html?super=1"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=btn-buscar-minuta-lancada]")
    pg.evaluate(BRIDGE, "ok"); pg.evaluate("(h) => { window.__html = h; window.__falhar = false; }", LANCADO)
    pg.click("[data-testid=btn-buscar-minuta-lancada]")
    pg.wait_for_selector("[data-testid=comparacao-resumo]", timeout=15000)
    t = pg.inner_text("[data-testid=modal-comparacao-minuta]")
    ped = pg.evaluate("window.__pedidos[0]")
    ok(ped and ped["processo"] == "5914870-27.2025.8.09.0166" and ped["fase"] == "ler", f"pediu à extensão o processo certo: {ped and ped['processo']}")
    ok("aproveitamento" in t.lower() and "%" in t, "mostra o aproveitamento")
    ok(pg.locator("[data-testid=comparacao-dispositivo-mudou]").count() == 1, "sinaliza que o dispositivo mudou (procedente → improcedente)")
    ok("relatório" in pg.inner_text("[data-testid=comparacao-secoes]").lower() and "fundamentação" in pg.inner_text("[data-testid=comparacao-secoes]").lower(), "aproveitamento por seção")
    ok("ALTERADO" in pg.inner_text("[data-testid=comparacao-blocos]") or "CORTADO" in pg.inner_text("[data-testid=comparacao-blocos]"), "lista o que foi alterado ou cortado")
    pg.wait_for_function("document.body.innerText.includes('Comparação guardada')", timeout=5000)
    ok(len(posts) == 1 and posts[0]["processo"] == "5914870-27.2025.8.09.0166" and posts[0]["textoLancado"].startswith("Relatório") is False and "aproveitamentoPct" in posts[0] and isinstance(posts[0].get("mudancas"), list) and "blocos" not in posts[0], "guarda a comparação (números, mudanças curtas e o texto lançado) no servidor")
    pg.screenshot(path="/tmp/claude-0/work/teste/comparacao_minuta.png", full_page=True)
    pg.click("[aria-label=Fechar]")
    # 3) falha da extensão: mensagem + diagnóstico + tentar de novo
    pg.evaluate("() => { window.__falhar = true; }")
    pg.click("[data-testid=btn-buscar-minuta-lancada]"); pg.wait_for_selector("[data-testid=comparacao-erro]", timeout=15000)
    e = pg.inner_text("[data-testid=comparacao-erro]")
    ok("não achei o editor" in e and "Tentar de novo" in e and "diagnóstico" in e, "erro claro, com diagnóstico e “Tentar de novo”")
    pg.evaluate("() => { window.__falhar = false; }"); pg.click("text=Tentar de novo"); pg.wait_for_selector("[data-testid=comparacao-resumo]", timeout=15000)
    ok(True, "“Tentar de novo” funciona")
    pg.click("[aria-label=Fechar]")
    # 4) editor veio só com o modelo (texto curto): avisa em vez de comparar
    pg.evaluate("(h) => { window.__html = h; }", "<p>DECISÃO</p><p>MCG, data do sistema</p>")
    pg.click("[data-testid=btn-buscar-minuta-lancada]"); pg.wait_for_selector("[data-testid=comparacao-erro]", timeout=15000)
    ok("quase vazio" in pg.inner_text("[data-testid=comparacao-erro]"), "editor só com o modelo-padrão: avisa para salvar o texto parcial")
    pg.click("[aria-label=Fechar]")
    # 5) extensão antiga
    pg.evaluate("() => { document.documentElement.dataset.assessorExtensaoRecursos = 'pdf,sv'; }")
    pg.click("[data-testid=btn-buscar-minuta-lancada]"); pg.wait_for_selector("[data-testid=comparacao-erro]", timeout=10000)
    ok("3.0.6" in pg.inner_text("[data-testid=comparacao-erro]"), "extensão antiga: pede atualizar para a 3.0.6")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
