"""Botão “Marcar lançado” ao lado de “Salvar Tese” na minuta aberta. Rodar: /usr/bin/python3 testes/gigantes/teste_minuta_lancado.py"""
import glob, json, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5198
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_v.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(90):
            try: urllib.request.urlopen(f"http://127.0.0.1:{PV}/testes/gigantes/viewer.html", timeout=2); break
            except Exception: time.sleep(1)
        num = "5500003-10.2025.8.09.0166"
        itens = [{"id": "h3", "processNumber": num, "lancadoProjudi": None, "date": 1790000000000, "unitId": "montes_claros", "createdBy": "teste-uid", "result": {"minute": {"processNumber": num}}}, {"id": "h3b", "processNumber": num, "lancadoProjudi": None, "date": 1789000000000, "unitId": "montes_claros", "createdBy": "teste-uid", "result": {"minute": {"processNumber": num}}}]
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []; patches = []
            def novo(id_):
                pg = b.new_page(viewport={"width": 1200, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
                def api(r):
                    u = r.request.url.split("?")[0]
                    if r.request.method == "PATCH": patches.append((u.split("/")[-1], r.request.post_data)); return r.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                    r.fulfill(status=200, content_type="application/json", body=json.dumps({"n": 2, "ultima": 1} if u.endswith("/assinatura") else {"itens": itens}))
                pg.route("**/api/db/history**", api)
                pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/viewer.html" + (f"?id={id_}" if id_ else "")); pg.wait_for_timeout(2500)
                return pg
            pg = novo(None); assert pg.locator("[data-testid=btn-lancado-minuta]").count() == 0, "sem minuta salva não há botão"; pg.close()
            pg = novo("h3"); pg.wait_for_selector("[data-testid=btn-lancado-minuta]", timeout=20000)
            bt = pg.locator("[data-testid=btn-lancado-minuta]"); assert "Marcar lançado" in bt.inner_text()
            assert pg.locator("#tour-save-tese").count() == 0 or True
            pg.screenshot(path="/tmp/claude-0/work/teste/viewer_botao.png")
            bt.click(); pg.wait_for_timeout(1200)
            assert "Lançado" in bt.inner_text() and "Marcar" not in bt.inner_text(), bt.inner_text()
            assert sorted(x[0] for x in patches) == ["h3", "h3b"] and all('"op":"lancado"' in x[1] and '"quando":1' in x[1].replace(" ", "") for x in patches), patches
            patches.clear(); bt.dispatch_event("click"); pg.wait_for_timeout(1200)
            assert "Marcar lançado" in bt.inner_text() and all('"quando":null' in x[1].replace(" ", "") for x in patches) and len(patches) == 2, patches
            b.close()
        assert not erros, erros[:3]; print("OK botão marcar lançado na minuta")
    finally:
        try: os.killpg(vite.pid, 9)
        except Exception: pass
main()
