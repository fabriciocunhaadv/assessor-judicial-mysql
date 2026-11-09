"""Tela "Minha fila" (celular e computador), rotas simuladas. Rodar: /usr/bin/python3 testes/teste_fila_painel.py"""
import glob, json, os, subprocess, time, urllib.request
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
AG = int(time.time() * 1000)
def estado(online=True, resumo=True):
    r = {"total": 20, "aguardando": 5, "analisando": 1, "concluidos": 13, "erros": 1, "pausados": 0, "modo": "ia", "ia": "IA do Jusbrasil", "pausa": "O Jusbrasil pediu login", "ultimoErro": "ChatGPT: não achei a caixa", "versao": "1.0.96", "geradoEm": AG} if resumo else None
    return {"resumo": r, "ultimoSinal": AG - (60000 if online else 3600000), "online": online, "prefs": {"concluida": True, "erro": True, "pausa": True, "parou": True}, "aparelhos": 0, "minutosSemSinal": 15}
def main():
    os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
    srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_fila.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/fila.html", timeout=2); break
            except Exception: time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []; posts = []
            for nome, w, h, online, com in (("celular", 390, 800, True, True), ("computador", 1100, 800, False, False)):
                pg = b.new_page(viewport={"width": w, "height": h}); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
                est = estado(online, com)
                pg.route("**/api/fila/minha", (lambda e: (lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(e))))(est))
                def prefs(r): posts.append(r.request.post_data); r.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                pg.route("**/api/fila/prefs", prefs)
                pg.goto("http://127.0.0.1:5198/testes/gigantes/fila.html"); pg.wait_for_timeout(500)
                pg.evaluate("window.dispatchEvent(new CustomEvent('fila:abrir'))"); pg.wait_for_selector("[data-testid=minha-fila]")
                if com:
                    pg.wait_for_selector("[data-testid=fila-resumo]"); t = pg.inner_text("[data-testid=minha-fila]")
                    assert "13" in t and "de 20" in t and "65%" in t and "Computador ativo" in t and "pediu login" in t and "ChatGPT: não achei a caixa" in t and "IA externa (IA do Jusbrasil)" in t, t[:400]
                    pg.uncheck("text=Um processo parou com erro"); pg.wait_for_timeout(300)
                    assert any(x and '"erro":false' in x for x in posts), posts
                    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "rolagem lateral no celular"
                else:
                    t = pg.inner_text("[data-testid=minha-fila]"); assert "Computador sem sinal" in t and "Nenhuma fila enviada ainda" in t, t[:300]
                assert pg.locator("[data-testid=fila-avisos]").is_visible()
                pg.wait_for_timeout(300); pg.screenshot(path=f"/tmp/claude-0/work/teste/fila_{nome}.png"); pg.close()
            b.close()
        assert not erros, erros[:3]; print("OK tela Minha fila")
    finally:
        try: os.killpg(srv.pid, 9)
        except Exception: pass
main()
