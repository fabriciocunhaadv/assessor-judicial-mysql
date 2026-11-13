// Sentença de extinção da execução/cumprimento (arts. 924, II, e 925 do CPC) é reconhecida como SENTENÇA; despacho de arquivamento não é.
// (a função é copiada de server.ts na hora de rodar: `npx tsx testes/teste_extincao_execucao.ts`; se mudar de lugar, ajuste aqui)
function checkIsDispositivoSentenca(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();

    // Saneamento (art. 357 do CPC) não é sentença, mesmo decidindo pedidos, habilitação ou prazos; só vira sentença com marcador forte de julgamento do mérito ou extinção.
    if (/\bdou\s+(?:o\s+)?(?:processo\s+)?por\s+saneado|decis[aã]o\s+saneadora|art(?:igo|\.)\s*357/.test(lower)
        && !/julgo\s+(?:im)?procedente|julgo\s+parcialmente|extingo\s+o\s+processo|resolu[cç][aã]o\s+d[eo]\s+m[eé]rito/.test(lower)) return false;

    // Salvaguarda: Se o dispositivo é de tutela provisória / liminar / decisão interlocutória inaugural
    // (ex: defere tutela, alimentos provisórios, guarda provisória, citação e audiência) sem resolução definitiva da lide
    const isExplicitInterlocutory = (
        lower.includes("defiro a tutela") ||
        lower.includes("concedo a tutela") ||
        lower.includes("indefiro a tutela") ||
        lower.includes("defiro o pedido de tutela") ||
        lower.includes("indefiro o pedido de tutela") ||
        lower.includes("acolho o pedido de tutela") ||
        lower.includes("rejeito o pedido de tutela") ||
        lower.includes("defiro o pedido liminar") ||
        lower.includes("indefiro o pedido liminar") ||
        lower.includes("defiro a medida liminar") ||
        lower.includes("indefiro a medida liminar") ||
        lower.includes("alimentos provisórios") ||
        lower.includes("alimentos provisorios") ||
        lower.includes("guarda provisória") ||
        lower.includes("guarda provisoria") ||
        lower.includes("guarda unilateral provisória") ||
        lower.includes("fixo os alimentos provisórios") ||
        lower.includes("fixo os alimentos provisorios") ||
        lower.includes("tutela de urgência") ||
        lower.includes("tutela de urgencia") ||
        lower.includes("tutela provisória") ||
        lower.includes("tutela provisoria") ||
        lower.includes("decisão interlocutória") ||
        lower.includes("decisao interlocutoria")
    ) && (
        lower.includes("cite-se") ||
        lower.includes("intime-se") ||
        lower.includes("audiência de conciliação") ||
        lower.includes("audiencia de conciliacao") ||
        lower.includes("audiência de mediação") ||
        lower.includes("audiencia de mediacao") ||
        lower.includes("art. 334") ||
        lower.includes("art. 695") ||
        lower.includes("apresentar contestação") ||
        lower.includes("oficie-se à fonte pagadora") ||
        lower.includes("ofício à fonte pagadora") ||
        lower.includes("desconto em folha") ||
        lower.includes("sob pena de multa") ||
        lower.includes("astreintes")
    ) && !(
        lower.includes("julgo procedente a ação") ||
        lower.includes("julgo improcedente a ação") ||
        lower.includes("julgo parcialmente procedente a ação") ||
        lower.includes("art. 487") ||
        lower.includes("artigo 487") ||
        lower.includes("art. 485") ||
        lower.includes("artigo 485") ||
        lower.includes("extingo o processo com") ||
        lower.includes("extingo o processo sem")
    );

    if (isExplicitInterlocutory) {
        return false;
    }

    return (
        lower.includes("julgo procedente") || 
        lower.includes("julgo improcedente") || 
        lower.includes("julgo parcialmente procedente") ||
        lower.includes("parcial procedência") ||
        lower.includes("parcial procedencia") ||
        lower.includes("parcialmente procedente") ||
        lower.includes("julgo procedentes") ||
        lower.includes("julgo improcedentes") ||
        lower.includes("julga-se procedente") ||
        lower.includes("julga-se improcedente") ||
        lower.includes("julga-se parcialmente procedente") ||
        lower.includes("declaro a procedência") ||
        lower.includes("declaro a procedencia") ||
        lower.includes("declaro a improcedência") ||
        lower.includes("declaro a improcedencia") ||
        lower.includes("acolho em parte o mérito") ||
        /\b(acolho|rejeito)\s+(em\s+parte\s+)?(o|os)\s+pedidos?\s+(formulados?\s+)?(na|da)\s+(inicial|exordial)|\b(acolho|rejeito)\s+(o|os)\s+pedidos?\s+(autorais?|iniciais?|principais?)/.test(lower) ||      // só o pedido da inicial; "acolho o pedido de habilitação" etc. é decisão, não sentença
        lower.includes("resolução do mérito") ||
        lower.includes("resolucao do merito") ||
        lower.includes("resolvendo o mérito") ||
        lower.includes("resolvendo o merito") ||
        lower.includes("com resolução de mérito") ||
        lower.includes("com resolucao de merito") ||
        lower.includes("com resolução do mérito") ||
        lower.includes("com resolucao do merito") ||
        lower.includes("extingo o processo") ||
        lower.includes("extinção do processo") ||
        lower.includes("extincao do processo") ||
        lower.includes("extinção do feito") ||
        lower.includes("extincao do feito") ||
        lower.includes("julgo extinto") ||
        lower.includes("julga-se extinto") ||
        lower.includes("julgo extinta") ||
        lower.includes("condeno a parte ré a pagar") ||
        lower.includes("condeno a parte requerida a pagar") ||
        lower.includes("condeno o réu a pagar") ||
        lower.includes("condeno o requerido a pagar") ||
        lower.includes("condeno a reclamada a pagar") ||
        // extinção da EXECUÇÃO / do CUMPRIMENTO (arts. 924 e 925 do CPC) também é sentença
        /\b(?:declaro|julgo|extingo)\s+(?:extint[ao]\s+|satisfeit[ao]\s+)?(?:a\s+execu[cç][aã]o|o\s+cumprimento(?:\s+de\s+senten[cç]a)?)|\bextin[gç][oã]o\s+da\s+execu[cç][aã]o|julgo\s+(?:satisfeita|cumprida)\s+a\s+obriga[cç][aã]o|art(?:igo|\.)\s*925\b/.test(lower)
    );
}


