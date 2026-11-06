// "Lançado no Projudi" vale para o PROCESSO inteiro: marcar (ou desfazer) numa minuta vale para todas as minutas do mesmo processo.
export const digitosDoProcesso = (n: any) => String(n || "").replace(/\D/g, "");
/** Ids de todas as minutas do mesmo processo da minuta `ato` (inclui a própria). Sem número de processo legível, só a própria. */
export function idsDoMesmoProcesso(lista: Array<{ id?: string; processNumber?: any }>, ato: { id: string; processNumber?: any }): string[] {
  const num = digitosDoProcesso(ato.processNumber);
  const ids = new Set<string>([ato.id]);
  if (num.length >= 5) for (const it of lista) if (it && it.id && digitosDoProcesso(it.processNumber) === num) ids.add(it.id);
  return [...ids];
}
