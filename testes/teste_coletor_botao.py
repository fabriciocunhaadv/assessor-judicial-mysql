# Botão "Coletar dos sites" na tela de Súmulas, Teses e Informativos: só Super Admin, mostra o resumo por fonte. Rodar: /usr/bin/python3 testes/teste_coletor_botao.py (servidor vite na porta 5198)
import glob, json
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    pg = b.new_page(viewport={"width": 1400, "height": 900}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    pg.goto("http://127.0.0.1:5198/testes/gigantes/precedentes.html"); pg.wait_for_selector("[data-testid=btn-coletar-sites]")
    ok(pg.locator("[data-testid=btn-simular-coleta]").is_visible(), "botão 'Só simular' aparece para o Super Admin")
    ok(not pg.locator("[data-testid=coleta-resumo]").count(), "sem resumo antes de coletar")
    pg.click("[data-testid=btn-simular-coleta]"); pg.wait_for_selector("[data-testid=coleta-resumo]", timeout=15000); pg.wait_for_function("document.querySelector('[data-testid=coleta-resumo]').innerText.includes('Cadastrados')", timeout=15000)
    ok(json.loads(pg.evaluate("window.__coleta")).get("simular") is True, "'Só simular' pede simulação")
    pg.click("[data-testid=btn-coletar-sites]"); pg.wait_for_timeout(300)
    pg.wait_for_function("(() => { const e = document.querySelector('[data-testid=coleta-resumo]'); return e && e.innerText.includes('Cadastrados'); })()", timeout=15000)
    ok(json.loads(pg.evaluate("window.__coleta")).get("simular") is False, "'Coletar dos sites' pede a coleta de verdade")
    t = pg.inner_text("[data-testid=coleta-resumo]")
    ok("STJ · Súmulas" in t and "3 novo(s), 11 já existiam" in t, "resumo por fonte com novos e já existentes")
    ok("falhou: o site respondeu 403" in t, "fonte com falha aparece, sem esconder")
    pg.screenshot(path="/tmp/claude-0/work/teste/coletor_botao.png")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
