// Precedentes anexados (súmulas, teses e informativos) guardados no MySQL (tabela docs), em vez de um arquivo do servidor que uma nova implantação poderia apagar.
// Duas pastas: "precedentes" (itens anexados por PDF) e "precedentes_conferencia" (marca de que o item foi conferido na fonte oficial, valendo também para os itens da base interna).
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";

const COL = "precedentes", COL_CONF = "precedentes_conferencia";

export async function listarPrecedentes(): Promise<any[]> {
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT id, data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT 5000", [COL]);
  return rows.map((r) => ({ ...JSON.parse(r.data), id: r.id }));
}
export async function listarConferencias(): Promise<Record<string, { por: string; em: number; nota?: string }>> {
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT id, data FROM docs WHERE col=? LIMIT 20000", [COL_CONF]);
  return Object.fromEntries(rows.map((r) => [r.id, JSON.parse(r.data)]));
}
export async function gravarPrecedentes(itens: any[]): Promise<void> {
  await garantirDocs();
  const t = Date.now();
  for (const it of itens) {
    if (!it?.id) continue;
    await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL, String(it.id).slice(0, 190), JSON.stringify(it), t]);
  }
}
export async function apagarPrecedente(id: string): Promise<void> {
  await garantirDocs();
  await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL, id]);
  await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL_CONF, id]);
}
export async function marcarConferencia(id: string, conferido: boolean, por: string, nota?: string): Promise<void> {
  await garantirDocs();
  if (!conferido) { await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL_CONF, id]); return; }
  await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL_CONF, id.slice(0, 190), JSON.stringify({ por, em: Date.now(), nota: (nota || "").slice(0, 300) }), Date.now()]);
}
