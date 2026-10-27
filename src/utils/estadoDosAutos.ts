// Estado atual dos autos (vale para qualquer área e módulo): índice de movimentações lido dos carimbos do Projudi, regra curta de estado atual
// e conferências por código sobre a minuta pronta. As conferências só AVISAM (nunca alteram nem bloqueiam a minuta).

export const REGRA_ESTADO_ATUAL = `

[ESTADO ATUAL DOS AUTOS — VALE PARA QUALQUER ÁREA]
1. Aprecie expressamente cada petição, resposta de ofício e certidão posteriores à última decisão (índice das movimentações). Não trate fase anterior como se fosse a atual.
2. Questão já decidida (saneamento, preliminar, ônus da prova, acórdão) não é decidida de novo: remeta à decisão com sua localização e trate só do que está pendente.
3. Ofício ou diligência cumprida com resposta negativa ou que indica outro destinatário exige novo encaminhamento ou dispensa fundamentada; nunca indefira em bloco diligência já deferida.
4. Decida o pedido de prova na espécie, no objeto e na condição em que foi feito, citando o requerimento.
5. Pedido de reabertura de prazo: confronte-o com a certidão de decurso e com a decisão que fixou o prazo.
6. Audiência: não designe data específica; determine à secretaria que a inclua em pauta, depois de cumpridos os prazos e as diligências deferidas ("[data a definir conforme pauta]"). Só use data certa se os autos já a trouxerem.`;

const textoDe = (m: any): string => { try { return typeof m === "string" ? m : JSON.stringify(m || {}); } catch { return ""; } };
const MOV_CITADA = /Mov(?:imenta[cç][aã]o|imentos)?s?\.?\s*(\d{1,4})((?:\s*(?:,|e|a)\s*\d{1,4})*)/gi;

/** Movimentações e tipos lidos dos carimbos "Movimentacao N : <tipo> Arquivo M: ...". */
export function indiceMovimentacoes(autos: string) {
  const tipos = new Map<number, string>();
  for (const m of String(autos || "").matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:\s*([^\n]{3,100})/gi)) {
    const n = Number(m[1]); if (tipos.has(n)) continue;
    tipos.set(n, m[2].replace(/\s+Arquivo\s+\d+.*$/i, "").trim());
  }
  const ns = [...tipos.keys()].sort((a, b) => a - b);
  const ultima = ns[ns.length - 1] ?? 0;
  const ultimaDecisao = [...ns].reverse().find((n) => /^(Decis[aã]o|Despacho|Senten[cç]a|Ac[oó]rd[aã]o)/i.test(tipos.get(n)!)) ?? 0;
  return { tipos, ns, ultima, ultimaDecisao };
}

/** Bloco para o prompt: última movimentação, última decisão e o que veio depois dela. Vazio se os autos não trazem carimbos. */
export function blocoIndiceMovimentacoes(autos: string): string {
  try {
    const { tipos, ns, ultima, ultimaDecisao } = indiceMovimentacoes(autos);
    if (ns.length < 3) return "";
    const pos = ns.filter((n) => n > ultimaDecisao).slice(-40);
    return `\n\n[ÍNDICE DAS MOVIMENTAÇÕES (lido dos carimbos; é a ÚNICA numeração válida)]\nÚltima movimentação: Mov. ${ultima}. Última decisão judicial: ${ultimaDecisao ? "Mov. " + ultimaDecisao : "não identificada"}.\nPosteriores à última decisão:\n${pos.map((n) => `- Mov. ${n}: ${tipos.get(n)}`).join("\n") || "- (nenhuma)"}`;
  } catch { return ""; }
}

