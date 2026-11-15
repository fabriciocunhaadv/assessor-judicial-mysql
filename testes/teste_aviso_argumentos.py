"""Aviso 'Argumentos × Resposta' na tela da minuta. Rodar: /usr/bin/python3 testes/teste_aviso_argumentos.py"""
import glob, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("/tmp/claude-0/work/teste", exist_ok=True)
srv = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/vite.hist.config.ts"], cwd=RAIZ, stdout=open("/tmp/claude-0/work/teste/vite_av.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
def ok(c, m):
    print(("ok: " if c else "FALHOU: ") + m)
    if not c: raise SystemExit(1)
try:
    for _ in range(90):
        try: urllib.request.urlopen("http://127.0.0.1:5198/testes/gigantes/avisos.html", timeout=2); break
        except Exception: time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); pg = b.new_page(viewport={"width": 1100, "height": 900}); erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        pg.goto("http://127.0.0.1:5198/testes/gigantes/avisos.html"); pg.wait_for_function("window.pronto")
        chip = pg.locator("#com-falha [data-testid=chip-argumentos]")
        ok(chip.count() == 1 and "Argumentos sem resposta (2 de 3)" in chip.inner_text(), "com falha: o botão diz quantos argumentos precisam de conferência")
        ok(pg.locator("#com-falha [data-testid=painel-argumentos]").is_hidden(), "o painel começa recolhido, como os demais avisos")
        chip.click()
        painel = pg.inner_text("#com-falha [data-testid=aviso-argumentos]")
        ok("1 de 3" in painel and "prescrição da pretensão" in painel and "SEM RESPOSTA" in painel, "painel: lista cada argumento e marca o que ficou sem resposta")
        ok("resposta indicada não localizada na minuta" in painel, "painel: marca a resposta que não está no texto")
        ok("ilegitimidade passiva" in painel and "rejeitado" in painel and "Mov. 31, Arq. 1, Pág. 2" in painel, "painel: mostra o argumento respondido, o resultado e onde foi deduzido")
        ok("pode errar" in painel, "avisa que a conferência é automática")
        pg.screenshot(path="/tmp/claude-0/work/teste/aviso_argumentos.png")
        ok("Argumentos × Resposta (1)" in pg.inner_text("#completo [data-testid=chip-argumentos]"), "tudo respondido: botão informativo, sem alarme")
        ok(pg.locator("#sem-matriz [data-testid=chip-argumentos]").count() == 0, "sem matriz: nenhum aviso aparece")
        ok(not erros, f"sem erros na página {erros}")
        b.close()
finally:
    try: os.killpg(srv.pid, 9)
    except Exception: pass
print("TUDO OK")
