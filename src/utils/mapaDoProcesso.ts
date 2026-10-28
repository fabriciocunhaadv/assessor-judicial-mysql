// MAPA DO PROCESSO: em processos longos (a partir de 130 movimentações) a IA lia bem o começo e decidia sem enxergar o estado ATUAL do processo.
// O mapa é uma leitura completa, em partes, que levanta a linha do tempo das decisões, o que continua em vigor e o que falta decidir agora.
// Ele não substitui os autos: acompanha a minuta como contexto de coerência ("amarração") e serve de conferência depois de redigida.
// Aqui ficam só as funções puras (contagem, divisão, texto do mapa e conferência por código); a chamada à IA fica no servidor.
import { mapaDeLocalizacao } from "./localizacaoAutos";

export const MOVIMENTACOES_PARA_MAPA = 130;
const SEPARA_PAGINAS = /(?=\[Página\s+\d{1,4}\s+de\s+\d{1,4}\])/;

export interface ResumoMovimentacoes { movs: number; ultima: number }

/** Quantas movimentações distintas os autos têm e qual é a última (pelos carimbos das páginas, ou pelos cabeçalhos "Movimentacao N :"). */
export function resumirMovimentacoes(autos: string): ResumoMovimentacoes {
  const t = String(autos || "");
  const nums = new Set<number>();
  for (const l of mapaDeLocalizacao(t).values()) nums.add(l.mov);
  for (const m of t.matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:/gi)) nums.add(+m[1]);      // também as movimentações SEM arquivo (ex.: "Autos Conclusos", "Processo Redistribuído"), que não têm carimbo de página completo
  return { movs: nums.size, ultima: nums.size ? Math.max(...nums) : 0 };
}

export const precisaDeMapa = (autos: string): boolean => resumirMovimentacoes(autos).movs >= MOVIMENTACOES_PARA_MAPA;

export interface ParteDosAutos { texto: string; movDe: number; movAte: number }

/** Divide os autos em partes de até `max` caracteres, sempre em fronteira de página (nunca no meio de uma peça), em ordem cronológica. */
export function dividirParaMapa(autos: string, max = 110_000): ParteDosAutos[] {
  const t = String(autos || "");
  const paginas = t.split(SEPARA_PAGINAS).filter((p) => p.length);
  const partes: ParteDosAutos[] = [];
  let atual: string[] = [], tam = 0;
  const fecha = () => {
    if (!atual.length) return;
    const txt = atual.join("");
    const r = resumirMovimentacoes(txt);
    const nums = [...mapaDeLocalizacao(txt).values()].map((l) => l.mov).concat([...txt.matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:/gi)].map((m) => +m[1]));
    partes.push({ texto: txt, movDe: nums.length ? Math.min(...nums) : 0, movAte: r.ultima });
    atual = []; tam = 0;
  };
  for (const p of paginas) {
    if (tam + p.length > max && atual.length) fecha();
    if (p.length > max) {      // página enorme (raro): vira parte própria, cortada sem perda em pedaços
      for (let i = 0; i < p.length; i += max) { atual.push(p.slice(i, i + max)); fecha(); }
      continue;
    }
    atual.push(p); tam += p.length;
  }
  fecha();
  return partes;
}

export interface EventoMapa { mov: number; data?: string; tipo: string; resumo: string; determinou?: string; situacao?: "em_vigor" | "cumprido" | "reformado" | "superado" | "pendente" | "informativo" }
export interface MapaProcesso {
  numeroProcesso?: string;
  partes?: string;
  movimentacoes: ResumoMovimentacoes;
  eventos: EventoMapa[];
  estadoAtual: { ultimoAtoRelevante?: string; questaoAtual: string; pendencias: string[]; vigentes: string[]; ligacoes?: string[] };
}

const txt = (v: any, n = 600) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const lista = (v: any, n = 12, c = 400) => (Array.isArray(v) ? v : []).map((x) => txt(x, c)).filter(Boolean).slice(0, n);

/** Limpa o que a IA devolveu: só entra evento com número de movimentação existente nos autos. */
export function normalizarMapa(bruto: any, autos: string): MapaProcesso | null {
  if (!bruto || typeof bruto !== "object") return null;
  const resumo = resumirMovimentacoes(autos);
  const validos = new Set<number>(); for (const l of mapaDeLocalizacao(autos).values()) validos.add(l.mov);
  const eventos: EventoMapa[] = (Array.isArray(bruto.eventos) ? bruto.eventos : []).map((e: any) => ({
    mov: Number(e?.mov) || 0, data: txt(e?.data, 20), tipo: txt(e?.tipo, 80), resumo: txt(e?.resumo, 500), determinou: txt(e?.determinou, 500),
    situacao: ["em_vigor", "cumprido", "reformado", "superado", "pendente", "informativo"].includes(e?.situacao) ? e.situacao : "informativo",
  })).filter((e: EventoMapa) => e.mov > 0 && e.resumo && (validos.size === 0 || validos.has(e.mov))).sort((a: EventoMapa, b: EventoMapa) => a.mov - b.mov).slice(0, 400);
  const ea = bruto.estadoAtual || {};
  const questaoAtual = txt(ea.questaoAtual, 800);
  if (!eventos.length && !questaoAtual) return null;
  return { numeroProcesso: txt(bruto.numeroProcesso, 40), partes: txt(bruto.partes, 400), movimentacoes: resumo, eventos,
    estadoAtual: { ultimoAtoRelevante: txt(ea.ultimoAtoRelevante, 300), questaoAtual, pendencias: lista(ea.pendencias), vigentes: lista(ea.vigentes, 15), ligacoes: lista(ea.ligacoes, 8) } };
}

