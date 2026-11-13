// Detector de FASE do processo, por código (sem IA), para TODOS os processos (o "mapa" só existe nos autos gigantes).
// Lê o QUADRO DE MOVIMENTAÇÕES que a extensão manda (tipos das movimentações) e a classe da capa. Serve de DICA ao motor, nunca de ordem:
// o texto dos autos continua valendo. Alimenta: (a) aviso de fase no pedido ao motor, (b) conferência da minuta, (c) filtro das teses do Caderno.
// Desligar tudo de uma vez: variável de ambiente MOTORES_FASE=off no servidor (volta ao comportamento anterior).

export type FaseProcesso = "conhecimento" | "pos_sentenca" | "recursal" | "cumprimento" | "execucao" | "embargos" | "indefinida";
export interface FaseDetectada {
  fase: FaseProcesso;
  jaSentenciado: boolean;
  sentencaMov?: number;
  transitou: boolean;
  /** "alta" = a classe da capa ou o quadro de movimentações confirmam; "media" = só pistas no texto; "baixa" = nada claro. */
  confianca: "alta" | "media" | "baixa";
  sinais: string[];
}

const semAc = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const RX_SENTENCA = /\b(julgad[oa]s?\s+(procedente|improcedente|parcialmente)|julgo\s+(procedente|improcedente|parcialmente)|senten[cç]a\b|homologad[oa]\s+(a\s+)?(transa[cç][aã]o|acordo|desist[eê]ncia|ren[uú]ncia|reconhecimento)|extint[oa]s?\s+o\s+processo|extin[cç][aã]o\s+do\s+processo|resolvido\s+o\s+m[eé]rito|julgado\s+extint)/i;
const RX_NAO_SENTENCA = /embargos?\s+de\s+declara|recurso|apela[cç][aã]o|contrarraz|certid[aã]o\s+de\s+tr|expedi[cç][aã]o|intima[cç][aã]o|publica[cç][aã]o|juntada|conclus[aã]o|remessa/i;
const RX_TRANSITO = /tr[aâ]nsito\s+em\s+julgado|transitad[oa]\s+em\s+julgado|certificado\s+o\s+tr[aâ]nsito/i;
const RX_CUMPRIMENTO = /cumprimento\s+de\s+senten[cç]a|in[ií]cio\s+d[oe]\s+cumprimento|impugna[cç][aã]o\s+(ao|do|a)\s+cumprimento|intima[cç][aã]o\s+para\s+(pagar|cumprir)|art\.?\s*523/i;
const RX_EXECUCAO = /execu[cç][aã]o\s+(de\s+t[ií]tulo|fiscal|por\s+quantia|de\s+alimentos|de\s+obriga)|cita[cç][aã]o\s+para\s+pagar\s+em\s+3|penhora|bacenjud|sisbajud|renajud/i;
const RX_EMBARGOS_EXEC = /embargos?\s+(a|à)\s+execu[cç][aã]o|embargos?\s+do\s+executado|embargos?\s+de\s+terceiro/i;
const RX_RECURSO = /\b(apela[cç][aã]o|recurso\s+inominado|contrarraz[oõ]es|recurso\s+de\s+apela)/i;

/** Linhas do quadro: "Mov. 12 · 03/05/2024 · Julgada procedente a ação — complemento · por Fulano · com arquivo(s)". */
export function movimentosDoQuadro(texto: string): { n: number; tipo: string; linha: string }[] {
  const t = String(texto || "");
  const i = t.indexOf("[QUADRO DE MOVIMENTA");
  if (i < 0) return [];
  const f = t.indexOf("[FIM DO QUADRO", i);
  const corpo = t.slice(i, f > 0 ? f : i + 400000);
  const out: { n: number; tipo: string; linha: string }[] = [];
  for (const linha of corpo.split("\n")) {
    const m = linha.match(/^Mov\.\s*(\d{1,4})\s*·\s*[^·]*·\s*(.+)$/);
    if (m) out.push({ n: +m[1], tipo: m[2].split(/\s·\s(?:por\s|com arquivo|arquivos:)/)[0], linha });      // sem o nome dos arquivos ("sentenca.pdf" não é sentença)
  }
  return out;
}

const classeDaCapa = (texto: string): string => {
  const cab = String(texto || "").slice(0, 12000);
  const m = cab.match(/Classe(?:\s+Processual)?\s*[:\-–]\s*([^\n\r]{3,120})/i);
  if (!m) return "";
  // o texto extraído do PDF pode juntar linhas: corta no próximo rótulo da capa para não pegar texto alheio
  return m[1].split(/\s{2,}|\s(?=(?:Autor|Requerente|Exequente|Embargante|Impugnante|Assunto|Valor|R[ée]u|Requerid|Executad|Polo|Data|Distribui|Ju[ií]z|Vara|Comarca|Promovente)\w*\s*[:\-–])/i)[0].trim().slice(0, 80);
};

