"""Aba “Minutas lançadas” (Super Admin): padrões, documento assinado (PDF) e resumo por IA. Rodar: /usr/bin/python3 testes/teste_aba_minutas_lancadas.py (vite na porta 5198)."""
import glob, json, os, tempfile
from reportlab.pdfgen import canvas
from playwright.sync_api import sync_playwright
falhas = 0
def ok(c, m):
    global falhas
    if not c: falhas += 1; print("FALHOU:", m)
    else: print("ok:", m)
GERADO = "SENTENÇA\nI - RELATÓRIO\nTrata-se de ação de cobrança proposta por Maria contra João, em que a autora narra que o réu deixou de pagar o contrato firmado entre as partes.\nII - FUNDAMENTAÇÃO\nO contrato está provado nos autos e o réu não demonstrou o pagamento, de modo que a cobrança é devida na integralidade do valor pedido.\nIII - DISPOSITIVO\nJulgo procedente o pedido para condenar o réu ao pagamento de R$ 10.000,00 com correção monetária e juros."
LANCADO = GERADO.replace("na integralidade do valor pedido", "no valor pedido, acrescido de multa contratual")
ASSINADO = LANCADO.replace("Julgo procedente o pedido para condenar o réu ao pagamento de R$ 10.000,00", "Julgo parcialmente procedente o pedido para condenar o réu ao pagamento de R$ 7.000,00")
def pdf(texto):
    f = os.path.join(tempfile.mkdtemp(), "assinada.pdf"); c = canvas.Canvas(f); y = 800
    for linha in texto.split("\n"):
        while linha:
            c.setFont("Helvetica", 10); c.drawString(40, y, linha[:95]); linha = linha[95:]; y -= 14
        y -= 6
    c.save(); return f
LINHA = {"id": "5001234-1700000000000", "processo": "5001234-56.2026.8.09.0166", "ato": "SENTENÇA", "geradoEm": 1700000000000, "promptTitulo": "Sentença cível", "motor": "turbo", "aproveitamentoPct": 82.5, "dispositivoMudou": False,
         "mudancas": [{"tipo": "alterado", "secao": "Fundamentação", "original": "na integralidade do valor pedido", "lancado": "no valor pedido, acrescido de multa contratual"}]}
