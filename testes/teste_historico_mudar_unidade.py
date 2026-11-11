"""Histórico: Super Admin vê o botão 'Mudar de unidade' no cartão do processo e consegue mover o processo para uma unidade de OUTRO gabinete. Rodar: /usr/bin/python3 testes/teste_historico_mudar_unidade.py"""
import glob, json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PV = 5198
def item(i):
    num = f"55{i:05d}-10.2025.8.09.0166"
    return {"id": f"h{i}", "processNumber": num, "promptTitle": "Outros Área Judicial", "date": 1790000000000 - i * 3600000, "unitId": "crixas", "createdBy": "teste-uid", "creatorName": "Fabricio", "creatorEmail": "f@x.com", "lancadoProjudi": None,
            "result": {"minute": {"title": "DECISÃO INTERLOCUTÓRIA", "processNumber": num, "parties": {"author": f"AUTOR {i} DA SILVA", "defendant": "ESTADO DE GOIÁS"}, "judicialUnit": "Crixás / Vara Única"}}, "originalMinute": {"title": "x", "processNumber": num}}
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_su.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
try:
    for _ in range(90):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PV}/testes/gigantes/historico.html", timeout=2); break
        except Exception: time.sleep(1)
    seed = [item(1), item(2)]; chamadas = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
        pg = b.new_page(viewport={"width": 1200, "height": 900}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.add_init_script("localStorage.setItem('assessor_tour_done','1'); window.__su = true; window.__unidades = [{id:'crixas', name:'Crixás / Vara Única'}]; window.__tenants = [{id:'gabinete_default', name:'Gabinete Crixás'},{id:'gab_montes', name:'Gabinete Montes Claros'}]; window.__unidadesTodas = [{id:'montes_claros', name:'Montes Claros de Goiás / Vara Única', tenantId:'gab_montes'}];")
        def api(r):
            u = r.request.url.split("?")[0]; m = r.request.method
            if m != "GET": chamadas.append((m, u[-60:], r.request.post_data or ""))
            body = {"n": len(seed), "ultima": 1790000000000} if u.endswith("/assinatura") else {"itens": seed, "ok": True, "n": 1, "atualizados": 1}
            r.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        pg.route("**/api/db/history**", api); pg.route("**/api/**", lambda r: r.fallback() if "/api/db/history" in r.request.url else r.fulfill(content_type="application/json", body='{"ok":true,"itens":[],"items":[],"data":null}'))
        pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/historico.html"); pg.wait_for_selector("[data-testid=dossie-linha]", timeout=20000)
        n = pg.locator("[data-testid=btn-mudar-unidade-processo]").count()
        ok(n == 2, f"o Super Admin vê 'Mudar de unidade' em cada processo ({n})")
        pg.locator("[data-testid=btn-mudar-unidade-processo]").first.click()
        pg.wait_for_selector("text=Alterar Vara & Lotação do Processo", timeout=10000)
        ok(True, "abre a janela de lotação do processo")
        pg.screenshot(path="/tmp/claude-0/work/teste/hist_mudar_unidade.png")
        ok(pg.locator("[data-testid=outros-gabinetes]").count() == 1 and "Gabinete Montes Claros" in pg.inner_text("[data-testid=outros-gabinetes]"), "a janela lista as unidades dos OUTROS gabinetes (agrupadas pelo nome do gabinete)")
        pg.locator("[data-testid=unidade-outro-gabinete]").first.click()
        ok("sai deste gabinete" in pg.inner_text("[data-testid=outros-gabinetes]"), "ao escolher uma unidade de outro gabinete, avisa que o processo sai deste gabinete")
        pg.get_by_text("Salvar Alterações").click(); pg.wait_for_timeout(1500)
        mover = [c for c in chamadas if c[1].endswith("/lote/mover-gabinete")]
        print("chamadas:", [(c[0], c[1][-40:]) for c in chamadas][:4])
        corpo = json.loads(mover[0][2]) if mover else {}
        ok(bool(mover) and corpo.get("tenantDestino") == "gab_montes" and corpo.get("unitId") == "montes_claros" and corpo.get("processos") == ["5500001-10.2025.8.09.0166"], f"o processo é movido ao gabinete de destino com a unidade escolhida ({corpo})")
        ok(not erros, f"sem erros {erros}")
        b.close()
finally:
    try: os.killpg(vite.pid, 9)
    except Exception: pass
print("TUDO OK")
