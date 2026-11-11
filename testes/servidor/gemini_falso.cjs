// Gemini de mentira: responde ao generateContent com JSON plausível conforme o que o servidor pede.
const http = require("http");
const porta = Number(process.env.PORTA_GEMINI || 8999);
const ficha = { numeroProcesso: "5129546-88.2025.8.09.0100", partes: [{ nome: "Autor", papel: "autor", loc: "Mov. 1, Arq. 1, Pág. 1" }], pedidos: [{ texto: "pedido", quem: "autor", loc: "Mov. 1, Arq. 1, Pág. 1" }], decisoes: [], atosSubsequentes: [], solicitacoesAoJuizo: [], datas: [], valores: [] };
const auditoria = { score: 82, summary: "Aprovada com ressalvas.", criticalAlerts: [{ title: "Dispositivo sem prazo", severity: "atencao", tipoProva: "sem_lastro", minutaTrecho: "Determino o pagamento da quantia devida", description: "d", suggestedFix: "f", pillar: "provas", location: "Dispositivo" }],
  conformidadeNormativa: [{ tipo: "sumula", referencia: "STJ • Súmula 297", aplicavel: true, seguida: false, trechoDaMinuta: "Determino o pagamento da quantia devida", observacao: "A minuta não aplica a súmula." }], proceduralChain: {}, congruence: { summary: "ok", items: [] }, evidentiary: { summary: "ok", items: [] }, procedural: { summary: "ok", items: [] }, confrontoMinutaAutos: [], assessorFeedbackMessage: "ok", suggestedCorrectionSnippet: "", systemGeneratedMinute: "" };