const ok = (c: boolean, t: string) => { if (!c) { console.error("FALHOU:", t); process.exit(1); } console.log("ok:", t); };
ok(checkIsDispositivoSentenca("JULGO EXTINTO o cumprimento de sentença, nos termos dos arts. 924, II, e 925 do CPC."), "julgo extinto o cumprimento");
ok(checkIsDispositivoSentenca("DECLARO EXTINTA A EXECUÇÃO pelo pagamento, nos termos dos arts. 924, II, e 925 do CPC."), "declaro extinta a execução");
ok(checkIsDispositivoSentenca("Extingo o cumprimento de sentença pela satisfação da obrigação (art. 924, II, e art. 925 do CPC)."), "extingo o cumprimento de sentença");
ok(checkIsDispositivoSentenca("Julgo satisfeita a obrigação e extingo a execução, com fundamento no art. 925 do CPC."), "julgo satisfeita a obrigação / extingo a execução");
ok(!checkIsDispositivoSentenca("Defiro o levantamento do valor e determino o arquivamento dos autos."), "despacho de arquivamento não vira sentença");
ok(!checkIsDispositivoSentenca("Intime-se o executado para pagar em 15 dias, sob pena de multa (art. 523 do CPC)."), "intimação para pagar não vira sentença");
ok(!checkIsDispositivoSentenca("Recebo os embargos e determino a intimação do embargado para impugnar em 15 dias."), "recebimento de embargos não vira sentença");
console.log("TUDO OK");
