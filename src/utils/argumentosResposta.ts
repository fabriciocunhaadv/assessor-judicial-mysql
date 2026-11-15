// ARGUMENTO × RESPOSTA — além do "Fato × Prova". Regra única (texto) usada por todos os motores que redigem minuta (principal etapas 1 e 2, Turbo, gigante e Mutirão, que passam pelo principal)
// e pela Lupa (auditoria), mais a conferência por código da matriz que a etapa 2 devolve. Vale para qualquer processo: as cláusulas são condicionais e variam conforme o ATO e a MATÉRIA.
// Desligar tudo de uma vez: variável de ambiente ARGUMENTOS_RESPOSTA=off no servidor (volta ao comportamento anterior).

export type AtoParaArgumentos = "sentenca" | "decisao" | "saneamento" | "embargos" | "despacho" | "indefinido";

const semAc = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Classifica o ato pelo tipo informado ao motor ("sentenca", "decisao", "auto", título da minuta…). */
export function atoParaArgumentos(texto?: string): AtoParaArgumentos {
  const t = semAc(texto || "");
  if (/embargos? de declara/.test(t)) return "embargos";
  if (/saneament|organiza[cç][aã]o do processo|art\.? ?357/.test(t)) return "saneamento";
  if (/senten/.test(t)) return "sentenca";
  if (/despach/.test(t)) return "despacho";
  if (/decis|tutela|liminar|interlocut/.test(t)) return "decisao";
  return "indefinido";
}

const BASE = `

[ARGUMENTO × RESPOSTA — ALÉM DO "FATO × PROVA" (art. 489, § 1º, IV, do CPC)]
O ato não confere só o que os documentos provam: ele também RESPONDE aos argumentos das partes. Etapa interna (NÃO a imprima como título, quadro ou lista): antes de redigir, liste os argumentos relevantes de CADA parte, do Ministério Público e de terceiros (petição inicial, emendas, contestação, réplica, manifestações, alegações finais ou memoriais, e a petição que o ato aprecia), inclusive os subsidiários, as preliminares, as prejudiciais, as nulidades, o pedido contraposto ou a reconvenção e as teses de defesa. Cada argumento relevante precisa de RESPOSTA na minuta: acolhido, rejeitado ou prejudicado (dizendo por quê), com a razão jurídica e a base: o dispositivo legal, a súmula ou precedente com fonte, o documento (Mov./Arq./Pág.) ou a prova oral (com o minuto, se houver). É proibido decidir só pelo resultado e deixar sem resposta um argumento relevante, e também responder a argumento que a parte não formulou. A resposta vem DENTRO do texto corrido, na ordem lógica (preliminares, prejudiciais, mérito). Se o texto trouxer um dossiê com as seções "ALEGAÇÕES DO AUTOR" e "DEFESA E ALEGAÇÕES DO RÉU", cada item é um argumento a enfrentar.

[RELAÇÃO ALEGADA E MEIOS DE PROVA]
Identifique a relação jurídica que cada parte afirma (quem contratou ou se relacionou com quem, em que qualidade, o que foi ajustado) e os fatos que a compõem. NÃO conclua que "não há relação" ou "não há prova" só porque um documento não traz o nome da parte ou porque ela não é signatária dele: documento de terceiros ou entre outras pessoas (por exemplo, o contrato do réu com uma instituição financeira) prova fatos (valores, datas, origem do dinheiro, existência da obra ou do serviço) mesmo que a parte não figure nele. Antes de aplicar o ônus da prova (art. 373), examine TODOS os meios disponíveis: ajuste verbal ou tácito (quando a lei não exigir forma especial; art. 107 do CC), prova oral, admissão da parte contrária, documentos de terceiros, transferências e comprovantes, mensagens, a conduta posterior das partes e as presunções (art. 375). Só então diga qual prova faltou e por que o conjunto não a supre.

[FATO ADMITIDO OU INCONTROVERSO]
Fato afirmado por uma parte e admitido pela outra, ou não impugnado de modo específico (art. 341 do CPC), é incontroverso e não exige prova (art. 374, II e III); indique onde foi admitido (Mov./Arq./Pág.). Limites: contestação genérica ou revelia não geram, por si, verdade dos fatos em caso de direito indisponível, pluralidade de réus com defesa de algum, inicial sem instrumento que a lei considere indispensável ou fatos inverossímeis (arts. 344 a 346 e 341, I a III). Na matéria PENAL e INFRACIONAL não há presunção de veracidade nem inversão do ônus, e a confissão é valorada com as demais provas (art. 197 do CPP). Nos Juizados vale a regra do rito. A confissão exige quem tenha poder para confessar (arts. 389 a 395).

[REGRAS DO PROCEDIMENTO DA MATÉRIA]
Para decidir cada argumento, aplique as regras do procedimento próprio da matéria indicada pela CLASSE da capa (CPC; Lei 9.099/1995 e Lei 12.153/2009 nos Juizados; CPP e leis penais; ECA; Lei 6.830/1980 na execução fiscal; leis de família e sucessões etc.), e não as de outro ramo. Se o processo estiver em cumprimento de sentença ou execução, responda à impugnação (art. 525, § 1º) ou aos embargos (art. 917) nos limites legais, sem reabrir o mérito já decidido.`;