export function detectarFase(texto: string): FaseDetectada {
  const sinais: string[] = [];
  const movs = movimentosDoQuadro(texto);
  const classe = classeDaCapa(texto);
  const c = semAc(classe);
  let fase: FaseProcesso = "indefinida";
  let confianca: FaseDetectada["confianca"] = "baixa";

  // 1) classe da capa (a mais confiável)
  if (c) {
    if (/embargos?\s+(a|à)\s*execu|embargos?\s+de\s+terceiro/.test(c)) { fase = "embargos"; confianca = "alta"; sinais.push(`classe da capa: ${classe}`); }
    else if (/cumprimento\s+de\s+senten/.test(c)) { fase = "cumprimento"; confianca = "alta"; sinais.push(`classe da capa: ${classe}`); }
    else if (/execu[cç][aã]o|execucao/.test(c)) { fase = "execucao"; confianca = "alta"; sinais.push(`classe da capa: ${classe}`); }
  }

  // 2) sentença / trânsito / cumprimento pelos tipos das movimentações
  let sentencaMov: number | undefined; let transitou = false; let movCumprimento: number | undefined; let movRecurso: number | undefined;
  for (const m of movs) {
    const t = m.tipo;
    if (RX_SENTENCA.test(t) && !RX_NAO_SENTENCA.test(t)) sentencaMov = Math.max(sentencaMov ?? 0, m.n);
    if (RX_TRANSITO.test(t)) transitou = true;
    if (RX_CUMPRIMENTO.test(t)) movCumprimento = Math.max(movCumprimento ?? 0, m.n);
    if (RX_RECURSO.test(t)) movRecurso = Math.max(movRecurso ?? 0, m.n);
  }
  if (sentencaMov) sinais.push(`sentença/julgamento na Mov. ${sentencaMov}`);
  if (transitou) sinais.push("há trânsito em julgado nas movimentações");
  if (movCumprimento) sinais.push(`movimentação de cumprimento na Mov. ${movCumprimento}`);
  if (movRecurso) sinais.push(`recurso/apelação na Mov. ${movRecurso}`);

  if (fase === "indefinida" && movs.length) {
    if (movs.some((m) => RX_EMBARGOS_EXEC.test(m.tipo))) { fase = "embargos"; confianca = "alta"; sinais.push("movimentação de embargos à execução"); }
    else if (movCumprimento && (!sentencaMov || movCumprimento >= sentencaMov - 1 || transitou)) { fase = "cumprimento"; confianca = "alta"; }
    else if (movs.some((m) => RX_EXECUCAO.test(m.tipo)) && sentencaMov) { fase = "execucao"; confianca = "media"; }
    else if (sentencaMov && movRecurso && movRecurso > sentencaMov && !transitou) { fase = "recursal"; confianca = "media"; }
    else if (sentencaMov) { fase = "pos_sentenca"; confianca = "media"; }
    else { fase = "conhecimento"; confianca = "media"; }
  }

  // 3) sem quadro: pistas no texto (confiança média/baixa)
  if (fase === "indefinida") {
    const cab = String(texto || "").slice(0, 60000);
    if (RX_EMBARGOS_EXEC.test(cab.slice(0, 6000))) { fase = "embargos"; confianca = "media"; sinais.push("texto da capa fala em embargos à execução"); }
    else if (/cumprimento\s+de\s+senten[cç]a/i.test(cab.slice(0, 6000))) { fase = "cumprimento"; confianca = "media"; sinais.push("texto da capa fala em cumprimento de sentença"); }
  }

  return { fase, jaSentenciado: !!sentencaMov || fase === "cumprimento",sentencaMov, transitou, confianca, sinais };
}

export const fasesDeExecucao: FaseProcesso[] = ["cumprimento", "execucao", "embargos"];
export const ehFaseDeExecucao = (f: FaseDetectada): boolean => fasesDeExecucao.includes(f.fase) && f.confianca !== "baixa";

const NOME: Record<FaseProcesso, string> = {
  conhecimento: "fase de conhecimento (ainda sem sentença)", pos_sentenca: "já sentenciado (pós-sentença, antes do cumprimento)", recursal: "fase recursal (há sentença e recurso pendente)",
  cumprimento: "CUMPRIMENTO DE SENTENÇA", execucao: "EXECUÇÃO", embargos: "EMBARGOS à execução / do executado / de terceiro", indefinida: "não identificada",
};
export const nomeDaFase = (f: FaseProcesso) => NOME[f];

