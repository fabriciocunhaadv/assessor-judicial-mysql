"""Painel Calibragem (Motores, Gabinetes, Extensão) no navegador, rotas simuladas. Rodar: /usr/bin/python3 testes/teste_calibragem_painel.py"""
import glob, json, os, subprocess, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
AG = int(time.time() * 1000)
def motor(i, nome, n, erros=0, cota=0, avisos=()):
    return {"id": i, "nome": nome, "n": n, "erros": erros, "cota": cota, "taxaErro": erros / n if n else 0, "taxaCota": cota / n if n else 0, "mediaMs": 80000 if n else 0, "maxMs": 130000, "kbMedio": 900, "kbMax": 4000,
            "execucoesIA": n, "tokensMedios": 12000, "custoTotal": 1.5, "modelos": [{"modelo": "gemini-x", "n": n}], "porDia": [{"dia": "2026-11-08", "n": n, "erros": erros, "cota": cota}], "avisos": list(avisos)}
MOT = {"dias": 7, "geradoEm": AG, "avisos": [], "observacao": "Os pedidos começam a ser contados a partir da atualização.", "motores": [motor("analise", "Análise (Gerar Minuta)", 20, 4, 1, ["Erros em 20% dos pedidos (mais de 10%)."]), motor("turbo", "Análise Turbo", 0), motor("lupa", "Lupa do Magistrado", 3), motor("gigante", "Processo Gigante", 0), motor("audiencia", "Audiência (Copiloto)", 0), motor("sinopse", "Sinopse", 0)]}
GAB = {"geradoEm": AG, "avisos": [], "gabinetes": [
    {"id": "g1", "nome": "1ª Vara Cível", "usuarios": {"total": 4, "ativos30d": 2, "pendentes": 1}, "minutasSemana": 6.5, "motores": [{"modulo": "minuta", "n": 30}, {"modulo": "lupa_magistrado", "n": 4}], "chaves": {"nativaLiberada": 2, "execNativa": 10, "execPropria": 24}, "ultimaAtividade": AG - 20 * 86400000, "erros7d": 0, "ultimoErro": "", "avisos": ["Sem uso há 20 dias.", "1 usuário(s) aguardando aprovação."]},
    {"id": "g2", "nome": "Gabinete Dr. X", "usuarios": {"total": 1, "ativos30d": 1, "pendentes": 0}, "minutasSemana": 2, "motores": [], "chaves": {"nativaLiberada": 0, "execNativa": 0, "execPropria": 3}, "ultimaAtividade": AG - 3600000, "erros7d": 0, "ultimoErro": "", "avisos": []}]}
EXT = {"dias": 30, "geradoEm": AG, "totalEventos": 9, "versoes": {"atual": "1.0.91", "usuarios": [{"email": "a@x", "versao": "1.0.80", "visto": AG, "desatualizado": True}, {"email": "b@x", "versao": "1.0.91", "visto": AG, "desatualizado": False}], "porVersao": [{"versao": "1.0.91", "usuarios": 1}, {"versao": "1.0.80", "usuarios": 1}]},
       "iaExterna": [{"ia": "chatgpt", "ok": 2, "falhas": 3, "taxaSucesso": 0.4, "ultimoErro": "não achei a caixa de mensagem", "ultimoUso": AG}, {"ia": "gemini", "ok": 5, "falhas": 0, "taxaSucesso": 1, "ultimoErro": "", "ultimoUso": AG}],
       "erros": [{"assinatura": "z" * 40, "tipo": "extensao", "modulo": "ocr", "severidade": "erro", "mensagem": "[v1.0.80] OCR falhou", "total": 3, "ultimaHora": 0, "primeiro": AG - 9e6, "ultimo": AG - 1e6, "usuarios": 1, "tendencia": "estavel"}]}
def main():
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_calib.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/calibragem.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
            pg = b.new_page(viewport={"width": 1100, "height": 1400}); pg.on("pageerror", lambda e: erros.append(str(e)))
            for padrao, corpo in (("**/api/central/motores*", MOT), ("**/api/central/gabinetes*", GAB), ("**/api/central/extensao*", EXT)):
                pg.route(padrao, (lambda c: (lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(c))))(corpo))
            pg.goto("http://127.0.0.1:5198/testes/gigantes/calibragem.html"); pg.wait_for_selector("[data-testid=calib-motor]")
            assert pg.locator("[data-testid=calib-motor]").count() == 6
            t = pg.inner_text("[data-testid=calib-motores]"); assert "20%" in t and "Erros em 20%" in t and "Sem uso neste período" in t and "gemini-x" in t, t[:300]
            pg.screenshot(path="/tmp/claude-0/work/teste/calib_motores.png", full_page=True)
            pg.click("[data-testid=calib-aba-gabinetes]"); pg.wait_for_selector("[data-testid=calib-gabinete]")
            assert pg.locator("[data-testid=calib-gabinete]").count() == 2
            t = pg.inner_text("[data-testid=calib-gabinetes]"); assert "Sem uso há 20 dias" in t and "1ª Vara Cível" in t and "Análise (30)" in t, t[:300]
            assert pg.locator("[data-testid=calib-gabinete]").first.inner_text().startswith("1ª Vara"), "com avisos primeiro"
            pg.screenshot(path="/tmp/claude-0/work/teste/calib_gabinetes.png", full_page=True)
            pg.click("[data-testid=calib-aba-extensao]"); pg.wait_for_selector("[data-testid=ext-versoes]")
            t = pg.inner_text("[data-testid=calib-extensao]")
            assert "1.0.91" in t and "versão antiga" in t and "a@x (v1.0.80)" in t and "ChatGPT" in t and "40%" in t and "Sucesso baixo" in t and "OCR falhou" in t, t[:600]
            assert pg.locator("[data-testid=ext-ia-linha]").count() == 2
            pg.screenshot(path="/tmp/claude-0/work/teste/calib_extensao.png", full_page=True)
            b.close()
        assert not erros, erros[:3]; print("OK painel Calibragem")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
