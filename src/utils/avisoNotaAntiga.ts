import type { AssessorDraftAuditResult } from "../types";

/** Auditorias salvas antes da correção da nota não guardaram os pontos da IA sem prova literal. Quando a nota é alta mas o resumo fala em problema grave, avisa para conferir. */
const RESUMO_GRAVE = /diverg|falhas? graves?|grave|contradi|nulidade|estranh|alheio|incorret|cerceament|distor[çc]/i;
export const avisoNotaAntiga = (r: { score?: number; summary?: string }, a: AssessorDraftAuditResult | undefined | null): "forte" | "leve" | null => {
  if (!a || a.apontamentosNaoConfirmados !== undefined) return null;
  return (r.score ?? 0) >= 90 && RESUMO_GRAVE.test(String(a.summary || "")) ? "forte" : "leve";
};
