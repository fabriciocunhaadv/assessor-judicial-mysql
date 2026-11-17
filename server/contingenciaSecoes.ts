// CONTINGÊNCIA POR SEÇÕES: quando os modelos fortes não respondem (Google sobrecarregado) mesmo depois da espera, o modelo LEVE costuma entregar minuta curta, porque recebe um pedido enorme e resume.
// Em vez de pedir a minuta inteira numa chamada, pede UMA PARTE por vez (roteiro, cada tópico da fundamentação, relatório e dispositivo), cada uma com tarefa pequena e tamanho mínimo, e monta o texto em código.
// Módulo puro: não chama a IA nem a rede; quem chama é a função `gerar` recebida (o server.ts liga à esteira de modelos). A minuta montada sai SEMPRE com aviso de contingência na tela.

export interface MinutaCampos { relatorio: string; fundamentacao: string; dispositivo: string }
export interface Pisos { rel: number; fund: number; disp: number; par: number }
export type EtapaSecao = "roteiro" | "topico" | "relatorio" | "dispositivo";
export interface EntradaSecoes {
  /** Chamada à IA (esteira de modelos). `json` = pede resposta em JSON. Devolve o texto da resposta; pode lançar. */
  gerar: (p: { etapa: EtapaSecao; instrucao: string; json?: boolean }) => Promise<string>;
  minuta: MinutaCampos;
  falhas: string[];
  pisos: Pisos;
  /** fator de escala dos pisos (ex.: 1,2 para autos grandes) */
  fator?: number;
  aoProgresso?: (t: string) => void;
  maxTopicos?: number;
}
export interface SaidaSecoes extends MinutaCampos { topicos: number; chamadas: number }

interface Topico { titulo: string; questao: string; provas: { loc: string; trecho: string }[]; normas: string[]; argumentos: string[] }
interface Roteiro { topicos: Topico[]; cronologia: { loc: string; ato: string }[]; resultados: { pedido: string; resultado: string; comando: string }[] }

const MARCA = { roteiro: "[[CONTINGENCIA:ROTEIRO]]", topico: "[[CONTINGENCIA:TOPICO]]", relatorio: "[[CONTINGENCIA:RELATORIO]]", dispositivo: "[[CONTINGENCIA:DISPOSITIVO]]" };
export const MARCAS_CONTINGENCIA = MARCA;

const txt = (v: any, n = 4000) => String(v ?? "").trim().slice(0, n);
const lista = (v: any): any[] => (Array.isArray(v) ? v : []);

export function lerRoteiro(bruto: string): Roteiro | null {
  const limpo = String(bruto || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  let j: any = null;
  try { j = JSON.parse(limpo); } catch { const m = limpo.match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch { /* sem JSON */ } } }
  if (!j || typeof j !== "object") return null;
  const topicos: Topico[] = lista(j.topicos).map((t: any) => ({
    titulo: txt(t?.titulo, 160), questao: txt(t?.questao, 600),
    provas: lista(t?.provas).map((p: any) => ({ loc: txt(p?.loc, 80), trecho: txt(p?.trecho, 700) })).filter((p) => p.trecho || p.loc).slice(0, 8),
    normas: lista(t?.normas).map((n: any) => txt(n, 200)).filter(Boolean).slice(0, 8),
    argumentos: lista(t?.argumentos).map((n: any) => txt(n, 300)).filter(Boolean).slice(0, 8),
  })).filter((t) => t.titulo || t.questao);
  if (!topicos.length) return null;
  return {
    topicos,
    cronologia: lista(j.cronologia).map((c: any) => ({ loc: txt(c?.loc, 80), ato: txt(c?.ato, 400) })).filter((c) => c.ato).slice(0, 60),
    resultados: lista(j.resultados).map((r: any) => ({ pedido: txt(r?.pedido, 300), resultado: txt(r?.resultado, 80), comando: txt(r?.comando, 600) })).filter((r) => r.pedido || r.comando).slice(0, 30),
  };
}

