"""“Refazer só com alguns eventos”: botão só no motor principal, janela com a extensão simulada (progresso, janela aberta, serventia a escolher, extensão antiga) e aviso de versão. Rodar: /usr/bin/python3 testes/teste_refazer_parcial_ui.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
SV = "https://projudi.tjgo.jus.br/Usuario?PaginaAtual=2&Id_Serventia=999"
BRIDGE = """(cfg) => {
  window.__refazer = [];
  const marca = () => { if (cfg.ext) { document.documentElement.dataset.assessorExtensao = cfg.versao; document.documentElement.dataset.assessorExtensaoRecursos = cfg.recursos; } };
  if (document.documentElement) marca(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); marca(); } }).observe(document, { childList: true });
  window.__modo = 'ok';
  window.addEventListener('message', (e) => { const d = e.data; if (!d) return;
    if (d.__projudi === 'minuta-lancada' && d.fase === 'serventias') return window.postMessage({ __projudiResp: 'minuta-lancada', reqId: d.reqId, tipo: 'serventias', serventias: [{ serventia: 'MONTES CLAROS DE GOIAS - VARA DE FAMÍLIA - GO', perfil: 'Assessor de Juiz', url: '""" + SV + """' }], sugerida: '' }, location.origin);
    if (d.__projudi !== 'refazer-parcial') return; window.__refazer.push(d);
    const r = (o) => window.postMessage({ __projudiResp: 'refazer-parcial', reqId: d.reqId, ...o }, location.origin);
    r({ tipo: 'progresso', texto: 'Entrando na serventia no Projudi…' });
    setTimeout(() => {
      if (window.__modo === 'serventia' && !d.serventiaUrl) return r({ tipo: 'fim', ok: false, precisaServentia: true, erro: 'Não sei em qual serventia do Projudi está este processo. Escolha a serventia.' });
      if (window.__modo === 'erro') return r({ tipo: 'fim', ok: false, erro: 'Não achei o botão “Gerar PDF” no processo.' });
      r({ tipo: 'fim', ok: true, texto: 'A janela “Gerar PDF” do Projudi está aberta' }); }, 300); }); }"""
def novo(b, url, ext=True, versao="4.0.0", recursos="pdf,sv,modelos,minuta-lancada,minuta-serventia,refazer-parcial", super_=False):
    pg = b.new_page(viewport={"width": 1500, "height": 1000}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.add_init_script(f"({BRIDGE})({json.dumps({'ext': ext, 'versao': versao, 'recursos': recursos})})")
    pg.route("**/api/**", lambda r: r.fulfill(content_type="application/json", body='{"ok":true}'))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/refazer.html" + url); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=barra-acoes-minuta]"); return pg
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    # 1) o botão: só no motor principal
    for motor, quer in (("principal", 1), ("turbo", 0), ("gigante", 0), ("agaia", 0)):
        pg = novo(b, f"?motor={motor}"); pg.wait_for_timeout(600)
        ok(pg.locator("[data-testid=btn-refazer-parcial]").count() == quer, f"motor {motor}: botão {'aparece' if quer else 'NÃO aparece'}")
        if motor == "principal": btn = pg.locator("[data-testid=btn-refazer-parcial]"); ok("Refazer só com alguns eventos" in btn.inner_text() and "from-amber-400" in btn.get_attribute("class"), "botão destacado, com o nome combinado"); ok(not pg.locator("[data-testid=dica-refazer-parcial]").is_visible(), "a janelinha de informação começa escondida"); btn.hover(); pg.wait_for_selector("[data-testid=dica-refazer-parcial]", state="visible", timeout=3000); d = pg.inner_text("[data-testid=dica-refazer-parcial]"); ok("só algumas movimentações" in d and "nova versão" in d and "continua guardada" in d and "fato anterior" in d, "passar o mouse abre a janelinha explicando o botão"); pg.screenshot(path="/tmp/claude-0/work/teste/refazer_botao.png"); pg.mouse.move(5, 5); pg.wait_for_selector("[data-testid=dica-refazer-parcial]", state="hidden", timeout=3000); ok(True, "tirar o mouse fecha a janelinha")
        pg.close()
    # 2) fluxo feliz
    pg = novo(b, "?motor=principal"); pg.wait_for_selector("[data-testid=btn-refazer-parcial]"); pg.click("[data-testid=btn-refazer-parcial]")
    pg.wait_for_selector("[data-testid=refazer-aberto]", timeout=10000)
    ped = pg.evaluate("window.__refazer[0]")
    ok(ped and ped["processo"] == "5914870-27.2025.8.09.0166" and ped["de"] == "ana-1" and "Família e Sucessões" in ped["prompt"] and ped["fase"] == "iniciar", f"pediu à extensão processo, minuta de origem e prompt certos: {ped}")
    t = pg.inner_text("[data-testid=modal-refazer-parcial]")
    ok("marque só as movimentações" in t and "Devolver ao Studio e refazer a minuta" in t and "versão 2" in t and "continua guardada" in t and "fato antigo" in t, "explica o passo a passo e o limite (fato antigo)")
    ok("super" not in t.lower(), "não fala em super admin")
    pg.screenshot(path="/tmp/claude-0/work/teste/refazer_aberto.png"); pg.click("[data-testid=refazer-ok]"); ok(pg.locator("[data-testid=modal-refazer-parcial]").count() == 0, "fecha")
    pg.close()
    # 3) serventia: a extensão não sabe; o usuário escolhe e a extensão recebe a serventia
    pg = novo(b, "?motor=principal"); pg.evaluate("() => { window.__modo = 'serventia'; }"); pg.click("[data-testid=btn-refazer-parcial]")
    pg.wait_for_selector("[data-testid=seletor-serventia]", timeout=10000)
    ok("Escolha a serventia" in pg.inner_text("[data-testid=refazer-erro]") or "serventia" in pg.inner_text("[data-testid=refazer-erro-texto]").lower(), "pede a serventia quando a extensão não achou")
    pg.screenshot(path="/tmp/claude-0/work/teste/refazer_serventia.png")
    pg.select_option("[data-testid=sel-serventia]", SV); pg.click("[data-testid=btn-tentar-serventia]"); pg.wait_for_selector("[data-testid=refazer-aberto]", timeout=10000)
    ok(pg.evaluate("window.__refazer.length") == 2 and pg.evaluate("window.__refazer[1].serventiaUrl") == SV, "refez o pedido já com a serventia escolhida")
    pg.close()
    # 4) erro comum: tentar de novo
    pg = novo(b, "?motor=principal"); pg.evaluate("() => { window.__modo = 'erro'; }"); pg.click("[data-testid=btn-refazer-parcial]"); pg.wait_for_selector("[data-testid=refazer-tentar]", timeout=10000)
    ok("Gerar PDF" in pg.inner_text("[data-testid=refazer-erro-texto]"), "mostra o erro da extensão")
    pg.evaluate("() => { window.__modo = 'ok'; }"); pg.click("[data-testid=refazer-tentar]"); pg.wait_for_selector("[data-testid=refazer-aberto]", timeout=10000); ok(True, "tentar de novo funciona")
    pg.close()
    # 5) extensão antiga / sem extensão
    pg = novo(b, "?motor=principal", versao="3.0.10", recursos="pdf,sv,modelos,minuta-lancada,minuta-serventia"); pg.click("[data-testid=btn-refazer-parcial]"); pg.wait_for_selector("[data-testid=refazer-erro]")
    ok("4.0.0" in pg.inner_text("[data-testid=refazer-erro-texto]") and pg.evaluate("window.__refazer.length") == 0, "extensão antiga: manda atualizar (4.0.0) e não pede nada")
    pg.close()
    pg = novo(b, "?motor=principal", ext=False); pg.click("[data-testid=btn-refazer-parcial]"); pg.wait_for_selector("[data-testid=refazer-erro]")
    ok("Instale a extensão" in pg.inner_text("[data-testid=refazer-erro-texto]"), "sem extensão: manda instalar")
    pg.close()
    # 6) a nova versão: aviso com a faixa
    pg = novo(b, "?motor=principal&versao=2"); pg.wait_for_selector("[data-testid=aviso-versao-parcial]", timeout=8000)
    t = pg.inner_text("[data-testid=aviso-versao-parcial]")
    ok("Versão 2" in t and "as movimentações 77 a 83" in t and "7 marcadas" in t and "9 arquivo(s)" in t and "continua no Histórico" in t, f"aviso da versão com a faixa: {t[:160]}")
    pg.screenshot(path="/tmp/claude-0/work/teste/refazer_versao.png"); pg.close()
    pg = novo(b, "?motor=principal"); pg.wait_for_timeout(500); ok(pg.locator("[data-testid=aviso-versao-parcial]").count() == 0, "minuta normal: sem aviso de versão"); pg.close()
    b.close()
ok(not erros, f"sem erros de página: {erros[:2]}")
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
