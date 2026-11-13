"""Botões flutuantes do canto esquerdo (Cadastros, Gigantes, Mapa, aviso de vencimento): empilham sem se cobrir e o menu lateral ganha folga para não esconder itens atrás deles.
Rodar: /usr/bin/python3 testes/teste_dock_lateral.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
URL = "http://127.0.0.1:5198/testes/gigantes/dock.html"
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_dock.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen(URL, timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
        pg = b.new_page(viewport={"width": 1000, "height": 600}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.goto(URL); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=p-cad]")
        caixa = lambda sel: pg.eval_on_selector(sel, "e => { const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; }")
        ids = ["[data-testid=aviso-vencimento-fixo]", "[data-testid=p-mapa]", "[data-testid=p-gig]", "[data-testid=p-cad]"]
        cx = [caixa(s) for s in ids]
        def cobre(a, c): return not (a["x"] + a["w"] <= c["x"] or c["x"] + c["w"] <= a["x"] or a["y"] + a["h"] <= c["y"] or c["y"] + c["h"] <= a["y"])
        ok(not any(cobre(cx[i], cx[j]) for i in range(4) for j in range(i + 1, 4)), "aviso, Mapa, Gigantes e Cadastros não se cobrem")
        ok(cx[0]["y"] < cx[1]["y"] < cx[2]["y"] < cx[3]["y"], "ordem de cima para baixo: aviso, Mapa, Gigantes, Cadastros (Cadastros no canto)")
        ok(all(c["x"] >= 0 and c["y"] >= 0 and c["x"] + c["w"] <= 1000 and c["y"] + c["h"] <= 600 for c in cx), "todos cabem na tela")
        h = float(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--dock-h')").replace("px", ""))
        dock = caixa("[data-testid=dock-lateral]")
        ok(h > 60 and abs(h - dock["h"]) < 1.5, f"a altura da faixa vai para --dock-h ({h}px)")
        # menu lateral: rolando até o fim, o último item fica acima da faixa
        pg.eval_on_selector("[data-testid=menu-rolagem]", "e => e.scrollTop = e.scrollHeight")
        ult = caixa("[data-testid=item-21]")
        ok(ult["y"] + ult["h"] <= dock["y"] + 1, f"último item do menu fica acima da faixa (item termina em {ult['y'] + ult['h']:.0f}, faixa começa em {dock['y']:.0f})")
        # um item some (sem tarefa de Mapa): a faixa encolhe e a folga acompanha
        pg.evaluate("window.__alternarMapa()"); pg.wait_for_timeout(300)
        h2 = float(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--dock-h')").replace("px", ""))
        ok(h2 < h - 20 and pg.locator("[data-testid=p-mapa]").count() == 0, f"sem o Mapa a faixa encolhe ({h:.0f}px → {h2:.0f}px)")
        pg.screenshot(path="/tmp/claude-0/work/teste/dock.png")
        ok(not erros, f"sem erros {erros}")
        b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("TUDO OK")