/** Aviso curto ao motor. É uma DICA lida do quadro de movimentações e da capa; o texto dos autos prevalece. */
export function blocoFaseParaMotor(f: FaseDetectada): string {
  if (f.fase === "indefinida" || f.confianca === "baixa") return "";
  const L = [`\n\n[DICA DE FASE PROCESSUAL — lida por código do quadro de movimentações/capa (confiança ${f.confianca}); se os autos mostrarem outra coisa, prevalecem os autos]`,
    `- Fase provável: ${nomeDaFase(f.fase)}${f.sentencaMov ? ` — há sentença/julgamento na Mov. ${f.sentencaMov}` : ""}${f.transitou ? "; consta trânsito em julgado" : ""}.`,
    `- Sinais: ${f.sinais.join("; ") || "—"}.`];
  if (f.fase === "cumprimento") L.push("- Em cumprimento de sentença NÃO se reabre o mérito: o título já existe. Decida só a questão pendente da fase (início/intimação para pagar, impugnação, excesso de execução, penhora, extinção pelo pagamento etc.). Nulidade do contrato, restituição e dano moral já foram decididos ou preclusos, salvo vício que a lei permita alegar na impugnação (art. 525, §1º, CPC).");
  else if (f.fase === "execucao") L.push("- Em execução decide-se sobre o título, a penhora e a satisfação do crédito; não se rediscute o mérito do negócio fora dos embargos e das hipóteses legais.");
  else if (f.fase === "embargos") L.push("- Em EMBARGOS recebe-se (ou rejeita-se liminarmente) e decide-se o efeito suspensivo; só depois, se for o caso, abre-se o contraditório. Não sanear nem fixar pontos controvertidos no ato de recebimento, e não julgar o mérito sem a fase própria.");
  else if (f.fase === "pos_sentenca" || f.fase === "recursal") L.push("- O processo já foi sentenciado: não repita a sentença. O ato certo é o que resolve o pendente (embargos de declaração, recurso, cumprimento, certidão de trânsito etc.), que pode, conforme o caso, ser até uma extinção.");
  return L.join("\n");
}

// ---------- Teses do Caderno por fase ----------
const RX_TESE_MERITO = /nulidade\s+(do|de)\s+contrato|inexist[eê]ncia\s+(da|de)\s+(d[ií]vida|rela[cç][aã]o)|repeti[cç][aã]o\s+(do\s+ind[eé]bito|em\s+dobro)|restitui[cç][aã]o\s+em\s+dobro|dano\s+moral|danos\s+morais|v[ií]cio\s+do\s+produto|responsabilidade\s+civil|cl[aá]usula\s+abusiva|juros\s+remunerat[oó]rios|capitaliza[cç][aã]o|taxa\s+de\s+juros|revisional|tarifa|seguro\s+prestamista|venda\s+casada|negativa[cç][aã]o|inscri[cç][aã]o\s+indevida|falha\s+na\s+presta[cç][aã]o/i;
const RX_TESE_DA_FASE = /cumprimento|execu[cç][aã]o|impugna[cç][aã]o|penhora|excesso|prescri[cç][aã]o\s+intercorrente|embargos|art\.?\s*(523|525|525|916|917|924|925|854)|sisbajud|bacenjud|renajud|alvar[aá]|extin[cç][aã]o\s+pelo\s+pagamento|honor[aá]rios\s+(na\s+fase|do\s+cumprimento)|liquida[cç][aã]o|astreintes|multa\s+di[aá]ria/i;
const RX_TESE_CONDICIONAL = /suspei|impediment|foro\s+[ií]ntimo|gratuidade|justi[cç]a\s+gratuita|custas|provimento|corregedoria|competência|competencia|litispend|coisa\s+julgada|ilegitimidade/i;

/**
 * Em cumprimento/execução/embargos tira do Caderno os blocos de tese de MÉRITO (nulidade do contrato, dano moral, repetição…) que só empurram a IA a reabrir o que já foi decidido.
 * Conservador: só some um bloco (separado por linha em branco) se tiver pista de mérito, nenhuma pista da fase nem condicional. Na dúvida, mantém.
 */
export function filtrarTesesPorFase(tesesTexto: string, f: FaseDetectada): { texto: string; removidos: number; titulos: string[] } {
  const raw = String(tesesTexto || "");
  if (!raw.trim() || !ehFaseDeExecucao(f)) return { texto: raw, removidos: 0, titulos: [] };
  const blocos = raw.split(/\n\s*\n/);
  if (blocos.length < 2) return { texto: raw, removidos: 0, titulos: [] };
  const keep: string[] = []; const titulos: string[] = []; let removidos = 0;
  for (const b of blocos) {
    const t = semAc(b);
    const merito = RX_TESE_MERITO.test(b) || RX_TESE_MERITO.test(t);
    const daFase = RX_TESE_DA_FASE.test(b) || RX_TESE_DA_FASE.test(t);
    const cond = RX_TESE_CONDICIONAL.test(b) || RX_TESE_CONDICIONAL.test(t);
    if (merito && !daFase && !cond && b.trim().length < 6000) { removidos++; titulos.push(b.trim().split("\n")[0].slice(0, 90)); }
    else keep.push(b);
  }
  if (!removidos) return { texto: raw, removidos: 0, titulos: [] };
  return { texto: keep.join("\n\n"), removidos, titulos };
}
