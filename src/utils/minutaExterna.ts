// Minuta que já chega pronta de fora do Studio (hoje: o Agaia, pela esteira da extensão). O Studio não gera nada: só lança no Histórico,
// com o número do processo, a serventia (unidade) e o prompt, para o histórico do usuário ficar organizado como o das demais minutas.
import type { SavedAnalysis, JudicialUnit, MinuteData } from "../types";
import { organizarMinutaExterna } from "./organizarMinutaExterna";

export interface MinutaExterna { processo: string; serventia?: string; prompt?: string; promptAgaia?: string; minutaTexto: string; minutaHtml?: string; aproximado?: string; origem?: string; unidadeId?: string }

const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const IGNORAR = new Set(["goias", "comarca", "vara", "unica", "judicial", "de", "da", "do", "das", "dos", "tjgo"]);
const palavras = (s: string) => semAcento(s).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !IGNORAR.has(p));

/** Acha a unidade do Studio que corresponde à serventia do Projudi/Agaia ("Montes Claros de Goias - Juizado Especial Civel - GO"); sem correspondência clara, usa a ativa. */
export function resolverUnidade(serventia: string, unidades: JudicialUnit[], ativa: JudicialUnit | null | undefined): { id: string; name: string } {
  const alvo = new Set(palavras(serventia));
  let melhor: JudicialUnit | null = null, pontos = 0;
  for (const u of unidades || []) {
    const ps = palavras(u.name); if (!ps.length) continue;
    const acertos = ps.filter((p) => alvo.has(p)).length;
    const p = acertos - (ps.length - acertos) * 0.25;
    if (acertos >= 2 && p > pontos) { pontos = p; melhor = u; }
  }
  const u = melhor || ativa || null;
  return { id: u?.id || "montes_claros", name: u?.name || "" };
}

const SEM_FUNDAMENTACAO = "(O ato não traz fundamentação em separado: segue do relatório direto ao dispositivo.)";
const SEM_RELATORIO = "(O ato não traz relatório em separado: começa direto na fundamentação.)";

export function montarAnaliseDeMinutaExterna(d: MinutaExterna, ctx: { unitId: string; unitName: string; uid?: string; nome?: string; email?: string }): SavedAnalysis {
  const texto = String(d.minutaTexto || "").trim();
  const cnj = (texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || String(d.processo || "").match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [d.processo || "Sem número"])[0];
  // título, seções (relatório / fundamentação / dispositivo), fecho e partes: separação inteligente (ver organizarMinutaExterna), com a mesma formatação da tela
  const org = organizarMinutaExterna(texto, d.minutaHtml || "");
  const titulo = org.titulo, rel = org.relatorio || SEM_RELATORIO, fund = org.fundamentacao || SEM_FUNDAMENTACAO, disp = org.dispositivo || "(o ato está inteiro no texto acima)", semSecoes = org.semSecoes;
  const autor = org.autor, reu = org.reu;
  let h = 0; for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  const id = `agaia-${cnj.replace(/\D/g, "")}-${(h >>> 0).toString(36)}`;      // o mesmo texto do mesmo processo grava sempre no mesmo registro (uma segunda tentativa não duplica)
  const minute: MinuteData = {
    title: titulo, header: `${ctx.unitName || d.serventia || ""}\nPROCESSO Nº ${cnj}`, processNumber: cnj, judicialUnit: ctx.unitName || d.serventia || "",
    parties: { author: autor, defendant: reu }, relatorio: rel, fundamentacao: fund, dispositivo: disp, closing: org.closing || "Documento assinado digitalmente.", fullFormattedText: texto,
  };
  return {
    id, unitId: ctx.unitId, promptTitle: d.prompt || d.promptAgaia || "Agaia", promptCategory: "civel", promptScope: "judicial", date: Date.now(), processNumber: cnj,
    result: { minute, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] }, modelUsed: d.origem && !/agaia|colada/i.test(d.origem) ? `${d.origem} (IA externa)` : "Agaia (TJGO)", origemExterna: { sistema: d.origem || "Agaia", promptAgaia: d.promptAgaia || "", aproximado: d.aproximado || "", semSecoes, htmlOriginal: d.minutaHtml || "" } } as any,
    originalMinute: JSON.parse(JSON.stringify(minute)),
    processTextContext: `[Minuta gerada no ${d.origem || "Agaia"}${d.promptAgaia ? ` com o prompt “${d.promptAgaia}”` : ""}; os autos não passaram pelo Studio]`,
    createdBy: ctx.uid || "anonymous", creatorName: ctx.nome || "Assessor", creatorEmail: ctx.email || "", chatMessages: [],
  } as SavedAnalysis;
}

/**
 * Minuta do Agaia já gravada no Histórico com a separação antiga (tudo na fundamentação): reorganiza ao abrir, a partir do texto original guardado.
 * Só mexe se o usuário NÃO editou a minuta (relatório/fundamentação/dispositivo iguais aos de origem) e só se o resultado mudar algo. Devolve null quando não há o que fazer.
 */
export function reorganizarAnaliseExterna(a: SavedAnalysis): SavedAnalysis | null {
  try {
    const r: any = a?.result, o = r?.origemExterna, m: MinuteData | undefined = r?.minute;
    if (!o || !m) return null;
    const orig: MinuteData | undefined = r.originalMinute || (a as any).originalMinute;
    if (orig && (orig.relatorio !== m.relatorio || orig.fundamentacao !== m.fundamentacao || orig.dispositivo !== m.dispositivo)) return null; // o usuário já mexeu
    const texto = String(m.fullFormattedText || "").trim(); if (texto.length < 80) return null;
    const org = organizarMinutaExterna(texto, o.htmlOriginal || "");
    const rel = org.relatorio || SEM_RELATORIO, fund = org.fundamentacao || SEM_FUNDAMENTACAO, disp = org.dispositivo || "(o ato está inteiro no texto acima)";
    if (!org.fundamentacao && !org.dispositivo && !org.relatorio) return null;
    if (rel === m.relatorio && fund === m.fundamentacao && disp === m.dispositivo) return null;
    const novo: MinuteData = { ...m, relatorio: rel, fundamentacao: fund, dispositivo: disp, closing: org.closing || m.closing || "Documento assinado digitalmente." };
    if (org.autor && !m.parties?.author) novo.parties = { ...m.parties, author: org.autor, defendant: m.parties?.defendant || org.reu };
    return { ...a, result: { ...r, minute: novo, originalMinute: JSON.parse(JSON.stringify(novo)), origemExterna: { ...o, semSecoes: org.semSecoes } } } as SavedAnalysis;
  } catch { return null; }
}
