// Regimes da "Pesquisa Legislativa & Taxonomia Normativa" cadastrados pelo Super Admin: base única, compartilhada por todos os gabinetes (tabela docs, pasta "taxonomia_normativa").
// Os regimes que já vêm no sistema (src/data/legalTaxonomy.ts) continuam valendo; estes se somam a eles.
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import type { LegalFramework } from "../src/data/legalTaxonomy";

const COL = "taxonomia_normativa";
const txt = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
const lista = (v: any, max: number, tam: number): string[] => (Array.isArray(v) ? v : []).map((x) => txt(x, tam)).filter(Boolean).slice(0, max);

/** Valida e limpa o regime recebido (nada que venha do navegador entra sem passar por aqui). */
export function sanearRegime(raw: any): LegalFramework | null {
  const nome = txt(raw?.name, 160), categoria = txt(raw?.category, 120);
  const leis = (Array.isArray(raw?.principaisLeis) ? raw.principaisLeis : []).map((l: any) => ({ diploma: txt(l?.diploma, 200), artigosChave: txt(l?.artigosChave, 300), objeto: txt(l?.objeto, 500) })).filter((l: any) => l.diploma).slice(0, 20);
  const keywords = lista(raw?.keywords, 40, 80);
  if (!nome || !categoria || !keywords.length || !leis.length) return null;
  const rc = raw?.regimeCorrecao || {};
  const id = /^custom_[a-z0-9_]{3,80}$/.test(String(raw?.id || "")) ? String(raw.id) : `custom_${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "regime"}_${Date.now().toString(36)}`;
  return {
    id, name: nome, category: categoria, keywords, principaisLeis: leis,
    regimeCorrecao: { indiceCorrecao: txt(rc.indiceCorrecao, 300), termoInicialCorrecao: txt(rc.termoInicialCorrecao, 500), indiceJuros: txt(rc.indiceJuros, 300), termoInicialJuros: txt(rc.termoInicialJuros, 500), baseLegalCompleta: txt(rc.baseLegalCompleta, 800), observacoes: txt(rc.observacoes, 1200) },
    sumulasEPrecedentes: lista(raw?.sumulasEPrecedentes, 40, 400),
    clausulaDispositivoPadrao: txt(raw?.clausulaDispositivoPadrao, 3000),
  };
}

let cache: { ate: number; itens: LegalFramework[] } | null = null;
export async function listarRegimes(): Promise<LegalFramework[]> {
  if (cache && cache.ate > Date.now()) return cache.itens;
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT 500", [COL]);
  const itens = rows.map((r) => { try { return JSON.parse(r.data) as LegalFramework; } catch { return null; } }).filter(Boolean) as LegalFramework[];
  cache = { ate: Date.now() + 60_000, itens };
  return itens;
}
export async function gravarRegime(fw: LegalFramework): Promise<void> {
  await garantirDocs();
  await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL, fw.id, JSON.stringify(fw), Date.now()]);
  cache = null;
}
export async function apagarRegime(id: string): Promise<void> {
  await garantirDocs();
  await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL, id]);
  cache = null;
}
