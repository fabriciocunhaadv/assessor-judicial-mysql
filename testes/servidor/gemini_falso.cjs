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
    if (/CLASSIFICADOR DE RELEV/.test(tudo)) { const pags = [...tudo.matchAll(/\[Página (\d+) de/g)].map((m) => +m[1]); t = JSON.stringify({ segmentos: pags.map((n) => ({ de: n, ate: n, classe: n % 4 === 0 ? "dispensavel" : "essencial", motivo: "teste" })) }); }
    else if (/FICHA DOS AUTOS/.test(tudo) && /analista de autos judiciais/.test(tudo)) t = JSON.stringify(ficha);
    else if (/Corregedor e Auditor/.test(tudo)) t = JSON.stringify(auditoria);
    else if (/SINOPSE|Sinopse/.test(tudo) && !/MINUTA SUBMETIDA/.test(tudo)) t = "Sinopse. ".repeat(60);
    else t = JSON.stringify({ minute: minuta1, ...minuta1 });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(resposta(t, Math.min(200000, Math.ceil(corpo.length / 3))));
  });
}).listen(porta, () => console.log("gemini falso na porta", porta));
