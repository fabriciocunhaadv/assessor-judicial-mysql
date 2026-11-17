// Padrões e pedido de resumo por IA a partir das comparações guardadas (minuta gerada × lançada × assinada). Funções puras: não tocam no banco nem na rede.
export interface DocComparacao {
  id?: string; processo: string; ato?: string; geradoEm: number; promptTitulo?: string; motor?: string;
  aproveitamentoPct: number; dispositivoMudou: boolean; dispositivoAproveitamentoPct?: number | null;
  porSecao?: { secao: string; aproveitamentoPct: number; palavrasOriginais?: number }[];
  mudancas?: { tipo: string; secao: string; original?: string; lancado?: string }[];
  assinado?: { aproveitamentoGeradaPct?: number | null; aproveitamentoLancadaPct: number; dispositivoMudouDaLancada: boolean; mudancas?: { tipo: string; secao: string; original?: string; lancado?: string }[]; arquivo?: string; em?: number };
}
interface Grupo { nome: string; n: number; aproveitamentoPct: number; dispositivoAlteradoPct: number }
export interface Padroes {
  total: number; aproveitamentoMedioPct: number; dispositivoAlteradoPct: number;
  porSecao: { secao: string; n: number; aproveitamentoPct: number }[];
  porPrompt: Grupo[]; porMotor: Grupo[]; porAto: Grupo[];
  maisCortados: { trecho: string; vezes: number; secao: string }[]; maisAcrescentados: { trecho: string; vezes: number; secao: string }[];
  assinados: { n: number; aproveitamentoLancadaPct: number; aproveitamentoGeradaPct: number | null; dispositivoMudouPct: number };
}
const media = (v: number[]): number => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0);
const chaveTrecho = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 9).join(" ");

function agrupar(docs: DocComparacao[], f: (d: DocComparacao) => string): Grupo[] {
  const m = new Map<string, DocComparacao[]>();
  for (const d of docs) { const k = (f(d) || "").trim() || "(sem informação)"; (m.get(k) || m.set(k, []).get(k)!).push(d); }
  return [...m.entries()].map(([nome, l]) => ({ nome, n: l.length, aproveitamentoPct: media(l.map((x) => x.aproveitamentoPct)), dispositivoAlteradoPct: Math.round((l.filter((x) => x.dispositivoMudou).length / l.length) * 100) })).sort((a, b) => b.n - a.n).slice(0, 15);
}
function frequentes(docs: DocComparacao[], tipos: string[], campo: "original" | "lancado"): { trecho: string; vezes: number; secao: string }[] {
  const m = new Map<string, { trecho: string; vezes: number; secao: string }>();
  for (const d of docs) for (const x of d.mudancas || []) {
    if (!tipos.includes(x.tipo)) continue;
    const t = String(x[campo] || "").trim(); const k = chaveTrecho(t); if (k.split(" ").length < 4) continue;
    const e = m.get(k); if (e) e.vezes++; else m.set(k, { trecho: t.slice(0, 200), vezes: 1, secao: x.secao });
  }
  return [...m.values()].filter((e) => e.vezes >= 2).sort((a, b) => b.vezes - a.vezes).slice(0, 10);
}
export function agregarPadroes(docs: DocComparacao[]): Padroes {
  const secoes = new Map<string, number[]>();
  for (const d of docs) for (const s of d.porSecao || []) (secoes.get(s.secao) || secoes.set(s.secao, []).get(s.secao)!).push(s.aproveitamentoPct);
  const ass = docs.filter((d) => d.assinado);
  const gerada = ass.map((d) => d.assinado!.aproveitamentoGeradaPct).filter((v): v is number => typeof v === "number");
  return {
    total: docs.length, aproveitamentoMedioPct: media(docs.map((d) => d.aproveitamentoPct)),
    dispositivoAlteradoPct: docs.length ? Math.round((docs.filter((d) => d.dispositivoMudou).length / docs.length) * 100) : 0,
    porSecao: [...secoes.entries()].map(([secao, v]) => ({ secao, n: v.length, aproveitamentoPct: media(v) })),
    porPrompt: agrupar(docs, (d) => d.promptTitulo || ""), porMotor: agrupar(docs, (d) => d.motor || ""), porAto: agrupar(docs, (d) => d.ato || ""),
    maisCortados: frequentes(docs, ["removido", "alterado"], "original"), maisAcrescentados: frequentes(docs, ["adicionado", "alterado"], "lancado"),
    assinados: { n: ass.length, aproveitamentoLancadaPct: media(ass.map((d) => d.assinado!.aproveitamentoLancadaPct)), aproveitamentoGeradaPct: gerada.length ? media(gerada) : null, dispositivoMudouPct: ass.length ? Math.round((ass.filter((d) => d.assinado!.dispositivoMudouDaLancada).length / ass.length) * 100) : 0 },
  };
}

