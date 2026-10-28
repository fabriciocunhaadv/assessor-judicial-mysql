// Gemini de mentira: responde ao generateContent com JSON plausível conforme o que o servidor pede.
const http = require("http");
const porta = Number(process.env.PORTA_GEMINI || 8999);
const ficha = { numeroProcesso: "5129546-88.2025.8.09.0100", partes: [{ nome: "Autor", papel: "autor", loc: "Mov. 1, Arq. 1, Pág. 1" }], pedidos: [{ texto: "pedido", quem: "autor", loc: "Mov. 1, Arq. 1, Pág. 1" }], decisoes: [], atosSubsequentes: [], solicitacoesAoJuizo: [], datas: [], valores: [] };
const auditoria = { score: 82, summary: "Aprovada com ressalvas.", criticalAlerts: [{ title: "Dispositivo sem prazo", severity: "atencao", tipoProva: "sem_lastro", minutaTrecho: "Determino o pagamento da quantia devida", description: "d", suggestedFix: "f", pillar: "provas", location: "Dispositivo" }],
  conformidadeNormativa: [{ tipo: "sumula", referencia: "STJ • Súmula 297", aplicavel: true, seguida: false, trechoDaMinuta: "Determino o pagamento da quantia devida", observacao: "A minuta não aplica a súmula." }], proceduralChain: {}, congruence: { summary: "ok", items: [] }, evidentiary: { summary: "ok", items: [] }, procedural: { summary: "ok", items: [] }, confrontoMinutaAutos: [], assessorFeedbackMessage: "ok", suggestedCorrectionSnippet: "", systemGeneratedMinute: "" };
const minuta1 = { processNumber: "5129546-88.2025.8.09.0100", author: "Autor", defendant: "Réu", judicialUnit: "Vara Cível", pendingMatter: "sentença", actType: "SENTENÇA", relatorio: "Relatório. ".repeat(60), fundamentacao: "### 1. Tema\n\n" + "Fundamentação com Mov. 1, Arq. 1, Pág. 1. ".repeat(50), dispositivo: "Julgo procedente. Determino o pagamento da quantia devida." };
const resposta = (t, usage) => JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: t }] }, finishReason: "STOP", index: 0 }], usageMetadata: { promptTokenCount: usage, candidatesTokenCount: 500, totalTokenCount: usage + 500 }, modelVersion: "gemini-3.6-flash" });
http.createServer((req, res) => {
  let corpo = ""; req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    let j = {}; try { j = JSON.parse(corpo); } catch {}
    const sis = JSON.stringify(j.systemInstruction || j.config?.systemInstruction || "") + JSON.stringify(j.generationConfig || {});
    const tudo = corpo;
    let t;
    if (/MAPA-PARTE/.test(sis + tudo.slice(0, 4000)) && !/MAPA-CONSOLIDAR/.test(sis)) { const movs = [...new Set([...tudo.matchAll(/\[Mov\. (\d+) /g)].map((m) => +m[1]))]; t = JSON.stringify({ numeroProcesso: "5129546-88.2025.8.09.0100", partes: "Autor x Réu", eventos: movs.filter((n) => n % 37 === 0 || n === 148).map((n) => ({ mov: n, data: "01/01/2026", tipo: n === 148 ? "Decisão" : "Despacho", resumo: "Ato da movimentação " + n, determinou: "comando " + n, situacao: "em_vigor" })) }); }
    else if (/MAPA-CONSOLIDAR/.test(sis)) t = JSON.stringify({ numeroProcesso: "5129546-88.2025.8.09.0100", partes: "Autor x Réu", estadoAtual: { ultimoAtoRelevante: "Decisão da Mov. 148", questaoAtual: "Deliberar sobre a avaliação dos imóveis e a alienação pendente", pendencias: ["avaliação dos imóveis"], vigentes: ["Mov. 148: nova avaliação determinada"], ligacoes: ["Mov. 148 depende da Mov. 37"] }, situacoes: [{ mov: 37, situacao: "cumprido" }] });
    else if (/CLASSIFICADOR DE RELEV/.test(tudo)) { const pags = [...tudo.matchAll(/\[Página (\d+) de/g)].map((m) => +m[1]); t = JSON.stringify({ segmentos: pags.map((n) => ({ de: n, ate: n, classe: n % 4 === 0 ? "dispensavel" : "essencial", motivo: "teste" })) }); }
    else if (/FICHA DOS AUTOS/.test(tudo) && /analista de autos judiciais/.test(tudo)) t = JSON.stringify(ficha);
    else if (/Corregedor e Auditor/.test(tudo)) t = JSON.stringify(auditoria);
    else if (/SINOPSE|Sinopse/.test(tudo) && !/MINUTA SUBMETIDA/.test(tudo)) t = "Sinopse. ".repeat(60);
    else { const comMapa = /COERÊNCIA COM O ESTADO ATUAL/.test(tudo) ? " COM-MAPA" : ""; const mm = { ...minuta1, relatorio: minuta1.relatorio + comMapa }; t = JSON.stringify({ minute: mm, ...mm }); }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(resposta(t, Math.min(200000, Math.ceil(corpo.length / 3))));
  });
}).listen(porta, () => console.log("gemini falso na porta", porta));