const CLAUSULA: Record<AtoParaArgumentos, string> = {
  sentenca: `\nNA SENTENÇA: toda preliminar, prejudicial e tese de mérito (inclusive a subsidiária e a do pedido contraposto) tem resposta; o resultado do dispositivo tem de decorrer dessas respostas, e o argumento que ficou prejudicado pelo resultado é declarado prejudicado, com a razão.`,
  decisao: `\nNA DECISÃO INTERLOCUTÓRIA: responda aos argumentos de cada requisito do que se pede (por exemplo, probabilidade do direito, perigo de dano, reversibilidade) e aos da defesa, se já houver; não antecipe o mérito.`,
  saneamento: `\nNO SANEAMENTO (art. 357): responda às preliminares, delimite as questões de fato e de direito, relacione expressamente os fatos INCONTROVERSOS (art. 374) e os controvertidos, e o ônus de cada um.`,
  embargos: `\nNOS EMBARGOS DE DECLARAÇÃO: cada vício alegado (omissão, contradição, obscuridade, erro material; art. 1.022) recebe resposta própria, dizendo se existe e por quê; não reabra o mérito sem vício; se a decisão embargada já enfrentou o argumento, indique o trecho onde enfrentou (Mov./Arq./Pág.).`,
  despacho: `\nNO DESPACHO: só responda ao que foi requerido; não crie argumentos que ninguém deduziu.`,
  indefinido: `\nConforme o ATO que a minuta for: na sentença, toda preliminar, prejudicial e tese de mérito tem resposta e o dispositivo decorre delas; na decisão interlocutória, os argumentos de cada requisito do pedido; no saneamento, as preliminares e a lista dos fatos incontroversos (art. 374) e controvertidos; nos embargos de declaração, cada vício alegado; no despacho, só o que foi requerido.`,
};

/** Texto da regra para o ato (acrescentado às instruções do motor). */
export const regraArgumentoResposta = (ato?: string): string => BASE + CLAUSULA[atoParaArgumentos(ato)];

/** Instrução para a etapa 2 devolver a matriz (campo auditAnalysis.argumentoVsResposta). */
export const INSTRUCAO_MATRIZ_ARGUMENTOS = `
   - 'argumentoVsResposta': a matriz ARGUMENTO × RESPOSTA da minuta FINAL. Um item para cada argumento relevante de cada parte (e do MP): "parte" (autor, reu, mp ou terceiro), "argumento" (resumo fiel, até 200 caracteres), "localizacao" (Mov./Arq./Pág. onde foi deduzido), "resultado" (acolhido, rejeitado, prejudicado ou nao_enfrentado) e "trechoNaMinuta" (trecho LITERAL curto da minuta que responde ao argumento; vazio se nao_enfrentado). No máximo 15 itens, só os relevantes e em frases curtas (a matriz não pode estourar o limite de saída da etapa). Se algum item ficaria nao_enfrentado, REDIJA a resposta na minuta antes de preencher a matriz: ela deve refletir a minuta pronta.`;

