"""Painel Saúde do sistema no navegador, com as rotas simuladas. Rodar: /usr/bin/python3 testes/teste_saude_painel.py"""
import json, os, subprocess, sys, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
AG = int(time.time() * 1000); D = 86_400_000
def resumo(nivel):
    return {"horas": 24, "geradoEm": AG, "passo": 3600000, "totalEventos": 12,
        "tipos": [{"tipo": t, "semaforo": s, "total": n} for t, s, n in [("servidor","vermelho",5),("banco","verde",0),("ia","amarelo",7),("retomada","verde",0),("extensao","verde",0),("cliente","verde",0),("sistema","verde",0),("versao","verde",0)]],
        "serie": [{"ts": AG - (24 - i) * 3600000, "erro": 3 if i == 20 else 0, "aviso": 2 if i > 15 else 0} for i in range(24)],
        "grupos": [{"assinatura": "abc", "tipo": "servidor", "modulo": "/api/x", "severidade": "erro", "mensagem": "HTTP 500 em POST /api/x", "total": 5, "ultimaHora": 5, "primeiro": AG - 3600000, "ultimo": AG - 60000, "usuarios": 2, "tendencia": "subindo"}],
        "alertas": [{"codigo": "erro_repetido", "gravidade": "alta", "texto": "O mesmo problema se repetiu 5x na última hora (servidor//api/x): HTTP 500 em POST /api/x"}],
        "ia": {"horaAtual": {"chamadas": 10, "ok": 8, "f503": 1, "f429": 1, "timeout": 0, "auth": 0, "outro": 0, "tokens": 12345}, "ultimas24h": 3},
        "rotas": [{"rota": "/api/generate-minute", "n": 4, "erros": 1, "mediaMs": 80000, "p95Ms": 120000, "maxMs": 130000}],
        "retencao": {"dias": 30, "maisAntigoTs": AG - (30 - nivel) * D if nivel else AG - 5 * D, "total": 99, "nivelAviso": nivel, "expiram": {"d7": 40, "d3": 10, "d1": 2}, "ultimaLimpeza": None}}
def main():
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_saude.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/saude.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            import glob; b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
            for nivel in (None, 7, 3, 1):
                pg = b.new_page(viewport={"width": 1100, "height": 1500}); pg.on("pageerror", lambda e: erros.append(str(e)))
                corpo = json.dumps(resumo(nivel)); pg.route("**/api/saude/resumo*", lambda r, _q=None: r.fulfill(status=200, content_type="application/json", body=corpo))
                pg.route("**/api/saude/eventos*", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"eventos": [{"id": 1, "ts": AG - 60000, "email": "a@b", "detalhe": None, "duracaoMs": 1500}]})))
                pg.route("**/api/saude/exportar", lambda r: r.fulfill(status=200, content_type="application/json", body='{"eventos":[]}'))
                pg.goto("http://127.0.0.1:5198/testes/gigantes/saude.html"); pg.wait_for_selector("[data-testid=saude-semaforos]")
                aviso = pg.locator("[data-testid=saude-aviso-retencao]")
                if nivel is None: assert aviso.count() == 0, "sem aviso quando falta muito"
                else:
                    assert aviso.count() == 1, f"aviso do nível {nivel}"
                    txt = aviso.inner_text(); print(f"nível {nivel}:", txt[:90].replace("\n", " "))
                    assert ("Falta 1 dia" in txt) if nivel == 1 else (f"Faltam {nivel} dias" in txt)
                    aviso.get_by_text("Lembrar amanhã").click(); assert aviso.count() == 0, "dispensar esconde o aviso"
                if nivel is None:
                    assert pg.locator("[data-testid=saude-alertas]").count() == 1
                    pg.get_by_text("HTTP 500 em POST /api/x").first.click(); pg.wait_for_timeout(300)
                    assert "usuário" in pg.inner_text("body"); assert pg.locator("[data-testid=saude-grafico] > div").count() == 24
                    pg.screenshot(path="/tmp/claude-0/work/teste/saude.png", full_page=True)
                pg.close()
            b.close()
        assert not erros, erros[:3]; print("OK painel de saúde")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
