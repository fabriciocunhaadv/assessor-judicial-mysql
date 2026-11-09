"""Painel Central de decisões no navegador, rotas simuladas. Rodar: /usr/bin/python3 testes/teste_central_painel.py"""
import glob, json, os, subprocess, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
AG = int(time.time() * 1000)
def grupo(a, msg, sev="erro", estado=None, ultimo=None, uh=3):
    return {"assinatura": a * 40, "tipo": "servidor", "modulo": "/api/x", "severidade": sev, "mensagem": msg, "total": 5, "ultimaHora": uh, "primeiro": AG - 3600000, "ultimo": ultimo or AG - 60000, "usuarios": 2, "tendencia": "subindo", "estado": estado}
def main():
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_central.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/central.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
            pg = b.new_page(viewport={"width": 1100, "height": 1500}); pg.on("pageerror", lambda e: erros.append(str(e)))
            chamadas = []
            estado = {"g": [grupo("a", "HTTP 500 em POST /api/x"), grupo("b", "Falha antiga", estado={"status": "resolvido", "nota": "ok", "ts": AG - 5000}, ultimo=AG - 100000, uh=0)]}
            decisoes = [{"chave": "a:banco", "prioridade": 1, "titulo": "2 falha(s) do banco", "detalhe": "x", "acao": {"tipo": "aba", "alvo": "saude", "rotulo": "Abrir Saúde"}},
                        {"chave": "f:pendentes", "prioridade": 3, "titulo": "3 fonte(s) fora da base", "detalhe": "y", "acao": {"tipo": "fontes", "rotulo": "Entendi"}}]
            def resumo(r): r.fulfill(status=200, content_type="application/json", body=json.dumps({"horas": 168, "geradoEm": AG, "grupos": estado["g"], "decisoes": decisoes, "retencaoDias": 30}))
            def post(r):
                chamadas.append((r.request.url.split("/api/central")[1], r.request.post_data)); r.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            pg.route("**/api/central/resumo*", resumo); pg.route("**/api/central/grupo", post); pg.route("**/api/central/dispensar", post)
            pg.route("**/api/saude/eventos*", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"eventos": [{"id": 1, "ts": AG - 60000, "email": "a@b", "mensagem": "HTTP 500 em POST /api/x"}]})))
            pg.goto("http://127.0.0.1:5198/testes/gigantes/central.html"); pg.wait_for_selector("[data-testid=central-decisoes]")
            assert pg.locator("[data-testid=central-decisao]").count() == 2
            assert "urgente" in pg.locator("[data-testid=central-decisao]").first.inner_text().lower()
            assert pg.locator("[data-testid=central-grupo]").count() == 1, "filtro 'só abertos' esconde o resolvido"
            pg.select_option("[data-testid=central-filtro]", "todos"); assert pg.locator("[data-testid=central-grupo]").count() == 2
            pg.locator("[data-testid=central-decisao]").first.get_by_text("Abrir Saúde").click(); assert pg.evaluate("window.__aba") == "saude"
            pg.locator("[data-testid=central-decisao]").nth(1).get_by_text("Dispensar 7 dias").click(); pg.wait_for_timeout(300)
            assert any(c[0] == "/dispensar" and "f:pendentes" in c[1] for c in chamadas), chamadas
            pg.locator("[data-testid=central-status]").first.select_option("investigando"); pg.wait_for_timeout(300)
            assert any(c[0] == "/grupo" and '"investigando"' in c[1] for c in chamadas), chamadas
            pg.locator("[aria-label='Ver ocorrências']").first.click(); pg.wait_for_selector("text=a@b")
            pg.fill("input[placeholder^='Nota']", "causa provável: banco"); pg.get_by_text("Salvar nota").click(); pg.wait_for_timeout(300)
            assert any(c[0] == "/grupo" and "causa provável" in c[1] for c in chamadas), chamadas
            # reincidente: resolvido cujo último evento é posterior à marcação
            estado["g"] = [grupo("c", "Voltou isso", estado={"status": "resolvido", "nota": "", "ts": AG - 500000}, ultimo=AG - 1000)]
            pg.get_by_text("Atualizar").click(); pg.wait_for_selector("text=Voltou (reincidente)")
            pg.screenshot(path="/tmp/claude-0/work/teste/central.png", full_page=True)
            b.close()
        assert not erros, erros[:3]; print("OK painel Central")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