/** Citações "Mov. X, Arq. Y, Pág. Z" cujo arquivo ou página não existe nos carimbos. null = autos sem carimbos suficientes. */
export function citacoesInvalidas(minuta: any, autos: string): string[] | null {
  const mapa = new Map<string, number>(), movs = new Set<number>();
  for (const m of String(autos || "").matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:[^\n]*\n?\s*Arquivo\s+(\d{1,3})\s*:[^\n]*?Pag\.\s*(\d{1,4})\s*\/\s*(\d{1,4})/gi)) { mapa.set(`${m[1]}|${m[2]}`, Number(m[4])); movs.add(Number(m[1])); }
  if (movs.size < 3) return null;
  const ruins = new Set<string>();
  for (const c of textoDe(minuta).matchAll(/Mov\.?\s*(\d{1,4})\s*,\s*Arq\.?\s*(\d{1,3})\s*,\s*P[aá]gs?\.?\s*(\d{1,4})/gi)) {
    const total = mapa.get(`${Number(c[1])}|${Number(c[2])}`);
    if (movs.has(Number(c[1])) && (total === undefined || Number(c[3]) > total)) ruins.add(c[0].replace(/\s+/g, " "));
  }
  return [...ruins].slice(0, 10);
}

/** Página global do PDF consolidado ("[Página N de M]") -> movimentação, arquivo e página do arquivo, lidos do carimbo do rodapé de cada página. */
export function mapaPaginasGlobais(autos: string) {
  const m = new Map<number, { mov: number; arq: number; pag: number }>();
  for (const p of String(autos || "").split(/(?=\[Página\s+\d{1,4}\s+de\s+\d{1,4}\])/)) {
    const g = p.match(/^\[Página\s+(\d{1,4})\s+de/); if (!g) continue;
    const c = [...p.matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:[^\n]*\n?\s*Arquivo\s+(\d{1,3})\s*:[^\n]*?Pag\.\s*(\d{1,4})\s*\//gi)].pop();      // o carimbo fica no rodapé
    if (c) m.set(+g[1], { mov: +c[1], arq: +c[2], pag: +c[3] });
  }
  return m;
}

/** Troca a página global pela página do arquivo ("Mov. 120, Arq. 1, Págs. 673 a 680" -> "Págs. 1 a 8"), só quando o Mov. e o Arq. citados batem com o carimbo daquela página. */
export function corrigirPaginasGlobais(texto: string, autos: string): { texto: string; trocas: number } {
  if (typeof texto !== "string" || !texto) return { texto, trocas: 0 };
  const mapa = mapaPaginasGlobais(autos); let trocas = 0;
  if (!mapa.size) return { texto, trocas };
  const out = texto.replace(/Mov\.?\s*(\d{1,4})\s*,\s*Arq\.?\s*(\d{1,3})\s*,\s*P[aá]gs?\.?\s*(\d{1,4})(?:\s*(?:a|-|–)\s*(\d{1,4}))?(?!\s*(?:e|,)\s*\d)/gi, (full, mov, arq, p1, p2) => {
    const g1 = mapa.get(+p1); if (!g1 || g1.mov !== +mov || g1.arq !== +arq) return full;
    const g2 = p2 ? mapa.get(+p2) : undefined; if (p2 && (!g2 || g2.mov !== +mov || g2.arq !== +arq)) return full;
    if (g1.pag === +p1 && (!p2 || g2!.pag === +p2)) return full;      // já era a página do arquivo
    trocas++;
    return `Mov. ${mov}, Arq. ${arq}, ${p2 ? "Págs." : "Pág."} ${g1.pag}${p2 ? " a " + g2!.pag : ""}`;
  });
  return { texto: out, trocas };
}

/** Aplica a correção de páginas aos textos da minuta (campos string, no próprio objeto). Devolve quantas citações foram corrigidas. */
export function corrigirPaginasDaMinuta(minuta: any, autos: string): number {
  if (!minuta || typeof minuta !== "object") return 0;
  let total = 0;
  for (const k of Object.keys(minuta)) {
    if (typeof minuta[k] !== "string") continue;
    const r = corrigirPaginasGlobais(minuta[k], autos);
    if (r.trocas) { minuta[k] = r.texto; total += r.trocas; }
  }
  return total;
}

/** Petições, respostas de ofício e certidões posteriores à última decisão que a minuta não cita. */
export function pendenciasNaoCitadas(minuta: any, autos: string): number[] {
  const { tipos, ns, ultimaDecisao } = indiceMovimentacoes(autos);
  if (!ultimaDecisao) return [];
  const citadas = new Set<number>();
  for (const m of textoDe(minuta).matchAll(MOV_CITADA)) { citadas.add(Number(m[1])); for (const n of (m[2] || "").match(/\d{1,4}/g) || []) citadas.add(Number(n)); }
  return ns.filter((n) => n > ultimaDecisao && /Peti[cç][aã]o|Of[ií]cio Respondido|Habilita|Certid[aã]o|Manifesta/i.test(tipos.get(n)!) && !citadas.has(n)).slice(0, 12);
}

/** Data designada no dispositivo com menos de 10 dias da conclusão. */
export function dataInexequivel(minuta: any, autos: string): string | null {
  const todas = [...String(autos || "").matchAll(/Autos Conclusos[^)]*\)\s*do dia\s*(\d{2})\/(\d{2})\/(\d{4})/gi)];
  const c = todas[todas.length - 1];      // a última conclusão
  if (!c) return null;
  const conc = Date.UTC(+c[3], +c[2] - 1, +c[1]);
  const t = textoDe(minuta?.dispositivo ?? minuta);
  for (const m of t.matchAll(/design[oa][^.]{0,120}?(\d{2})\/(\d{2})\/(\d{4})/gi)) {
    const d = Date.UTC(+m[3], +m[2] - 1, +m[1]);
    if (d - conc < 10 * 86400000) return `${m[1]}/${m[2]}/${m[3]}`;
  }
  return null;
}

