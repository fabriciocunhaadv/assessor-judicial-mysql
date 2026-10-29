// Minuta que já chega pronta de fora do Studio (hoje: o Agaia, pela esteira da extensão). O Studio não gera nada: só lança no Histórico,
// com o número do processo, a serventia (unidade) e o prompt, para o histórico do usuário ficar organizado como o das demais minutas.
import type { SavedAnalysis, JudicialUnit, MinuteData } from "../types";

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

function secao(texto: string, inicio: RegExp, fim: RegExp | null): string {
  const m = inicio.exec(texto); if (!m) return "";
  const resto = texto.slice(m.index + m[0].length);
  const f = fim ? fim.exec(resto) : null;
  return (f ? resto.slice(0, f.index) : resto).trim();
}

export function montarAnaliseDeMinutaExterna(d: MinutaExterna, ctx: { unitId: string; unitName: string; uid?: string; nome?: string; email?: string }): SavedAnalysis {
  const texto = String(d.minutaTexto || "").trim();
  const cnj = (texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || String(d.processo || "").match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [d.processo || "Sem número"])[0];
  const titulo = (texto.match(/^\s*(SENTEN[ÇC]A|DECIS[ÃA]O(?: INTERLOCUT[ÓO]RIA)?|DESPACHO|ATO ORDINAT[ÓO]RIO)\s*$/im) || [])[1]?.toUpperCase() || "MINUTA (AGAIA)";
  // texto do ato: o que vem depois da linha do título (antes dele ficam o número, a natureza e as partes)
  const mTitulo = /^[ \t]*(SENTEN[ÇC]A|DECIS[ÃA]O(?: INTERLOCUT[ÓO]RIA)?|DESPACHO|ATO ORDINAT[ÓO]RIO)[ \t]*$/im.exec(texto);
  const corpo = mTitulo ? texto.slice(mTitulo.index + mTitulo[0].length).trim() : texto;
  const relatorio = secao(texto, /^\W*I\.?\s*[-–.]?\s*RELAT[ÓO]RIO\W*$/im, /^\W*II\.?\s*[-–.]?\s*FUNDAMENTA[ÇC][ÃA]O/im);
  const fundamentacao = secao(texto, /^\W*II\.?\s*[-–.]?\s*FUNDAMENTA[ÇC][ÃA]O\W*$/im, /^\W*III\.?\s*[-–.]?\s*DISPOSITIVO/im);
  const dispositivo = secao(texto, /^\W*III\.?\s*[-–.]?\s*DISPOSITIVO\W*$/im, null);
  // decisão sem os títulos I/II/III (o Agaia nem sempre os usa): nada fica vazio nem se perde; o texto integral vai na fundamentação e o dispositivo é o trecho final (“Ante o exposto…”, “Determino…”, “Intimem-se”)
  let rel = relatorio, fund = fundamentacao, disp = dispositivo, semSecoes = false;
  if (!relatorio && !fundamentacao && !dispositivo) {
    semSecoes = true;
    const paragrafos = corpo.split(/\n\s*\n|\n(?=\S)/).map((x) => x.trim()).filter(Boolean);
    let k = paragrafos.findIndex((x, i) => i > 0 && /^(Ante o exposto|Diante do exposto|Pelo exposto|Isto posto|Posto isso|Dessa forma|Do exposto|Assim sendo|Por tais raz[õo]es|DETERMINO|Determino)/.test(x));
    if (k < 0) k = paragrafos.findIndex((x, i) => i > 0 && /^(Intim(e|em)-se|Cumpra-se|Publique-se|Expe[çc]a-se)/.test(x));
    const antes = k > 0 ? paragrafos.slice(0, k) : paragrafos;
    fund = antes.join("\n\n"); disp = k > 0 ? paragrafos.slice(k).join("\n\n") : "(o ato está inteiro no texto acima)";
    rel = "(Decisão elaborada no Agaia sem a divisão em relatório, fundamentação e dispositivo: o texto integral está abaixo.)";
  }
  const autor = (texto.match(/(?:Exequente|Autor(?:a)?|Requerente)\s*:\s*([^\n]+)/i) || [])[1]?.trim() || "";
  const reu = (texto.match(/(?:Executad[oa]s?|R[ée]u?s?|Requerid[oa]s?)\s*:\s*([^\n]+)/i) || [])[1]?.trim() || "";
  let h = 0; for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  const id = `agaia-${cnj.replace(/\D/g, "")}-${(h >>> 0).toString(36)}`;      // o mesmo texto do mesmo processo grava sempre no mesmo registro (uma segunda tentativa não duplica)
  const minute: MinuteData = {
    title: titulo, header: `${ctx.unitName || d.serventia || ""}\nPROCESSO Nº ${cnj}`, processNumber: cnj, judicialUnit: ctx.unitName || d.serventia || "",
    parties: { author: autor, defendant: reu }, relatorio: rel, fundamentacao: fund, dispositivo: disp, closing: "", fullFormattedText: texto,
  };
  return {
    id, unitId: ctx.unitId, promptTitle: d.prompt || d.promptAgaia || "Agaia", promptCategory: "civel", promptScope: "judicial", date: Date.now(), processNumber: cnj,
    result: { minute, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] }, modelUsed: "Agaia (TJGO)", origemExterna: { sistema: d.origem || "Agaia", promptAgaia: d.promptAgaia || "", aproximado: d.aproximado || "", semSecoes, htmlOriginal: d.minutaHtml || "" } } as any,
    originalMinute: JSON.parse(JSON.stringify(minute)),
    processTextContext: `[Minuta gerada no ${d.origem || "Agaia"}${d.promptAgaia ? ` com o prompt “${d.promptAgaia}”` : ""}; os autos não passaram pelo Studio]`,
    createdBy: ctx.uid || "anonymous", creatorName: ctx.nome || "Assessor", creatorEmail: ctx.email || "", chatMessages: [],
  } as SavedAnalysis;
}