PAD = {"total": 1, "aproveitamentoMedioPct": 82.5, "dispositivoAlteradoPct": 0, "porSecao": [{"secao": "Fundamentação", "n": 1, "aproveitamentoPct": 82.5}], "porPrompt": [{"nome": "Sentença cível", "n": 1, "aproveitamentoPct": 82.5, "dispositivoAlteradoPct": 0}], "porMotor": [], "porAto": [], "maisCortados": [], "maisAcrescentados": [], "assinados": {"n": 0, "aproveitamentoLancadaPct": 0, "aproveitamentoGeradaPct": None, "dispositivoMudouPct": 0}}
RESUMO = {"ok": True, "base": 1, "resumo": "O magistrado aceita o relatório e acrescenta multa na fundamentação.", "padroes": ["Acréscimo de multa na fundamentação."], "sugestoes": [{"titulo": "Citar a multa contratual", "secao": "Fundamentação", "instrucao": "Sempre mencione a multa contratual quando houver.", "motivo": "Acrescentada na comparação 5001234.", "confianca": "baixa"}]}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0], args=["--no-sandbox"]); erros = []
    ctx = b.new_context(viewport={"width": 1400, "height": 1000}, permissions=["clipboard-read", "clipboard-write"], accept_downloads=True); pg = ctx.new_page(); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    L2 = dict(LINHA, id="5009999-1700000000001", processo="5009999-11.2026.8.09.0166")
    posts = []; estado = {"linha": dict(LINHA), "vazio": True, "extra": []}
    def rota(r):
        u, m = r.request.url, r.request.method
        if m == "POST": posts.append((u, r.request.post_data))
        j = lambda o, s=200: r.fulfill(status=s, content_type="application/json", body=json.dumps(o))
        if u.endswith("/padroes"): return j({"padroes": dict(PAD, total=0) if estado["vazio"] else PAD})
        if u.endswith("/textos"): return j({"processo": LINHA["processo"], "textoGerado": GERADO, "textoLancado": LANCADO})
        if u.endswith("/assinado"): estado["linha"]["assinado"] = {"aproveitamentoLancadaPct": 90, "aproveitamentoGeradaPct": 80, "dispositivoMudouDaLancada": True, "arquivo": "assinada.pdf"}; return j({"ok": True})
        if u.endswith("/resumo"): return j(RESUMO)
        if u.endswith("/exportar"):
            ids = json.loads(r.request.post_data or "{}").get("ids", [])
            return j({"geradoEm": 1763377200000, "comparacoes": [dict(LINHA, textoLancado=LANCADO, textoGerado=GERADO)] if (not ids or LINHA["id"] in ids) else []})
        if u.endswith("/apagar"):
            c = json.loads(r.request.post_data or "{}"); antes = 1 + len(estado["extra"])
            if c.get("todas"): estado["vazio"] = True; estado["extra"] = []; return j({"ok": True, "apagadas": antes})
            ids = c.get("ids", []); n = 0
            if LINHA["id"] in ids: estado["vazio"] = True; n += 1
            if L2["id"] in ids: estado["extra"] = []; n += 1
            return j({"ok": True, "apagadas": n})
        return j({"comparacoes": ([] if estado["vazio"] else [estado["linha"]]) + estado["extra"]})
    pg.route("**/api/comparacoes-minuta**", rota)
    pg.goto("http://127.0.0.1:5198/testes/gigantes/minutas.html"); pg.wait_for_function("window.pronto"); pg.wait_for_selector("[data-testid=minutas-vazio]", timeout=15000)
    ok("Buscar minuta lançada" in pg.inner_text("[data-testid=minutas-vazio]"), "sem dados: explica como começar")
    estado["vazio"] = False; pg.click("text=Atualizar"); pg.wait_for_selector("[data-testid=minutas-cartoes]", timeout=10000)
    t = pg.inner_text("[data-testid=painel-minutas-lancadas]")
    ok("82,5%" in t.replace(".", ",") or "82.5%" in t, "aproveitamento médio") ; ok("Sentença cível" in t and "5001234-56.2026.8.09.0166" in t, "tabela por prompt e lista de comparações")
    pg.click("text=5001234-56.2026.8.09.0166"); ok("multa contratual" in pg.inner_text("[data-testid=minutas-lista]"), "abre as mudanças da comparação")
    # documento assinado
    with pg.expect_file_chooser() as fc: pg.click(f"[data-testid='btn-anexar-assinado-{LINHA['id']}']")
    fc.value.set_files(pdf(ASSINADO)); pg.wait_for_selector("[data-testid=msg-assinado]:has-text('Guardado')", timeout=40000)
    m = pg.inner_text("[data-testid=msg-assinado]")
    ok("dispositivo mudou" in m, f"PDF assinado: detecta mudança do dispositivo ({m[:120]})")
    corpo = json.loads([d for u, d in posts if u.endswith("/assinado")][0])
    ok(corpo["dispositivoMudouDaLancada"] is True and 0 < corpo["aproveitamentoLancadaPct"] < 100 and corpo["aproveitamentoGeradaPct"] is not None and corpo["arquivo"] == "assinada.pdf", f"envia só números/trechos ({corpo['aproveitamentoLancadaPct']}% / {corpo['aproveitamentoGeradaPct']}%)")
    ok("textoLancado" not in corpo and "textoAssinado" not in corpo, "não envia o texto do PDF ao servidor")
    pg.wait_for_selector("text=assinada:", timeout=10000)
    # resumo por IA
    pg.click("[data-testid=btn-gerar-resumo]"); pg.wait_for_selector("[data-testid=resumo-resultado]", timeout=10000)
    ok("Citar a multa contratual" in pg.inner_text("[data-testid=resumo-resultado]") and "Sempre mencione" in pg.inner_text("[data-testid=resumo-resultado]"), "resumo e sugestão de prompt aparecem")
    pg.screenshot(path="/tmp/claude-0/work/teste/aba_minutas.png", full_page=True)
    # erro 403 / PDF sem texto
    pg.route("**/api/comparacoes-minuta/resumo", lambda r: r.fulfill(status=503, content_type="application/json", body='{"erro":"a IA não está disponível neste servidor"}'))
    pg.click("[data-testid=btn-gerar-resumo]"); pg.wait_for_selector("[data-testid=resumo-erro]", timeout=10000)
    ok("não está disponível" in pg.inner_text("[data-testid=resumo-erro]"), "erro do resumo aparece sem quebrar")
    vazio = os.path.join(tempfile.mkdtemp(), "v.pdf"); c = canvas.Canvas(vazio); c.showPage(); c.save()
    with pg.expect_file_chooser() as fc: pg.click(f"[data-testid='btn-anexar-assinado-{LINHA['id']}']")
    fc.value.set_files(vazio); pg.wait_for_selector("[data-testid=msg-assinado]:has-text('Erro')", timeout=40000)
    ok("legível" in pg.inner_text("[data-testid=msg-assinado]"), "PDF sem texto: pede OCR")
    # laboratório: pacote geral inteiro, copiar e baixar
    pg.click("[data-testid=btn-preparar-pacote]"); pg.wait_for_selector("[data-testid=pacote-pronto]", timeout=10000)
    ok("todas" in pg.inner_text("[data-testid=btn-preparar-pacote]"), "sem marcar nada, o pacote leva todas")
    pg.click("[data-testid=btn-copiar-pacote]"); pg.wait_for_selector("[data-testid=msg-pacote]:has-text('Copiado')", timeout=10000)
    copiado = pg.evaluate("navigator.clipboard.readText()")
    ok(copiado.startswith("# PACOTE DE CALIBRAGEM") and "MINUTA LANÇADA NO PROJUDI (REFERÊNCIA)" in copiado and "multa contratual" in copiado and "MINUTA GERADA PELO STUDIO" in copiado and "integralidade do valor pedido" in copiado, "a área de transferência recebe o pacote inteiro (lançada e gerada)")
    with pg.expect_download() as dl: pg.click("[data-testid=btn-baixar-pacote]")
    ok(dl.value.suggested_filename.startswith("pacote-calibragem-") and dl.value.suggested_filename.endswith(".md"), f"baixa o arquivo .md ({dl.value.suggested_filename})")
    pg.check(f"[data-testid='marcar-{LINHA['id']}']"); ok("1 marcadas" in pg.inner_text("[data-testid=btn-preparar-pacote]"), "com comparação marcada, o pacote leva só as marcadas")
    pg.uncheck(f"[data-testid='marcar-{LINHA['id']}']")
    # apagar: uma, marcadas e todas (com confirmação dentro da página)
    estado["extra"] = [L2]; pg.click("text=Atualizar"); pg.wait_for_selector(f"[data-testid='apagar-{L2['id']}']", timeout=10000)
    ok(pg.locator("[data-testid=btn-apagar-marcadas]").is_disabled(), "sem marcar nada, 'Apagar marcadas' fica desligado")
    pg.click(f"[data-testid='apagar-{L2['id']}']"); pg.wait_for_selector("[data-testid=confirmar-apagar]")
    ok("Apagar esta comparação" in pg.inner_text("[data-testid=confirmar-apagar]"), "apagar uma pede confirmação")
    pg.click("text=Cancelar"); ok(not any(u.endswith("/apagar") for u, _ in posts), "cancelar não apaga nada")
    pg.click(f"[data-testid='apagar-{L2['id']}']"); pg.click("[data-testid=btn-confirmar-apagar]"); pg.wait_for_selector("[data-testid=msg-apagar]:has-text('1 comparação')", timeout=10000)
    ok(json.loads([d for u, d in posts if u.endswith("/apagar")][-1]) == {"ids": [L2["id"]]}, "apagar uma envia só o id dela")
    estado["extra"] = [L2]; pg.click("text=Atualizar"); pg.wait_for_selector(f"[data-testid='marcar-{L2['id']}']", timeout=10000)
    pg.check(f"[data-testid='marcar-{L2['id']}']"); ok("(1)" in pg.inner_text("[data-testid=btn-apagar-marcadas]"), "contador de marcadas")
    pg.click("[data-testid=btn-apagar-marcadas]"); pg.click("[data-testid=btn-confirmar-apagar]"); pg.wait_for_selector("[data-testid=msg-apagar]:has-text('1 comparação')", timeout=10000)
    ok(json.loads([d for u, d in posts if u.endswith("/apagar")][-1]) == {"ids": [L2["id"]]}, "apagar marcadas envia os ids marcados")
    estado["extra"] = [L2]; pg.click("text=Atualizar"); pg.wait_for_selector("[data-testid=btn-apagar-todas]:not([disabled])", timeout=10000)
    pg.click("[data-testid=btn-apagar-todas]"); ok("TODAS" in pg.inner_text("[data-testid=confirmar-apagar]"), "apagar todas avisa que são todas")
    pg.click("[data-testid=btn-confirmar-apagar]"); pg.wait_for_selector("[data-testid=minutas-vazio]", timeout=10000)
    ok(json.loads([d for u, d in posts if u.endswith("/apagar")][-1]) == {"todas": True}, "apagar todas envia todas:true e a tela volta ao estado vazio")
    ok(not erros, f"sem erros na página {erros}")
print("TUDO OK" if not falhas else f"{falhas} FALHA(S)"); raise SystemExit(1 if falhas else 0)
