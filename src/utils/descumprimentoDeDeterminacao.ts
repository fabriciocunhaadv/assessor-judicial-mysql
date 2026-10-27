// DESCUMPRIMENTO DE DETERMINAÇÃO COM ADVERTÊNCIA: o juízo mandou a parte autora emendar/cumprir "sob pena de indeferimento da inicial" (ou de extinção), o prazo venceu e a parte não
// cumpriu (ou cumpriu só em parte). Nesse caso o ato é SENTENÇA (art. 321, parágrafo único, c/c art. 330, IV, e art. 485, I, do CPC; ou art. 485, III e § 1º, no abandono).
// Detecção só por texto (sem IA), com os carimbos "Movimentacao N : tipo" dos autos. Só DECIDE quando há certidão/indício de decurso e nenhuma peça da parte depois da determinação.

export interface Descumprimento {
  tipo: "indeferimento_inicial" | "extincao";
  movDeterminacao?: number;
  movDecurso?: number;
  parcial: boolean;            // a parte já tinha cumprido em parte (peça antes da última determinação)
  possivelCumprimento: boolean; // há peça da parte depois da determinação: pode ter cumprido
  decide: boolean;             // o sistema fixa o ato como sentença
  atoSugerido: string;
  motivo: string;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PENA = /sob\s+pena\s+(?:expressa\s+)?(?:de\s+)?(?:\w+\s+){0,2}?(indeferimento|extincao|arquivamento)/g;
const ART321 = /art(?:igo)?\.?\s*321\b/g;
const DECURSO: RegExp[] = [
  /(?:decorreu|transcorreu|escoou|expirou|esgotou-se)\s+(?:o\s+|in\s+)?(?:prazo|lapso|albis)[^.]{0,220}?(?:sem|nao|nada|in\s+albis|inerte|silenc|quedou)/,
  /prazo[^.]{0,140}?(?:decorreu|transcorreu|escoou|expirou)[^.]{0,140}?(?:sem|nao|nada|in\s+albis|inerte|silenc|quedou)/,
  /certifico[^.]{0,80}(?:decorreu|transcorreu|expirou|escoou)/, /prazo\s+(?:decorreu|transcorreu|expirou|escoou)\b/,
  /decurso\s+(?:de|do)\s+prazo/, /decorrido\s+(?:o\s+)?prazo/, /prazo\s+decorrido/, /\bin\s+albis\b/,
  /(?:deixou|deixaram)\s+(?:de\s+)?(?:se\s+manifestar|cumprir|atender)/, /nao\s+(?:se\s+manifestou|cumpriu|atendeu|apresentou|juntou|emendou|regularizou)/,
];
const PECA_DA_PARTE = /peticao|juntada\s+de\s+(?:peticao|documento)|emenda|manifesta|cumprimento|replica|documento/;
const NAO_E_PECA_DA_PARTE = /intima|expedi|certidao|decurso|publica|dispon|ato\s+ordinatorio|conclus|remessa|aviso|mandado|citacao|audiencia|despacho|decisao|sentenca|diario/;
const JA_JULGADO = /julgo\s+(?:im)?procedente|extingo\s+o\s+processo|indefiro\s+a\s+(?:peticao\s+)?inicial|\bsentenca\s+(?:proferida|publicada|registrada)/;

export function detectarDescumprimento(autos: string): Descumprimento | null {
  const t = semAcento(String(autos || ""));
  if (t.length < 400) return null;
  // carimbos: "Movimentacao 23 : Certidão ..." (ficam no rodapé da própria página)
  const carimbos: { mov: number; tipo: string; idx: number }[] = [];
  for (const m of t.matchAll(/movimentacao\s+(\d{1,4})\s*:\s*([^\n]{0,80})/g)) carimbos.push({ mov: +m[1], tipo: m[2], idx: m.index! });
  const proximoCarimbo = (idx: number) => carimbos.find((c) => c.idx > idx);

  // determinação com advertência: a ÚLTIMA ocorrência é a que vale
  let iDet = -1, tipo: Descumprimento["tipo"] = "extincao";
  for (const m of t.matchAll(PENA)) { iDet = m.index!; tipo = m[1] === "extincao" || m[1] === "arquivamento" ? "extincao" : "indeferimento_inicial"; }
  if (iDet < 0) for (const m of t.matchAll(ART321)) { if (/emend|complet/.test(t.slice(Math.max(0, m.index! - 250), m.index! + 250))) { iDet = m.index!; tipo = "indeferimento_inicial"; } }
  if (iDet < 0) return null;
  const depois = t.slice(iDet + 40);
  if (JA_JULGADO.test(depois)) return null;      // já houve sentença depois: não é o caso de decidir de novo

  // decurso/inércia depois da determinação
  let iCert = -1;
  for (const re of DECURSO) { const m = re.exec(depois); if (m && (iCert < 0 || m.index < iCert)) iCert = m.index; }
  const movDet = proximoCarimbo(iDet)?.mov;
  const temCarimbos = carimbos.length >= 3 && movDet !== undefined;
  const movDecurso = iCert >= 0 ? proximoCarimbo(iDet + 40 + iCert)?.mov : undefined;

  // peça da parte depois da determinação (cumprimento) e antes dela (cumprimento parcial anterior)
  let possivelCumprimento = false, parcial = false;
  if (temCarimbos) {
    const peca = (c: { tipo: string }) => PECA_DA_PARTE.test(c.tipo) && !NAO_E_PECA_DA_PARTE.test(c.tipo);
    possivelCumprimento = carimbos.some((c) => c.mov > (movDet as number) && peca(c) && (movDecurso === undefined || c.mov < movDecurso));
    parcial = carimbos.some((c) => c.mov > 1 && c.mov < (movDet as number) && peca(c));
  } else {
    possivelCumprimento = /em\s+cumprimento\s+(?:ao|a)\s+(?:despacho|determinacao|decisao)|cumpre[mn]?\s+a\s+determinacao|emenda\s+a\s+inicial\s+(?:apresentada|juntada)|vem\s+[^.]{0,80}(?:juntar|cumprir)/.test(depois);
  }
  if (iCert < 0) return null;      // sem decurso/inércia à vista: prazo em curso ou nada a decidir por este caminho
  const atoSugerido = tipo === "indeferimento_inicial" ? "SENTENÇA de indeferimento da petição inicial (art. 321, parágrafo único, c/c art. 330, IV, e art. 485, I, do CPC)" : "SENTENÇA de extinção sem resolução do mérito (art. 485, III e § 1º, do CPC — confira a intimação pessoal da parte)";
  const loc = (n?: number) => (n ? ` (Mov. ${n})` : "");
  const decide = !possivelCumprimento;
  const motivo = `A parte foi intimada a cumprir determinação sob pena de ${tipo === "indeferimento_inicial" ? "indeferimento da inicial" : "extinção"}${loc(movDet)}; o prazo venceu${loc(movDecurso)}` + (possivelCumprimento ? ", mas há peça da parte depois da determinação: confira se houve cumprimento." : " e não há peça da parte depois." ) + (parcial ? " A parte já havia cumprido apenas em parte antes." : "");
  return { tipo, movDeterminacao: movDet, movDecurso, parcial, possivelCumprimento, decide, atoSugerido, motivo };
}

export const REGRA_DESCUMPRIMENTO_DETERMINACAO = `

[DESCUMPRIMENTO DE DETERMINAÇÃO COM ADVERTÊNCIA — VERIFICAÇÃO OBRIGATÓRIA NA LEITURA DOS AUTOS]
Antes de definir o ato, procure nos autos a ÚLTIMA determinação do juízo à parte (emendar a inicial, complementar documentos, cumprir diligência) com advertência "sob pena de indeferimento da inicial" ou "de extinção", e verifique o que a parte fez depois (Mov./Arq./Pág.):
1. Prazo vencido sem manifestação, ou cumprimento apenas parcial (faltaram documentos ou providências determinadas): o ato é SENTENÇA de indeferimento da petição inicial, com fundamento no art. 321, parágrafo único, c/c art. 330, IV, e art. 485, I, do CPC. No relatório, descreva cada determinação, o que a parte fez ou deixou de fazer e as datas (inclusive dilações de prazo). NÃO repita o despacho de emenda quando já houve emenda e descumprimento.
2. Descumprimento de ato que só a parte podia praticar para dar andamento (abandono), com advertência de extinção: SENTENÇA de extinção sem resolução do mérito (art. 485, III), conferindo se houve intimação pessoal da parte (art. 485, § 1º).
3. Prazo ainda em curso (sem certidão de decurso nem conclusão): o ato é despacho de aguardo; não decida.
4. Parte cumpriu integralmente: siga o fluxo normal do processo (citação, tutela, saneamento etc.).
5. Cumprimento parcial: diga exatamente o que foi cumprido e o que faltou, e só indefira se o que faltou era indispensável (art. 320 do CPC).`;

/** Bloco dinâmico para o prompt quando a detecção por texto encontrou o descumprimento. */
export function blocoDescumprimentoDetectado(d: Descumprimento): string {
  return `\n\n[DETECÇÃO AUTOMÁTICA NOS AUTOS — DESCUMPRIMENTO DE DETERMINAÇÃO]\n${d.motivo}\n${d.decide ? `Ato esperado: ${d.atoSugerido}. Confirme nos autos (Mov./Arq./Pág.) e redija a sentença; se os autos mostrarem cumprimento que a detecção não viu, explique e siga o fluxo normal.` : `Há indício de cumprimento: confira nos autos antes de indeferir.`}`;
}