/** Pedido ao modelo: resumo dos padrões e sugestões de ajuste de prompt. Só leva números e trechos curtos (nunca o texto inteiro das minutas). */
export function montarPromptResumo(docs: DocComparacao[], p: Padroes): string {
  const exemplos: string[] = [];
  for (const d of docs.slice(0, 30)) {
    for (const m of (d.mudancas || []).filter((x) => x.tipo !== "igual").slice(0, 3)) exemplos.push(`- [${m.tipo} · ${m.secao}] ${m.original ? `ERA: ${String(m.original).slice(0, 260)}` : ""}${m.lancado ? ` | FICOU: ${String(m.lancado).slice(0, 260)}` : ""}`);
    for (const m of (d.assinado?.mudancas || []).slice(0, 2)) exemplos.push(`- [DEPOIS DE LANÇADA, NA ASSINATURA · ${m.secao}] ${m.original ? `ERA: ${String(m.original).slice(0, 260)}` : ""}${m.lancado ? ` | FICOU: ${String(m.lancado).slice(0, 260)}` : ""}`);
    if (exemplos.length > 120) break;
  }
  return `Você ajuda a calibrar um sistema que gera minutas de decisões judiciais (sentença, decisão, despacho) para um magistrado. Cada comparação mostra o que o assessor/juiz MANTEVE, CORTOU ou ACRESCENTOU na minuta gerada antes de lançá-la no Projudi, e (quando há) o que mudou depois, até a versão assinada.

DADOS AGREGADOS (${p.total} comparação(ões)):
${JSON.stringify({ aproveitamentoMedioPct: p.aproveitamentoMedioPct, dispositivoAlteradoPct: p.dispositivoAlteradoPct, porSecao: p.porSecao, porPrompt: p.porPrompt, porMotor: p.porMotor, porAto: p.porAto, maisCortados: p.maisCortados, maisAcrescentados: p.maisAcrescentados, assinados: p.assinados })}

EXEMPLOS DE MUDANÇAS (trechos curtos):
${exemplos.join("\n") || "(sem exemplos)"}

TAREFA: escreva em português simples, sem inventar nada que não esteja nos dados. Responda SOMENTE um JSON (sem markdown):
{"resumo":"3 a 6 frases: o que o magistrado costuma aceitar e o que costuma mudar","padroes":["padrão observado, com a seção e a frequência quando os dados mostrarem"],"sugestoes":[{"titulo":"curto","secao":"Relatório|Fundamentação|Dispositivo|Geral","instrucao":"texto PRONTO para colar no prompt/instruções do Studio, no imperativo, específico e curto","motivo":"qual padrão dos dados justifica","confianca":"alta|media|baixa"}]}
Regras: se os dados forem poucos (menos de 5 comparações) diga isso no resumo e marque confianca "baixa". Não sugira mudar o resultado (dispositivo) do mérito; só a forma, a ordem, o nível de detalhe e a linguagem. No máximo 6 sugestões.`;
}
export function lerRespostaResumo(txt: string): { resumo: string; padroes: string[]; sugestoes: { titulo: string; secao: string; instrucao: string; motivo: string; confianca: string }[] } {
  const limpo = String(txt || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  let j: any = null; try { j = JSON.parse(limpo); } catch { const m = limpo.match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch { /* texto livre */ } } }
  if (!j || typeof j !== "object") return { resumo: limpo.slice(0, 3000), padroes: [], sugestoes: [] };
  const s = (v: any, n: number) => String(v ?? "").slice(0, n);
  return {
    resumo: s(j.resumo, 3000), padroes: (Array.isArray(j.padroes) ? j.padroes : []).slice(0, 12).map((x: any) => s(x, 400)),
    sugestoes: (Array.isArray(j.sugestoes) ? j.sugestoes : []).slice(0, 6).map((x: any) => ({ titulo: s(x?.titulo, 120), secao: s(x?.secao, 30), instrucao: s(x?.instrucao, 1200), motivo: s(x?.motivo, 500), confianca: ["alta", "media", "baixa"].includes(x?.confianca) ? x.confianca : "baixa" })),
  };
}
