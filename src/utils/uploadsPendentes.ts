// Leitura de PDF/envio de mídia que estava NO MEIO quando a página foi recarregada (atualização de versão, queda): guarda os arquivos no navegador (IndexedDB) enquanto a tarefa roda e,
// ao voltar, a tela retoma sozinha (no máximo 2 tentativas, para um arquivo que derruba a página não entrar em repetição). Vale para a Mesa de Audiência e para o Mutirão Expresso.
const BANCO = "assessor_uploads_pendentes", LOJA = "p", VALIDADE_MS = 24 * 3600_000, MAX_TENTATIVAS = 2, MAX_BYTES = 400 * 1024 * 1024;
const abrir = (): Promise<IDBDatabase | null> => new Promise((ok) => {
  try { if (typeof indexedDB === "undefined") return ok(null); const r = indexedDB.open(BANCO, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); }
});
const chave = (modulo: string, uid: string) => `${modulo}:${uid}`;
const gravar = async (k: string, v: any | null) => {
  const db = await abrir(); if (!db) return;
  try { await new Promise<void>((ok) => { const t = db.transaction(LOJA, "readwrite"); if (v) t.objectStore(LOJA).put(v, k); else t.objectStore(LOJA).delete(k); t.oncomplete = () => ok(); t.onerror = () => ok(); t.onabort = () => ok(); }); } catch { /* sem espaço */ } finally { db.close(); }
};

export async function guardarUploadPendente(modulo: string, uid: string, arquivos: File[], contexto?: Record<string, any>): Promise<void> {
  if (!uid || !arquivos.length) return;
  if (arquivos.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return;      // grande demais para guardar: a pessoa reenvia
  await gravar(chave(modulo, uid), { arquivos: arquivos.map((f) => ({ nome: f.name, tipo: f.type, blob: f as Blob })), tentativas: 0, em: Date.now(), contexto: contexto || null });      // nome e tipo à parte: nem todo navegador preserva o File inteiro
}
export const apagarUploadPendente = (modulo: string, uid: string) => (uid ? gravar(chave(modulo, uid), null) : Promise.resolve());
/** Devolve os arquivos que ficaram pela metade (e conta uma tentativa); null se não há, venceu ou já tentou demais. */
export async function lerUploadPendente(modulo: string, uid: string): Promise<{ arquivos: File[]; contexto: Record<string, any> | null } | null> {
  if (!uid) return null;
  const db = await abrir(); if (!db) return null;
  let salvo: any = null;
  try { salvo = await new Promise((ok) => { const r = db.transaction(LOJA, "readonly").objectStore(LOJA).get(chave(modulo, uid)); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); } catch { /* ignora */ } finally { db.close(); }
  if (!salvo || Date.now() - (salvo.em || 0) > VALIDADE_MS) { if (salvo) await apagarUploadPendente(modulo, uid); return null; }
  if ((salvo.tentativas || 0) >= MAX_TENTATIVAS) { await apagarUploadPendente(modulo, uid); return null; }
  await gravar(chave(modulo, uid), { ...salvo, tentativas: (salvo.tentativas || 0) + 1 });
  return { arquivos: (salvo.arquivos as { nome: string; tipo: string; blob: Blob }[]).map((a) => new File([a.blob], a.nome, { type: a.tipo || "application/pdf" })), contexto: salvo.contexto || null };
}