/** O prompt do sistema pede JSON; se o modelo devolver o campo em JSON em vez de texto puro, extrai o campo certo; tira cercas de código. */
export function desenvelopar(etapa: EtapaSecao, bruto: string): string {
  let t = String(bruto || "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  if (t.startsWith("{")) {
    try {
      const j: any = JSON.parse(t); const campo = etapa === "topico" ? "fundamentacao" : etapa === "relatorio" ? "relatorio" : "dispositivo";
      const v = j?.[campo] ?? j?.minute?.[campo] ?? j?.texto; if (typeof v === "string" && v.trim()) t = v.trim();
    } catch { /* texto que começa com chave mas não é JSON */ }
  }
  return t;
}
const palavras = (s: string) => (String(s).match(/\S+/g) || []).length;
const REGRAS_ESCRITA = `Regras: texto corrido e ENCADEADO (cada parágrafo parte do anterior, com conectivos), linguagem formal, sem títulos, sem listas, sem primeira pessoa e sem referência a estas instruções. Cite cada prova com Mov./Arq./Pág. como nas evidências fornecidas; transcreva entre aspas o trecho da lei, súmula ou precedente SOMENTE se o texto constar do material fornecido (instruções do sistema ou autos), nunca de memória; não invente fato, data, valor, documento nem decisão.`;

/** Monta a minuta por seções. Devolve null se o roteiro não puder ser obtido (o chamador mantém o aviso de minuta curta). */
export async function expandirPorSecoes(e: EntradaSecoes): Promise<SaidaSecoes | null> {
  const { gerar, minuta, pisos } = e, fator = e.fator ?? 1, prog = e.aoProgresso || (() => {});
  const maxTop = Math.max(2, Math.min(12, e.maxTopicos ?? 8));
  let chamadas = 0;
  const chamar = async (etapa: EtapaSecao, instrucao: string, json = false): Promise<string> => { chamadas++; return (etapa === "roteiro" ? String(await gerar({ etapa, instrucao, json }) || "") : desenvelopar(etapa, String(await gerar({ etapa, instrucao, json }) || ""))); };

  // 1) ROTEIRO: tópicos, provas com localização, cronologia e resultado de cada pedido (uma chamada, com os autos)
  prog("modo de contingência por seções: montando o roteiro da decisão…");
  let roteiro: Roteiro | null = null;
  for (let t = 1; t <= 2 && !roteiro; t++) {
    try {
      roteiro = lerRoteiro(await chamar("roteiro", `${MARCA.roteiro}
Os modelos mais completos estão indisponíveis; a minuta será montada POR SEÇÕES. Esta é a etapa do ROTEIRO. Leia os autos e a minuta preliminar abaixo (que ficou resumida) e responda SOMENTE um JSON válido:
{"topicos":[{"titulo":"assunto concreto do tópico (preliminar, tese de defesa, prova, pedido...)","questao":"o que precisa ser decidido neste tópico","provas":[{"loc":"Mov. N, Arq. M, Pág. K","trecho":"trecho LITERAL curto do documento"}],"normas":["dispositivo, súmula ou tese aplicável, como consta do material fornecido"],"argumentos":["argumento de cada parte que o tópico deve enfrentar"]}],
"cronologia":[{"loc":"Mov. N, Arq. M, Pág. K","ato":"ato processual relevante, com a data"}],
"resultados":[{"pedido":"cada pedido, preliminar ou questão","resultado":"acolhido|rejeitado|parcialmente acolhido|prejudicado","comando":"o que o dispositivo deve ordenar (valores, prazos, índices e termos iniciais quando houver)"}]}
Regras: de 3 a ${maxTop} tópicos, na ordem em que serão decididos (questões processuais antes do mérito; cada pedido e cada tese de defesa em tópico próprio); ao menos uma prova com localização por tópico quando existir nos autos; só o que consta dos autos; o resultado de cada pedido deve ser coerente com a minuta preliminar.
Motivo da contingência: ${e.falhas.join("; ") || "minuta abaixo do piso de profundidade"}.
MINUTA PRELIMINAR:
${JSON.stringify(minuta)}`, true));
    } catch { roteiro = null; }
  }
  if (!roteiro) return null;
  const topicos = roteiro.topicos.slice(0, maxTop);

  // 2) UM TÓPICO POR VEZ (chamada pequena, com tamanho mínimo)
  const alvoFund = Math.ceil(pisos.fund * fator * 0.6);       // 60% do piso cheio: é o piso dos modelos profundos; o leve parte do mesmo alvo
  const minChars = Math.max(900, Math.ceil(alvoFund / topicos.length));
  const partes: string[] = [];
  for (let i = 0; i < topicos.length; i++) {
    const t = topicos[i];
    prog(`modo de contingência por seções: tópico ${i + 1} de ${topicos.length} (${t.titulo || t.questao}).`);
    const base = `${MARCA.topico}
Escreva SOMENTE a parte da FUNDAMENTAÇÃO referente ao tópico ${i + 1} de ${topicos.length}: "${t.titulo}". Questão a decidir: ${t.questao}
Escreva de 3 a 6 parágrafos densos, com no mínimo ${minChars} caracteres, analisando cada argumento abaixo, examinando as provas pelo que contêm (partes, datas, valores, assinatura, origem), aplicando a norma ao caso e concluindo o tópico.
${REGRAS_ESCRITA}
Argumentos a enfrentar: ${JSON.stringify(t.argumentos)}
Provas (localização e trecho literal): ${JSON.stringify(t.provas)}
Normas indicadas no roteiro: ${JSON.stringify(t.normas)}
${i > 0 ? `Tópicos anteriores já escritos (não repita): ${topicos.slice(0, i).map((x) => x.titulo).join("; ")}.` : ""}
Responda APENAS com o texto dos parágrafos.`;
    let texto = "";
    try { texto = txt(await chamar("topico", base), 20000); } catch { texto = ""; }
    if (texto.length < minChars * 0.7) {      // curto: uma nova tentativa pedindo ampliação
      try { const mais = txt(await chamar("topico", `${base}\nA resposta anterior ficou CURTA (${texto.length} caracteres). Reescreva ampliando a análise até pelo menos ${minChars} caracteres, sem repetir frases.${texto ? `\nResposta anterior:\n${texto}` : ""}`), 20000); if (mais.length > texto.length) texto = mais; } catch { /* mantém */ }
    }
    if (texto) partes.push(texto);
  }
  if (!partes.length) return null;
  const fundamentacao = partes.join("\n\n");

  // 3) RELATÓRIO (cronologia)
  prog("modo de contingência por seções: escrevendo o relatório…");
  let relatorio = minuta.relatorio;
  try {
    const r = txt(await chamar("relatorio", `${MARCA.relatorio}
Escreva SOMENTE o RELATÓRIO da decisão, em ordem cronológica, com no mínimo ${Math.ceil(pisos.rel * fator * 0.6)} caracteres: o pedido e as defesas (fiéis ao que as partes alegaram), os atos processuais relevantes com a data e a localização (Mov./Arq./Pág.), as provas produzidas e o que está pendente. Sem conclusões jurídicas nem juízo de valor.
${REGRAS_ESCRITA}
Cronologia levantada: ${JSON.stringify(roteiro.cronologia)}
Relatório preliminar (pode estar resumido; aproveite os fatos corretos): ${JSON.stringify(minuta.relatorio)}
Responda APENAS com o texto do relatório.`), 20000);
    if (r.length > minuta.relatorio.length) relatorio = r;
  } catch { /* mantém o preliminar */ }

  // 4) DISPOSITIVO (resultado de cada pedido)
  prog("modo de contingência por seções: escrevendo o dispositivo…");
  let dispositivo = minuta.dispositivo;
  try {
    const d = txt(await chamar("dispositivo", `${MARCA.dispositivo}
Escreva SOMENTE o DISPOSITIVO, completo e executável, coerente com a fundamentação: o resultado de cada pedido e de cada preliminar, as obrigações com prazos, valores, índices de correção e juros com os termos iniciais, custas e honorários conforme o resultado, e as providências finais. Mantenha TODOS os comandos corretos do dispositivo preliminar (partes, valores, prazos) e não decida em sentido contrário ao que a fundamentação concluiu.
${REGRAS_ESCRITA}
Resultado de cada pedido (do roteiro): ${JSON.stringify(roteiro.resultados)}
Dispositivo preliminar: ${JSON.stringify(minuta.dispositivo)}
Responda APENAS com o texto do dispositivo.`), 12000);
    if (d.length >= Math.min(minuta.dispositivo.length, 200) && d.length > 40) dispositivo = d;
  } catch { /* mantém o preliminar */ }

  prog(`modo de contingência por seções: montagem concluída (${palavras(fundamentacao)} palavras na fundamentação).`);
  return { relatorio, fundamentacao, dispositivo, topicos: partes.length, chamadas };
}
