"""Janela “Enviar para a calibragem” (marcar como lançado / excluir): perguntas, extensão ausente/antiga, minuta não lançada, seletor de serventia, envio. Rodar: /usr/bin/python3 testes/teste_calibragem_envio.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
LONGO = "<p>DESPACHO</p><p>Registra-se o acordo homologado e o ofício expedido à fonte pagadora. Constatada a ausência do recolhimento das custas finais, proceda-se ao encaminhamento dos autos à Central de Contadores. Cumprida a providência, arquive-se.</p>"
BRIDGE = """(cfg) => {
  window.__ler = []; window.__modoLer = 'ok';
  const marca = () => { if (cfg.ext) { document.documentElement.dataset.assessorExtensao = '3.0.10'; document.documentElement.dataset.assessorExtensaoRecursos = cfg.recursos; } };
  if (document.documentElement) marca(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); marca(); } }).observe(document, { childList: true });
  window.addEventListener('message', (e) => { const d = e.data; if (!d || d.__projudi !== 'minuta-lancada') return;
    const r = (o) => window.postMessage({ __projudiResp: 'minuta-lancada', reqId: d.reqId, ...o }, location.origin);
    if (d.fase === 'serventias') return r({ tipo: 'serventias', serventias: [{ serventia: 'MONTES CLAROS DE GOIAS - VARA DE FAMÍLIA E SUCESSÕES - GO', perfil: 'Assessor de Juiz', url: 'https://projudi.tjgo.jus.br/A' }, { serventia: 'MONTES CLAROS DE GOIAS - JUIZADO ESPECIAL CÍVEL - GO', perfil: 'Assessor de Juiz', url: 'https://projudi.tjgo.jus.br/B' }], sugerida: '' });
    window.__ler.push(d);
    const m = typeof window.__modoLer === 'function' ? window.__modoLer(d) : window.__modoLer;
    setTimeout(() => r(m === 'ok' ? { tipo: 'fim', ok: true, html: """ + json.dumps(LONGO) + """ } : m === 'curta' ? { tipo: 'fim', ok: true, html: '<p>modelo</p>' } : m === 'semeditor' ? { tipo: 'fim', ok: false, erro: 'a tela da pré-análise abriu, mas não achei o editor de texto' } : m === 'naolista' ? { tipo: 'fim', ok: false, erro: 'o processo não apareceu na lista de conclusos desta serventia (última lista lida: não analisadas, 6 linha(s))' } : { tipo: 'fim', ok: false, erro: 'a extensão não respondeu' }), 150); }); }"""
def novo(b, ext=True, recursos="pdf,sv,modelos,minuta-lancada,minuta-serventia", chave=True):
    ctx = b.new_context(viewport={"width": 1100, "height": 900}); pg = ctx.new_page(); pg.posts = []
    pg.add_init_script(f"({BRIDGE})({json.dumps({'ext': ext, 'recursos': recursos})})")
    def rota(r):
        if r.request.url.endswith("/config"): pg.config_pedida = True; return r.fulfill(content_type="application/json", body=json.dumps({"ativo": chave}))
        if r.request.method == "POST": pg.posts.append(json.loads(r.request.post_data or "{}")); return r.fulfill(content_type="application/json", body='{"ok":true,"id":"u-ana-1"}')
        r.fulfill(content_type="application/json", body="{}")
    pg.route("**/api/comparacoes-minuta/**", rota)
    pg.goto("http://127.0.0.1:5198/testes/gigantes/calibragem.html"); pg.wait_for_function("window.pronto"); return pg
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    # 1) a pergunta (marcar como lançado)
    pg = novo(b); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.evaluate("() => { window.pedir('lancado', 'a1'); }"); pg.wait_for_selector("[data-testid=calibragem-janela]")
    t = pg.inner_text("[data-testid=calibragem-janela]")
    ok("administrador do sistema" in t and "lê, no Projudi" in t, "explica: lê a minuta do Projudi + a gerada, para o administrador do sistema")
    ok("muito diferente" in t and "só se" in t and "não precisa enviar" in t, "deixa claro: enviar só se ficou MUITO diferente e o usuário entende que precisa calibrar")
    ok(pg.locator("[data-testid=calibragem-sem-enviar]").get_attribute("class").count("bg-sky-600") == 1 and "Marcar como lançado (não precisa enviar)" in t, "o botão principal é o de NÃO enviar")
    ok("super" not in t.lower(), "não fala em super administrador")
    ok("Ficou muito diferente: enviar para calibragem e marcar como lançado" in t and "Marcar como lançado (não precisa enviar)" in t and "Cancelar" in t and "30 dias" in t, "botões do modo 'lançado' e aviso de 30 dias")
    pg.screenshot(path="/tmp/claude-0/work/teste/calib_pergunta_lancado.png")
    pg.click("[data-testid=calibragem-sem-enviar]"); pg.wait_for_function("window.__desfechos && window.__desfechos.length === 1")
    ok(pg.evaluate("window.__desfechos[0]") == "continuar" and not pg.posts and not pg.evaluate("window.__ler.length"), "'Marcar (não enviar)' continua sem ler nem enviar")
    pg.evaluate("() => { window.pedir('lancado', 'a2'); }"); pg.click("[data-testid=calibragem-cancelar]"); pg.wait_for_function("window.__desfechos.length === 2")
    ok(pg.evaluate("window.__desfechos[1]") == "cancelar", "Cancelar desiste da ação")
    # 2) excluir: textos do modo
    pg.evaluate("() => { window.pedir('excluir', 'a3'); }"); pg.wait_for_selector("[data-testid=calibragem-janela]"); t = pg.inner_text("[data-testid=calibragem-janela]")
    ok("Antes de excluir" in t and "Excluir (não precisa enviar)" in t and "Ficou muito diferente: enviar para calibragem e excluir" in t, "textos do modo 'excluir'")
    pg.screenshot(path="/tmp/claude-0/work/teste/calib_pergunta_excluir.png"); pg.click("[data-testid=calibragem-cancelar]"); pg.wait_for_function("window.__desfechos.length === 3")
    # 3) enviar com sucesso
    pg.evaluate("() => { window.pedir('lancado', 'a4'); }"); pg.click("[data-testid=calibragem-enviar]"); pg.wait_for_selector("[data-testid=calibragem-resultado]:has-text('Pronto')", timeout=10000)
    ok(len(pg.posts) == 1, "enviou 1 comparação")
    c = pg.posts[0]; ok(c["analysisId"] == "a4" and c["motivo"] == "lancado" and "Central de Contadores" in c["textoLancado"] and "Trata-se de ação" in c["textoGerado"] and c["motor"] == "turbo" and c["promptTitulo"] == "Despacho padrão" and c["coberturaPct"] is not None, "envia lançada (do Projudi) + gerada + prompt/motor/id")
    pg.screenshot(path="/tmp/claude-0/work/teste/calib_enviado.png")
    pg.click("[data-testid=calibragem-concluir]"); pg.wait_for_function("window.__desfechos.length === 4"); ok(pg.evaluate("window.__desfechos[3]") == "continuar", "Concluir continua a ação (marcar/excluir)")
    pg.evaluate("() => { window.pedir('excluir', 'a4'); }"); pg.wait_for_function("window.__desfechos.length === 5"); ok(not pg.is_visible("[data-testid=calibragem-janela]"), "ato já enviado: não pergunta de novo")
    # 4) sem minuta lançada (editor com o texto-padrão do modelo) e sem editor
    pg.evaluate("window.__modoLer = 'curta'"); pg.evaluate("() => { window.pedir('lancado', 'a5'); }"); pg.click("[data-testid=calibragem-enviar]"); pg.wait_for_selector("[data-testid=calibragem-resultado]:has-text('não foi lançada')", timeout=10000)
    ok(len(pg.posts) == 1, "texto curto: NÃO envia")
    pg.screenshot(path="/tmp/claude-0/work/teste/calib_sem_minuta.png")
    ok(pg.is_visible("[data-testid=seletor-serventia]") and pg.locator("[data-testid=sel-serventia] option").count() == 3, "oferece escolher a serventia (2 serventias + 'Escolha')")
    # 5) escolher a serventia e tentar de novo: o pedido leva a serventia; agora acha e envia
    pg.evaluate("window.__ler = []; window.__modoLer = (d) => d.serventiaUrl ? 'ok' : 'naolista'; undefined")
    pg.select_option("[data-testid=sel-serventia]", "https://projudi.tjgo.jus.br/B"); pg.click("[data-testid=btn-tentar-serventia]"); pg.wait_for_selector("[data-testid=calibragem-resultado]:has-text('Pronto')", timeout=10000)
    ok(pg.evaluate("window.__ler[0].serventiaUrl") == "https://projudi.tjgo.jus.br/B" and len(pg.posts) == 2, "tentar de novo vai à serventia escolhida e envia")
    pg.click("[data-testid=calibragem-concluir]"); pg.wait_for_function("window.__desfechos.length === 6")
    pg.evaluate("window.__modoLer = 'semeditor'"); pg.evaluate("() => { window.pedir('excluir', 'a6'); }"); pg.click("[data-testid=calibragem-enviar]"); pg.wait_for_selector("[data-testid=calibragem-resultado]:has-text('Nada foi enviado')", timeout=10000)
    ok(len(pg.posts) == 2, "sem editor na pré-análise: não envia"); pg.click("[data-testid=calibragem-concluir]"); pg.wait_for_function("window.__desfechos.length === 7")
    # 6) erro genérico: mostra e permite tentar de novo
    pg.evaluate("window.__modoLer = 'erro'"); pg.evaluate("() => { window.pedir('lancado', 'a7'); }"); pg.click("[data-testid=calibragem-enviar]"); pg.wait_for_selector("[data-testid=calibragem-resultado]:has-text('não respondeu')", timeout=10000)
    ok(pg.is_visible("text=Tentar de novo"), "erro da extensão: mostra e oferece tentar de novo"); pg.click("[data-testid=calibragem-concluir]"); pg.wait_for_function("window.__desfechos.length === 8")
    # 7) fila: dois pedidos seguidos aparecem um de cada vez
    pg.evaluate("() => { window.pedir('lancado', 'f1'); window.pedir('lancado', 'f2'); }"); pg.wait_for_selector("[data-testid=calibragem-janela]"); pg.click("[data-testid=calibragem-sem-enviar]")
    pg.wait_for_timeout(300); ok(pg.is_visible("[data-testid=calibragem-janela]"), "o 2º pedido espera o 1º e aparece depois"); pg.click("[data-testid=calibragem-sem-enviar]")
    # 8) extensão ausente e antiga
    pg2 = novo(b, ext=False); pg2.evaluate("() => { window.pedir('lancado', 'x1'); }"); pg2.click("[data-testid=calibragem-enviar]"); pg2.wait_for_selector("[data-testid=calibragem-resultado]")
    ok("extensão Conclusões Projudi instalada" in pg2.inner_text("[data-testid=calibragem-resultado]") and not pg2.posts, "sem extensão: avisa e não envia")
    pg2.click("[data-testid=calibragem-concluir]"); pg2.wait_for_function("window.__desfechos && window.__desfechos.length === 1"); ok(pg2.evaluate("window.__desfechos[0]") == "continuar", "sem extensão: a ação do usuário continua")
    pg3 = novo(b, recursos="pdf,sv,modelos"); pg3.evaluate("() => { window.pedir('excluir', 'x2'); }"); pg3.click("[data-testid=calibragem-enviar]"); pg3.wait_for_selector("[data-testid=calibragem-resultado]")
    ok("Atualize a extensão" in pg3.inner_text("[data-testid=calibragem-janela]") and "3.0.10" in pg3.inner_text("[data-testid=calibragem-resultado]") and not pg3.posts, "extensão antiga: pede atualizar e não envia")
    pg3.screenshot(path="/tmp/claude-0/work/teste/calib_extensao_antiga.png")
    ok(not pg3.is_visible("[data-testid=seletor-serventia]"), "extensão antiga: sem seletor de serventia")
    pg4 = novo(b, recursos="pdf,sv,modelos,minuta-lancada"); pg4.evaluate("() => { window.pedir('lancado', 'x3'); }"); pg4.click("[data-testid=calibragem-enviar]"); pg4.wait_for_selector("[data-testid=calibragem-resultado]")
    ok("Atualize a extensão" in pg4.inner_text("[data-testid=calibragem-janela]") and not pg4.posts and not pg4.evaluate("window.__ler.length"), "extensão 3.0.6–3.0.9 (sem escolha de serventia): pede atualizar, não lê nem envia")
    # chave geral DESLIGADA: a janela nem aparece e a ação do usuário segue
    pg5 = novo(b, chave=False); pg5.evaluate("() => { window.pedir('lancado', 'off1'); }"); pg5.wait_for_function("window.__desfechos && window.__desfechos.length === 1", timeout=8000)
    ok(pg5.evaluate("window.__desfechos[0]") == "continuar" and not pg5.is_visible("[data-testid=calibragem-janela]") and getattr(pg5, "config_pedida", False), "chave desligada: não pergunta nada e continua a ação")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
