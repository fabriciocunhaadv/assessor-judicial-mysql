// Mudança de comarca/unidade de atos do histórico (Super Admin, em lote). Função pura: a rota do servidor só lê, aplica e grava.
export interface DestinoUnidade { unitId: string; judicialUnit: string; comarca?: string; vara?: string }

/** Devolve o ato com a nova unidade: unitId na raiz e a unidade (e comarca/vara, se vierem) na minuta. Não mexe no restante. */
export function aplicarUnidade<T extends Record<string, any>>(ato: T, d: DestinoUnidade): T {
  const novo: any = { ...ato, unitId: d.unitId };
  if (ato.result && typeof ato.result === "object") {
    const extras = Object.fromEntries(Object.entries({ judicialUnit: d.judicialUnit, comarca: d.comarca, vara: d.vara }).filter(([, v]) => v));
    novo.result = { ...ato.result, minute: { ...(ato.result.minute || {}), ...extras } };
  }
  return novo as T;
}

/** Valida o pedido em lote: devolve o destino e as listas limpas, ou o texto do erro. */
export function lerPedidoDeLote(b: any, maxIds = 200, maxProcessos = 100): { erro: string } | { destino: DestinoUnidade; ids: string[]; processos: string[] } {
  const texto = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
  const unitId = texto(b?.unitId, 64), judicialUnit = texto(b?.judicialUnit, 200);
  if (!unitId || !judicialUnit) return { erro: "Informe a unidade de destino." };
  const lista = (v: any, max: number) => [...new Set((Array.isArray(v) ? v : []).map((x) => texto(x, 128)).filter(Boolean))].slice(0, max);
  const ids = lista(b?.ids, maxIds), processos = lista(b?.processos, maxProcessos);
  if (!ids.length && !processos.length) return { erro: "Nada selecionado." };
  return { destino: { unitId, judicialUnit, comarca: texto(b?.comarca, 120) || undefined, vara: texto(b?.vara, 120) || undefined }, ids, processos };
}
