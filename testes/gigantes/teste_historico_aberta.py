"""Histórico: o processo da minuta aberta na tela fica destacado (e a tela rola até ele). Rodar: /usr/bin/python3 testes/gigantes/teste_historico_aberta.py"""
import glob, json, os, subprocess, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
from playwright.sync_api import sync_playwright
PV = 5198
def item(i):
    num = f"55{i:05d}-10.2025.8.09.0166"
    return {"id": f"h{i}", "processNumber": num, "promptTitle": "Outros Área Judicial", "date": 1790000000000 - i * 3600000, "unitId": "montes_claros", "createdBy": "teste-uid", "creatorName": "Fabricio", "creatorEmail": "f@x.com", "lancadoProjudi": None,
            "result": {"minute": {"title": "DECISÃO INTERLOCUTÓRIA", "processNumber": num, "parties": {"author": f"AUTOR {i} DA SILVA", "defendant": "ESTADO DE GOIÁS"}, "judicialUnit": "Montes Claros / Vara Única"}}, "originalMinute": {"title": "x", "processNumber": num}}
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_h.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(90):
            try: urllib.request.urlopen(f"http://127.0.0.1:{PV}/testes/gigantes/historico.html", timeout=2); break
            except Exception: time.sleep(1)
        seed = [item(i) for i in range(1, 31)]
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []; logs = []
            for aberta, nome in (("h3", "visivel"), ("h27", "outra-pagina"), (None, "nenhuma")):
                pg = b.new_page(viewport={"width": 1100, "height": 800}); pg.on("pageerror", lambda e: erros.append(str(e)[:200])); pg.on("console", lambda m: logs.append(m.text[:160]) if m.type in ("error", "warning") else None)
                pg.on("request", lambda r: logs.append("REQ " + r.url[-60:]) if "/api/" in r.url else None); pg.add_init_script("localStorage.setItem('assessor_tour_done','1'); window.__seedHistory = " + json.dumps(seed) + ";")
                def api(r):
                    itens = seed
                    u = r.request.url.split("?")[0]
                    body = {"n": len(itens), "ultima": 1790000000000} if u.endswith("/assinatura") else {"itens": itens}
                    r.fulfill(status=200, content_type="application/json", body=json.dumps(body))
                pg.route("**/api/db/history**", api)
                pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/historico.html" + (f"?aberta={aberta}" if aberta else "")); pg.wait_for_timeout(3000)
                
                try: pg.wait_for_selector("[data-testid=dossie-linha]", timeout=20000)
                except Exception:
                    pg.screenshot(path="/tmp/claude-0/work/teste/hist_falha.png"); print("TEXTO:", pg.inner_text("body")[:600]); print("ERROS:", erros[:3], logs[:5]); raise
                if nome == "visivel":
                    assert pg.locator("[data-aberta='1']").count() == 1 and "5500003" in pg.locator("[data-aberta='1']").inner_text() and pg.locator("[data-testid=dossie-aberto]").count() == 1
                    assert pg.locator("[data-testid=aviso-minuta-aberta]").count() == 0
                    pg.screenshot(path="/tmp/claude-0/work/teste/hist_aberta.png")
                elif nome == "outra-pagina":
                    assert pg.locator("[data-aberta='1']").count() == 0 and pg.locator("[data-testid=aviso-minuta-aberta]").count() == 1, "aviso quando a minuta aberta não está na página"
                    pg.click("[data-testid=btn-mostrar-aberta]"); pg.wait_for_timeout(800)
                else:
                    assert pg.locator("[data-aberta='1']").count() == 0 and pg.locator("[data-testid=aviso-minuta-aberta]").count() == 0, "sem minuta aberta, sem destaque"
                pg.close()
            b.close()
        assert not erros, erros[:3]; print("OK destaque no Histórico")
    finally:
        try: os.killpg(vite.pid, 9)
        except Exception: pass
main()