/** Texto do mapa que acompanha o pedido à IA. */
export function blocoDoMapa(m: MapaProcesso): string {
  const L: string[] = [`[MAPA DO PROCESSO — levantado da leitura COMPLETA dos autos (${m.movimentacoes.movs} movimentações, até a Mov. ${m.movimentacoes.ultima}); os autos continuam sendo a fonte, o mapa só orienta a coerência]`];
  if (m.numeroProcesso) L.push(`Processo: ${m.numeroProcesso}${m.partes ? ` — ${m.partes}` : ""}`);
  L.push("", "ESTADO ATUAL DO PROCESSO:", `- O que está para ser decidido agora: ${m.estadoAtual.questaoAtual || "(não identificado)"}`);
  if (m.estadoAtual.ultimoAtoRelevante) L.push(`- Último ato relevante: ${m.estadoAtual.ultimoAtoRelevante}`);
  if (m.estadoAtual.pendencias.length) L.push("- Pendências:", ...m.estadoAtual.pendencias.map((x) => `  • ${x}`));
  if (m.estadoAtual.vigentes.length) L.push("- Decisões e comandos EM VIGOR que limitam o que se decide agora:", ...m.estadoAtual.vigentes.map((x) => `  • ${x}`));
  if (m.estadoAtual.ligacoes?.length) L.push("- Ligações entre atos (o que a decisão atual depende ou afeta):", ...m.estadoAtual.ligacoes.map((x) => `  • ${x}`));
  const relev = m.eventos.filter((e) => e.situacao !== "informativo");
  if (relev.length) L.push("", "LINHA DO TEMPO DOS ATOS DECISÓRIOS E DOS FATOS RELEVANTES:", ...relev.map((e) => `- Mov. ${e.mov}${e.data ? ` (${e.data})` : ""} — ${e.tipo}: ${e.resumo}${e.determinou ? ` | Determinou: ${e.determinou}` : ""} [${e.situacao}]`));
  return L.join("\n");
}

export const REGRA_MAPA_DO_PROCESSO = `

[COERÊNCIA COM O ESTADO ATUAL DO PROCESSO — USE O MAPA ACIMA]
1. Decida o que o processo pede AGORA (o estado atual do mapa), não o que pedia no começo. A minuta só vale se tratar a questão atual e as pendências do mapa.
2. Respeite as decisões EM VIGOR: não contradiga, repita sem necessidade nem desfaça o que já foi decidido e continua valendo. Se for reformar, complementar ou manter uma decisão anterior, diga isso expressamente, com a localização (Mov./Arq./Pág.).
3. Faça a ligação com os atos anteriores que afetam a decisão atual (o que o mapa lista em "ligações"), e deixe de lado fases já encerradas que não influenciam o ponto.
4. O mapa orienta, mas os fatos, nomes, datas e valores vêm dos AUTOS: se o mapa e os autos divergirem, vale o texto dos autos.`;

export interface AvisoMapa { codigo: string; texto: string }

/** Conferência por código (sem IA) entre a minuta pronta e o mapa. Só observações; não bloqueia nada. */
export function conferirComMapa(minuta: string, m: MapaProcesso | null | undefined): AvisoMapa[] {
  const out: AvisoMapa[] = [];
  const t = String(minuta || ""); if (!t.trim() || !m) return out;
  const citadas = [...t.matchAll(/Mov\.?\s*(\d{1,4})/gi)].map((x) => +x[1]);
  const maiorCitada = citadas.length ? Math.max(...citadas) : 0;
  const ultima = m.movimentacoes.ultima;
  const decisorios = m.eventos.filter((e) => /decis|despach|senten|ac[óo]rd|concl/i.test(e.tipo) && e.situacao !== "informativo");
  const recentesNaoCitados = decisorios.filter((e) => e.mov > maiorCitada).map((e) => e.mov);
  if (ultima > 0 && maiorCitada > 0 && ultima - maiorCitada >= 10 && recentesNaoCitados.length)      // só quando há ato decisório do mapa depois do último que a minuta cita
    out.push({ codigo: "cobertura", texto: `Os autos vão até a Mov. ${ultima}, mas a minuta cita só até a Mov. ${maiorCitada}. O mapa registra ato(s) decisório(s) posterior(es) (Mov. ${[...new Set(recentesNaoCitados)].slice(0, 6).join(", ")}); confira se algum precisa ser considerado.` });
  const q = m.estadoAtual.questaoAtual;
  if (q) {
    const chaves = [...new Set(q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 6))].slice(0, 12);
    const base = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const achou = chaves.filter((w) => base.includes(w)).length;
    if (chaves.length >= 4 && achou / chaves.length < 0.25)
      out.push({ codigo: "questao_atual", texto: `O mapa indica que o ponto a decidir agora é: “${q.slice(0, 220)}”. A minuta quase não menciona esses termos; confira se ela trata a questão atual.` });
  }
  return out;
}