const minuta1 = { processNumber: "5129546-88.2025.8.09.0100", author: "Autor", defendant: "Réu", judicialUnit: "Vara Cível", pendingMatter: "sentença", actType: "SENTENÇA", relatorio: "Relatório. ".repeat(60), fundamentacao: "### 1. Tema\n\n" + "Fundamentação com Mov. 1, Arq. 1, Pág. 1. ".repeat(50), dispositivo: "Julgo procedente. Determino o pagamento da quantia devida." };
const resposta = (t, usage) => JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: t }] }, finishReason: "STOP", index: 0 }], usageMetadata: { promptTokenCount: usage, candidatesTokenCount: 500, totalTokenCount: usage + 500 }, modelVersion: "gemini-3.6-flash" });
http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__grounding") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ n: global.__grounding || 0 })); return; }
  if (req.method === "GET" && req.url === "/__prontidao") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(global.__prontidao || {})); return; }
  // API de arquivos (envio retomável do SDK): início -> URL de envio -> finalização devolve o arquivo ATIVO; consulta e exclusão
  if (/\/upload\/v1beta\/files/.test(req.url) && req.method === "POST") {
    req.resume();
    req.on("end", () => { res.writeHead(200, { "x-goog-upload-url": `http://127.0.0.1:${porta}/__envio/${Date.now()}`, "x-goog-upload-status": "active", "Content-Type": "application/json" }); res.end("{}"); });
    return;
  }
  if (/^\/__envio\//.test(req.url) && req.method === "POST") {
    let n = 0; req.on("data", (c) => (n += c.length));
    req.on("end", () => { global.__bytesAcum = (global.__bytesAcum || 0) + n; if (/finalize/.test(String(req.headers["x-goog-upload-command"] || ""))) { global.__arquivos = (global.__arquivos || 0) + 1; global.__bytesArquivo = global.__bytesAcum; global.__bytesAcum = 0; } const fim = /finalize/.test(String(req.headers["x-goog-upload-command"] || "")); if (!fim) { res.writeHead(200, { "x-goog-upload-status": "active" }); res.end("{}"); return; } res.writeHead(200, { "x-goog-upload-status": "final", "Content-Type": "application/json" }); res.end(JSON.stringify({ file: { name: "files/falso" + global.__arquivos, uri: `http://127.0.0.1:${porta}/v1beta/files/falso${global.__arquivos}`, mimeType: "video/mp4", state: "ACTIVE", sizeBytes: String(n) } })); });
    return;
  }
  if (/\/v1beta\/files\/falso/.test(req.url) && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ name: "files/falso1", uri: "x", state: "ACTIVE" })); return; }
  if (/\/v1beta\/files\/falso/.test(req.url) && req.method === "DELETE") { global.__apagados = (global.__apagados || 0) + 1; res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); return; }
  if (req.method === "GET" && req.url === "/__midia") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ arquivos: global.__arquivos || 0, bytes: global.__bytesArquivo || 0, apagados: global.__apagados || 0, degravacoes: global.__degravacoes || 0, sentencas: global.__sentencas || 0, comTesesTotal: global.__comTesesTotal || 0, baseSentenca: global.__baseSentenca || null, semAutosNaDegravacao: global.__semAutos || 0 })); return; }
  let corpo = ""; req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    // fila travada do Google (só em teste): GEMINI_FALSO_TRAVA="modelo1,modelo2" nunca responde para esses modelos
    if (process.env.GEMINI_FALSO_TRAVA && process.env.GEMINI_FALSO_TRAVA.split(",").some((m) => String(req.url).includes("/models/" + m + ":"))) { if (process.env.GEMINI_FALSO_LOG) console.log("trava", req.url); return; }
    let j = {}; try { j = JSON.parse(corpo); } catch {}
    if (/CADERNO DE TESES E DIRETRIZES VINCULANTES/.test(corpo)) global.__comTesesTotal = (global.__comTesesTotal || 0) + 1;
    // teste da calibração: conta, por tipo de chamada, quantas levam a conferência de prontidão do ato
    { const p = (global.__prontidao ||= {}); const tipo = /CONFERÊNCIA DA PRONTIDÃO DO ATO/.test(corpo) ? "lupa" : /PRONTIDÃO DO ATO — CONFERÊNCIA OBRIGATÓRIA/.test(corpo) ? (/DIRETRIZ DA ETAPA 2/.test(corpo) ? "etapa2" : /DIRETRIZ DA ETAPA 1/.test(corpo) ? "etapa1" : /ANÁLISE JUDICIAL TURBO/.test(corpo) ? "turbo" : "outro") : /\(9\) Em "pendencias" inclua SEMPRE/.test(corpo) ? "mapa" : "sem"; p[tipo] = (p[tipo] || 0) + 1; }
    // pesquisa ao vivo (Grounding): a chamada traz a ferramenta googleSearch; responde com texto e uma fonte, como o Google faria
    if (/"googleSearch"/.test(corpo)) { global.__grounding = (global.__grounding || 0) + 1; res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "STJ, Súmula 297: o Código de Defesa do Consumidor é aplicável às instituições financeiras. https://scon.stj.jus.br/sumula297" }] }, finishReason: "STOP", index: 0, groundingMetadata: { groundingChunks: [{ web: { uri: "https://scon.stj.jus.br/sumula297", title: "STJ Súmula 297" } }] } }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30, totalTokenCount: 80 } })); return; }
    const sis = JSON.stringify(j.systemInstruction || j.config?.systemInstruction || "") + JSON.stringify(j.generationConfig || {});
    const tudo = corpo;
    if (process.env.GEMINI_FALSO_LOG) console.log("req ~tokens", Math.ceil(corpo.length / 3.2));
    // chave gratuita de mentira: recusa pedidos acima de 250 mil tokens de entrada (como o Google), menos as chamadas de classificação/mapa/ficha, que são pequenas
    if (!/CLASSIFICADOR DE RELEV|MAPA-PARTE|MAPA-CONSOLIDAR/.test(tudo.slice(0, 20000) + sis) && Math.ceil(corpo.length / 3.2) > 250000 && process.env.GEMINI_FALSO_GRATUITO === "1") { res.writeHead(429, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { code: 429, message: "You exceeded your current quota: generate_content_free_tier_input_token_count, limit: 250000, request: " + Math.ceil(corpo.length / 3.2), status: "RESOURCE_EXHAUSTED" } })); return; }
    let t;
    if (/DEGRAVAÇÃO FIEL do áudio/.test(tudo)) { global.__degravacoes = (global.__degravacoes || 0) + 1; if (!/fileData/.test(tudo)) global.__semAutos = 1; res.writeHead(200, { "Content-Type": "application/json" }); res.end(resposta("[00:00] Juiz: Bom dia, vamos iniciar a audiência. [00:20] Autora: Trabalho na roça desde os doze anos, em regime de economia familiar. [01:10] Testemunha 1: Conheço a autora há trinta anos.", 5000)); return; }
    if (/Mutirão Expresso de Audiências/.test(tudo)) { global.__sentencas = (global.__sentencas || 0) + 1; global.__baseSentenca = { teses: /CADERNO DE TESES E DIRETRIZES VINCULANTES/.test(tudo), conhecimento: /BASE DE CONHECIMENTO DO GABINETE/.test(tudo), mecanica: /MECÂNICA|mecânica/.test(tudo) }; res.writeHead(200, { "Content-Type": "application/json" }); res.end(resposta(JSON.stringify({ transcription: "Autora e testemunha confirmam o labor rural.", sentenceText: "SENTENÇA. Julgo procedente o pedido." + (/DEGRAVAÇÃO DOS DEPOIMENTOS/.test(tudo) && /roça desde os doze anos/.test(tudo) ? " [usou a degravação]" : "") }), 3000)); return; }
    if (/MAPA-PARTE/.test(sis + tudo.slice(0, 4000)) && !/MAPA-CONSOLIDAR/.test(sis)) { const movs = [...new Set([...tudo.matchAll(/\[Mov\. (\d+) /g)].map((m) => +m[1]))]; t = JSON.stringify({ numeroProcesso: "5129546-88.2025.8.09.0100", partes: "Autor x Réu", eventos: movs.filter((n) => n % 37 === 0 || n === 148).map((n) => ({ mov: n, data: "01/01/2026", tipo: n === 148 ? "Decisão" : "Despacho", resumo: "Ato da movimentação " + n, determinou: "comando " + n, situacao: "em_vigor" })) }); }
    else if (/MAPA-CONSOLIDAR/.test(sis)) t = JSON.stringify({ numeroProcesso: "5129546-88.2025.8.09.0100", partes: "Autor x Réu", estadoAtual: { ultimoAtoRelevante: "Decisão da Mov. 148", questaoAtual: "Deliberar sobre a avaliação dos imóveis e a alienação pendente", pendencias: ["avaliação dos imóveis"], vigentes: ["Mov. 148: nova avaliação determinada"], ligacoes: ["Mov. 148 depende da Mov. 37"] }, situacoes: [{ mov: 37, situacao: "cumprido" }] });
    else if (/CLASSIFICADOR DE RELEV/.test(tudo)) { const pags = [...tudo.matchAll(/\[Página (\d+) de/g)].map((m) => +m[1]); t = JSON.stringify({ segmentos: pags.map((n) => ({ de: n, ate: n, classe: n % 4 === 0 ? "dispensavel" : "essencial", motivo: "teste" })) }); }
    else if (/Redator Forense 360/.test(sis + tudo.slice(0, 30000)) && /fullPetitionMarkdown/.test(sis + tudo.slice(0, 30000))) {
      // Petição & Defesa 360°: a IA de mentira se auto-aprova (nota 98, "seguro para protocolar") e inventa precedente, para o teste provar que o servidor corrige isso
      const corpo = ("Dos fatos e do direito. A parte autora narra a relação de consumo e a impugnação específica de cada fato (art. 341 do CPC). " + "Parágrafo de argumentação sobre o caso concreto, com referência aos documentos (Mov. 1, Arq. 1, Pág. 1). ".repeat(20)) + (/\[\[FALSO-PREENCHER\]\]/.test(tudo) ? " Qualificação: CPF [PREENCHER: CPF do cliente]." : "");
      const it = (id, label, req) => ({ id, label, requirement: req, isCompliant: true, details: "Adequado." });
      const pet = { title: "CONTESTAÇÃO", fullPetitionMarkdown: "# CONTESTAÇÃO\n\n" + corpo.repeat(2), cleanTextPreview: "Resumo.",
        favorableJurisprudence: [{ court: "TJGO", precedentNumber: "Apelação Cível nº 5123456-78.2020.8.09.0001", theme: "tema", summary: "s", favorableArgument: "a", fullCitation: "c", tipo: "real_verificado", isRealVerificado: true, fonteUrl: "" }, { court: "STJ", precedentNumber: "Súmula 297 do STJ", theme: "CDC e bancos", summary: "s", favorableArgument: "a", fullCitation: "c", tipo: "real_verificado", isRealVerificado: true, fonteUrl: "" }],
        anticipatedDefenses: ["ponto"], matrizImpugnacao: [{ alegacaoAutor: "a", refutacaoDefesa: "r", documentoRef: "d" }],
        auditCpc: { status: "aprovado", score: 98, safeForProtocol: true, criticalAlerts: [], items: [it("item_1", "Juízo e Endereçamento", "Art. 319, I ou Art. 335 CPC"), it("item_3", "Tempestividade", "Art. 219 e Art. 335 CPC"), it("item_4", "Impugnação Específica", "Art. 341 CPC")] },
        kitProcuracao: "Procuração.", kitDeclaracaoPobreza: "Declaração." };
      t = /\[\[FALSO-CERCA\]\]/.test(tudo) ? "```json\n" + JSON.stringify(pet) + "\n```" : JSON.stringify(pet);
    }
    else if ((/FICHA DOS AUTOS/.test(tudo) || /TRECHO DOS AUTOS:/.test(tudo)) && /analista de autos judiciais/.test(tudo)) t = JSON.stringify(ficha);
    else if (/Corregedor e Auditor/.test(tudo)) t = JSON.stringify(auditoria);
    else if (/SINOPSE|Sinopse/.test(tudo) && !/MINUTA SUBMETIDA/.test(tudo)) t = "Sinopse. ".repeat(60);
    else { const comMapa = (/COERÊNCIA COM O ESTADO ATUAL/.test(tudo) ? " COM-MAPA" : "") + (/CADERNO DE TESES E DIRETRIZES VINCULANTES/.test(tudo) ? " COM-TESES" : "") + (/TUANNY ALVES CARNEIRO/.test(tudo) ? " VIU-TESE-TUANNY" : "") + (/BASE DE CONHECIMENTO INTERNA: modelo-gabinete/.test(tudo) ? " COM-BASE" : ""); const mm = { ...minuta1, relatorio: minuta1.relatorio + comMapa }; t = JSON.stringify({ minute: mm, ...mm }); }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(resposta(t, Math.min(200000, Math.ceil(corpo.length / 3))));
  });
}).listen(porta, () => console.log("gemini falso na porta", porta));
