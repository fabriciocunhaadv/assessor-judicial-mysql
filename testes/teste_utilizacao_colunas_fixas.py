"""Painel Super Admin > Utilização: ao rolar a tabela para o lado, Pessoa e Gabinete ficam fixas à esquerda. Rodar: /usr/bin/python3 testes/teste_utilizacao_colunas_fixas.py (vite na porta 5198)."""
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
MOD = ["minuta", "turbo", "lupa_magistrado", "audiencia", "copiloto", "chat_refino", "modelos", "gigante", "apoio", "ia"]
def u(i):
    return {"email": f"pessoa{i}.com.nome.comprido@gmail.com", "nome": f"Pessoa Numero {i} da Silva", "tenant": f"gab_dr_gabriel_consiglero_{i}", "papel": "admin", "status": "aprovado", "peticao360Liberada": False, "chaveNativaLiberada": True,
            "modulos": {m: {"n": i + 1, "tokens": 10, "custo": 0.1} for m in MOD}, "execucoes": 100 + i, "tokens": 1000, "custo": 1.5, "chaveNativa": 0, "minutasSalvas": 5, "excluidasManual": 0, "excluidasRetencao": 0, "lancadas": 1, "mudancasUnidade": 0, "mudancasGabinete": 0, "peticoes360": 0, "copias": 2, "docx": 1, "pdfs": 1, "extensao": {}, "extensaoTotal": 3, "ultimoUso": 1794940000000}
RESP = {"periodo": {"de": 1, "ate": 2}, "geradoEm": 1, "avisos": [], "totais": {"extensao": 3, "usuariosAtivos": 3, "usuariosCadastrados": 3, "execucoes": 303, "tokens": 3000, "custo": 4.5, "minutasSalvas": 15, "excluidasManual": 0, "excluidasRetencao": 0, "geradasExcluidas": 0, "lancadas": 3, "mudancasUnidade": 0, "mudancasGabinete": 0, "copias": 6, "docx": 3, "pdfs": 3, "peticoes360": 0, "semDono": 0, "porModulo": {m: {"n": 3, "tokens": 30, "custo": 0.3} for m in MOD}, "outrosPorRotulo": []}, "usuarios": [u(1), u(2), u(3)], "liberados": []}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 1000, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.route("**/api/utilizacao**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(RESP)))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/utilizacao.html"); 
    try: pg.wait_for_selector("[data-testid=linha-utilizacao]", timeout=15000)
    except Exception:
        print("DEBUG corpo:", pg.inner_text("body")[:500].replace("\n", " | "), "| erros:", erros); raise
    cx = lambda sel: pg.evaluate("(s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }", sel)
    antes_p, antes_g = cx("[data-testid=col-pessoa]"), cx("[data-testid=col-gabinete]")
    larg = pg.evaluate("() => { const t = document.querySelector('[data-testid=linha-utilizacao]').closest('table'); const c = t.parentElement; return [t.scrollWidth, c.clientWidth]; }")
    ok(larg[0] > larg[1] + 300, f"a tabela é mais larga que a tela (precisa rolar): {larg}")
    pg.screenshot(path="/tmp/claude-0/work/teste/utilizacao_antes.png")
    pg.evaluate("() => { const c = document.querySelector('[data-testid=linha-utilizacao]').closest('table').parentElement; c.scrollLeft = 900; }"); pg.wait_for_timeout(300)
    dep_p, dep_g = cx("[data-testid=col-pessoa]"), cx("[data-testid=col-gabinete]")
    ok(pg.evaluate("() => document.querySelector('[data-testid=linha-utilizacao]').closest('table').parentElement.scrollLeft") > 400, "a tabela rolou para o lado")
    ok(abs(dep_p[0] - antes_p[0]) <= 2 and abs(dep_g[0] - antes_g[0]) <= 2, f"Pessoa e Gabinete ficaram no mesmo lugar: pessoa {antes_p}→{dep_p}, gabinete {antes_g}→{dep_g}")
    ok(dep_g[0] >= dep_p[1] - 2, "o Gabinete fica logo à direita da Pessoa (não se sobrepõem)")
    # o cabeçalho também fica fixo
    cab = pg.evaluate("() => { const t = document.querySelector('[data-testid=linha-utilizacao]').closest('table'); const ths = [...t.querySelectorAll('thead th')].slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().left)); return ths; }")
    ok(abs(cab[0] - antes_p[0]) <= 2 and abs(cab[1] - antes_g[0]) <= 2, f"os títulos Pessoa/Gabinete também ficaram fixos: {cab}")
    # o que passa por baixo não aparece por cima: o fundo é opaco
    bg = pg.evaluate("() => getComputedStyle(document.querySelector('[data-testid=col-pessoa]')).backgroundColor")
    ok(bg and "rgba(0, 0, 0, 0)" not in bg and "transparent" not in bg, f"fundo opaco nas colunas fixas ({bg})")
    pg.screenshot(path="/tmp/claude-0/work/teste/utilizacao_depois.png")
    ok(not erros, f"sem erros de página: {erros[:2]}")
    b.close()
print("FALHAS:", falhas); raise SystemExit(1 if falhas else 0)
