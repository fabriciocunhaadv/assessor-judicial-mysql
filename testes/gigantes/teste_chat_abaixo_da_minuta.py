"""O botão "Editar com o chat Gemini" abre o chat NO FLUXO da página, abaixo da minuta (não mais uma janelinha flutuante): sem position fixed, na largura do card,
depois do texto da minuta, com o campo de mensagem focado; "Recolher" esconde e o botão volta. MinuteViewer renderizado sozinho (sem login/servidor)."""
import glob, os, subprocess, sys, time, urllib.request
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, "../.."))
PV = 5199
from playwright.sync_api import sync_playwright
def esperar_http(url, n=90):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(1)
    raise SystemExit("não subiu: " + url)
def main():
    os.makedirs("/tmp/claude-0/work/mob", exist_ok=True)
    cfg = open(os.path.join(AQUI, "vite.config.ts")).read().replace("5198", str(PV)); open(os.path.join(AQUI, "_vite_chat.config.ts"), "w").write(cfg)
    vite = subprocess.Popen(["npx", "vite", "--config", "testes/gigantes/_vite_chat.config.ts"], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        esperar_http(f"http://127.0.0.1:{PV}/testes/gigantes/chat.html")
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"])
            for larg, alt in ((1500, 900), (400, 800)):
                pg = b.new_page(viewport={"width": larg, "height": alt}); erros = []; pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
                pg.goto(f"http://127.0.0.1:{PV}/testes/gigantes/chat.html"); pg.wait_for_selector("[data-testid=abrir-chat-gemini]", timeout=60000)
                assert not pg.locator("[data-testid=painel-chat-gemini]").is_visible()
                pg.locator("[data-testid=abrir-chat-gemini]").click(); pg.wait_for_selector("[data-testid=painel-chat-gemini]", state="visible"); pg.wait_for_timeout(900)
                info = pg.evaluate("""() => {
                    const p = document.querySelector('[data-testid=painel-chat-gemini]'), r = p.getBoundingClientRect(), a = document.activeElement;
                    const ms = [...document.querySelectorAll('.markdown-body')].filter(e => !p.contains(e)), ultimo = ms[ms.length - 1];
                    let base = null;      // a minuta fica numa caixa com rolagem própria: o "fundo" dela é o da caixa
                    if (ultimo) { base = ultimo.getBoundingClientRect().bottom; for (let n = ultimo.parentElement; n; n = n.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 4) { base = n.getBoundingClientRect().bottom; break; } } }
                    return { pos: getComputedStyle(p).position, w: Math.round(r.width), vw: innerWidth, noViewport: r.top < innerHeight && r.bottom > 0, foco: !!a && a.tagName === 'TEXTAREA' && p.contains(a),
                             depois: ultimo ? !!(ultimo.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) : null, abaixo: base === null ? null : r.top >= base - 2,
                             rolouX: document.documentElement.scrollWidth > innerWidth + 1 } }""")
                print(larg, info)
                assert info["pos"] in ("static", "relative"), info
                assert info["foco"] and info["noViewport"] and not info["rolouX"], info
                assert info["depois"] is not False and info["abaixo"] is not False, info
                assert info["w"] > 560 or larg < 700, info              # largura do card, não a janelinha de 540px
                assert not pg.locator("[data-testid=barra-chat-fechado]").is_visible()
                pg.screenshot(path=f"/tmp/claude-0/work/mob/chat_aberto_{larg}.png")
                pg.locator("[data-testid=fechar-chat-gemini]").click(); assert pg.locator("[data-testid=barra-chat-fechado]").is_visible() and not pg.locator("[data-testid=painel-chat-gemini]").is_visible()
                assert not erros, erros; pg.close()
            b.close()
        print("OK")
    finally:
        os.killpg(vite.pid, 9); os.remove(os.path.join(AQUI, "_vite_chat.config.ts"))
main()