/** Regra de conferência da Lupa (auditoria): argumento relevante sem resposta é omissão provada com trecho dos autos. */
export const REGRA_LUPA_ARGUMENTO_RESPOSTA = `
14. ARGUMENTO × RESPOSTA: além do Fato × Prova, liste os argumentos relevantes que as partes e o MP deduziram nos autos (petições, contestação, réplica, memoriais, a petição que o ato aprecia) e confira se a minuta RESPONDE a cada um (acolhendo, rejeitando ou declarando prejudicado, com razão). Argumento relevante sem resposta é "omissao" (tipoProva), com o trecho LITERAL dos autos em "autosTrecho" (Mov./Arq./Pág.): "bloqueante" se for preliminar, prejudicial, nulidade ou tese subsidiária que poderia mudar o resultado; "atenção" nos demais. NÃO aponte como omissão o argumento que a minuta respondeu de outra forma, nem o que ficou prejudicado pela conclusão e foi assim declarado.
15. RELAÇÃO E MEIOS DE PROVA: não aprove, nem deixe passar sem apontamento, a rejeição fundada só na falta de documento ou de relação entre as partes quando os autos trazem outros meios de prova (ajuste verbal admitido, prova oral, documento de terceiros, transferências, admissão na contestação). Aponte com o trecho dos autos.`;

// ---------- conferência por código da matriz devolvida pela etapa 2 ----------
export interface ItemArgumentoResposta { parte?: string; argumento?: string; localizacao?: string; resultado?: string; trechoNaMinuta?: string }
export interface ConferenciaArgumentos {
  total: number; respondidos: number;
  semResposta: ItemArgumentoResposta[];
  naoLocalizados: ItemArgumentoResposta[];
}

const norm = (s: string) => semAc(s).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const gramas = (t: string) => { const w = norm(t).split(" ").filter(Boolean), g: string[] = []; for (let i = 0; i + 4 <= w.length; i++) g.push(w.slice(i, i + 4).join(" ")); return g; };

/** O trecho que a etapa 2 diz ter usado para responder existe na minuta? (confere por quatro palavras seguidas; trecho curto confere por inclusão) */
export function trechoNaMinuta(trecho: string, minuta: string): boolean {
  const t = norm(trecho), m = norm(minuta);
  if (!t) return false;
  if (m.includes(t)) return true;
  const g = gramas(trecho); if (g.length < 3) return false;
  const achados = g.filter((x) => m.includes(x)).length;
  return achados / g.length >= 0.6;
}

/** Devolve null se a matriz não veio (nada a conferir); senão, quais argumentos ficaram sem resposta ou com resposta que não está na minuta. */
export function conferirArgumentoResposta(matriz: any, minuta: any): ConferenciaArgumentos | null {
  if (!Array.isArray(matriz) || !matriz.length) return null;
  const texto = [minuta?.relatorio, minuta?.fundamentacao, minuta?.dispositivo, minuta?.fullFormattedText].filter(Boolean).join("\n");
  const itens: ItemArgumentoResposta[] = matriz.filter((x) => x && typeof x === "object").slice(0, 40).map((x: any) => ({
    parte: String(x.parte || "").slice(0, 20), argumento: String(x.argumento || "").slice(0, 300), localizacao: String(x.localizacao || "").slice(0, 80),
    resultado: String(x.resultado || "").toLowerCase().replace(/[^a-z_]/g, ""), trechoNaMinuta: String(x.trechoNaMinuta || "").slice(0, 400),
  })).filter((x) => x.argumento);
  const semResposta: ItemArgumentoResposta[] = [], naoLocalizados: ItemArgumentoResposta[] = [];
  let respondidos = 0;
  for (const it of itens) {
    if (it.resultado === "nao_enfrentado" || it.resultado === "naoenfrentado" || !it.resultado || (!it.trechoNaMinuta && it.resultado !== "prejudicado")) { semResposta.push(it); continue; }
    if (it.trechoNaMinuta && texto && !trechoNaMinuta(it.trechoNaMinuta, texto)) { naoLocalizados.push(it); continue; }
    respondidos++;
  }
  return { total: itens.length, respondidos, semResposta, naoLocalizados };
}
