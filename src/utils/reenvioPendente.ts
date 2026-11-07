// REENVIO AUTOMÁTICO: guarda no navegador (IndexedDB) o pedido de cada análise em andamento. Se o servidor for reiniciado e perder o resultado
// (a "caixa de resultados" fica na memória dele), o pedido guardado é enviado de novo sozinho, sem o usuário refazer nada.
// Só existe o que chegou a ser guardado: se a energia cair antes de o pedido ser montado, não há o que reenviar.
import { getApiHeaders } from "./apiKeyManager";

const BANCO = "assessor_reenvio", LOJA = "pedidos", VALIDADE_MS = 3 * 3600_000, MAX_REENVIOS = 2;
interface Pedido { progId: string; url: string; body: string; criadoEm: number; reenvios: number }

const abrir = (): Promise<IDBDatabase> => new Promise((ok, erro) => {
  try {
    const rq = indexedDB.open(BANCO, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(LOJA, { keyPath: "progId" }); };
    rq.onsuccess = () => ok(rq.result); rq.onerror = () => erro(rq.error);
  } catch (e) { erro(e); }
});
const op = async <T,>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await abrir();
  try { return await new Promise<T>((ok, erro) => { const r = f(db.transaction(LOJA, modo).objectStore(LOJA)); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); }); } finally { db.close(); }
};

/** Guarda o pedido (melhor esforço: nunca atrapalha a análise). */
export async function guardarRequisicao(progId: string, url: string, body: unknown): Promise<void> {
  try { if (typeof body !== "string" || !progId) return; await op("readwrite", (s) => s.put({ progId, url, body, criadoEm: Date.now(), reenvios: 0 } as Pedido)); void limparAntigas(); } catch { /* sem armazenamento: segue sem reenvio */ }
}
export async function apagarRequisicao(progId?: string | null): Promise<void> { try { if (progId) await op("readwrite", (s) => s.delete(progId)); } catch { /* ignora */ } }
export async function limparAntigas(): Promise<void> {
  try { const todos = await op<Pedido[]>("readonly", (s) => s.getAll() as IDBRequest<Pedido[]>); for (const p of todos) if (Date.now() - p.criadoEm > VALIDADE_MS) await apagarRequisicao(p.progId); } catch { /* ignora */ }
}
export async function temRequisicao(progId: string): Promise<boolean> { try { return !!(await op<Pedido | undefined>("readonly", (s) => s.get(progId) as IDBRequest<Pedido | undefined>)); } catch { return false; } }

/** Reenvia o pedido guardado com um novo identificador de acompanhamento. Devolve o novo id, ou null se não há pedido (ou já foi reenviado demais). */
export async function reenviarRequisicao(progIdAntigo: string): Promise<string | null> {
  try {
    const p = await op<Pedido | undefined>("readonly", (s) => s.get(progIdAntigo) as IDBRequest<Pedido | undefined>);
    if (!p || Date.now() - p.criadoEm > VALIDADE_MS || p.reenvios >= MAX_REENVIOS) return null;
    const novo = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await op("readwrite", (s) => s.put({ ...p, progId: novo, reenvios: p.reenvios + 1 } as Pedido));
    await apagarRequisicao(progIdAntigo);
    // o servidor guarda o resultado na caixa pelo identificador: não é preciso esperar a resposta aqui, quem acompanha busca depois
    void fetch(p.url, { method: "POST", headers: getApiHeaders({ "x-progresso-id": novo }), body: p.body }).catch(() => { /* o acompanhamento percebe */ });
    return novo;
  } catch { return null; }
}