const LATIM = /\b(ab initio|in albis|in abstracto|ad causam|ad cautelam|data venia|ex officio|ipso facto|in casu|inaudita altera pars|fumus boni iuris|periculum in mora|pro rata|sub judice|a quo|ad quem)\b(?!\s*\()/gi;
/** Expressões latinas sem tradução entre parênteses logo depois. */
export function latimSemTraducao(minuta: any): string[] {
  return [...new Set([...textoDe(minuta).matchAll(LATIM)].map((m) => m[1].toLowerCase()))];
}

/** Ato pedido diferente da conclusão dos autos ("Autos Conclusos - P/ DECISÃO"). Devolve a conclusão, ou null. */
export function atoDivergente(atoPedido: string, autos: string): string | null {
  const todas = [...String(autos || "").matchAll(/Autos Conclusos\s*-\s*P\/\s*([A-ZÇÃÕÉÍÓÚ ]{4,30})\)/gi)];
  const c = todas[todas.length - 1];      // a última conclusão
  if (!c) return null;
  const a = String(atoPedido || "").toLowerCase();
  const pedido = a.includes("senten") ? "SENTEN" : a.includes("decis") ? "DECIS" : a.includes("despach") ? "DESPACH" : "";
  return pedido && !c[1].toUpperCase().includes(pedido) ? c[1].trim() : null;
}

export interface AvisosEstado {
  avisoCitacao?: string[];
  avisoPendencia?: number[];
  avisoData?: string;
  avisoLatim?: string[];
  avisoAto?: { pedido: string; conclusao: string };
}
/** Roda todas as conferências; só devolve o que achou. Nunca lança erro. */
export function conferenciasEstado(minuta: any, autos: string, atoPedido?: string): AvisosEstado {
  const out: AvisosEstado = {};
  try { const c = citacoesInvalidas(minuta, autos); if (c && c.length) out.avisoCitacao = c; } catch { /* a conferência nunca derruba a minuta */ }
  try { const p = pendenciasNaoCitadas(minuta, autos); if (p.length) out.avisoPendencia = p; } catch { /* idem */ }
  try { const d = dataInexequivel(minuta, autos); if (d) out.avisoData = d; } catch { /* idem */ }
  try { const l = latimSemTraducao(minuta); if (l.length) out.avisoLatim = l; } catch { /* idem */ }
  try { const a = atoPedido ? atoDivergente(atoPedido, autos) : null; if (a) out.avisoAto = { pedido: atoPedido!, conclusao: a }; } catch { /* idem */ }
  return out;
}
