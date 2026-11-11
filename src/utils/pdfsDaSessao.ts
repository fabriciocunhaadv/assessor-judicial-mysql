// PDFs já tratados (texto extraído/OCR, páginas sem texto e o próprio arquivo para visualizar) ficam guardados no navegador (IndexedDB): atualizar a versão do Studio ou
// recarregar a página NÃO faz a pessoa perder a leitura/OCR de um processo grande. Só o rascunho de texto ficava salvo antes (e só os NOMES dos PDFs).
import type { UploadedPdf } from "../types";

const BANCO = "assessor_pdfs_sessao", LOJA = "s", VALIDADE_MS = 14 * 24 * 3600_000, MAX_BLOB = 250 * 1024 * 1024;
const abrir = (): Promise<IDBDatabase | null> => new Promise((ok) => {
  try { if (typeof indexedDB === "undefined") return ok(null); const r = indexedDB.open(BANCO, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); }
});
const chave = (uid: string) => `u:${uid}`;

export interface PdfGuardado { pdf: Omit<UploadedPdf, "previewUrl" | "base64">; blob?: Blob }

/** Grava a lista atual (vazia = apaga). Melhor esforço: nunca atrapalha o uso. */
export async function guardarPdfsDaSessao(uid: string, pdfs: UploadedPdf[], lerBlob: (url: string) => Promise<Blob | null> = async (u) => { try { return await (await fetch(u)).blob(); } catch { return null; } }): Promise<void> {
  if (!uid) return;
  const db = await abrir(); if (!db) return;
  try {
    const itens: PdfGuardado[] = []; let total = 0;
    for (const p of pdfs) {
      if (p.isExtracting) continue;      // ainda sendo lido: não guarda pela metade
      const { previewUrl, base64, ...resto } = p as any;
      let blob: Blob | null = null;
      if (previewUrl && total + (p.size || 0) <= MAX_BLOB) { blob = await lerBlob(previewUrl); if (blob) total += blob.size; }
      itens.push({ pdf: resto, blob: blob || undefined });
    }
    await new Promise<void>((ok) => { const t = db.transaction(LOJA, "readwrite"); if (!itens.length) t.objectStore(LOJA).delete(chave(uid)); else t.objectStore(LOJA).put({ itens, salvoEm: Date.now() }, chave(uid)); t.oncomplete = () => ok(); t.onerror = () => ok(); t.onabort = () => ok(); });
  } catch { /* sem espaço: segue */ } finally { db.close(); }
}

/** Devolve os PDFs guardados deste usuário (com novo endereço de visualização), ou lista vazia. */
export async function lerPdfsDaSessao(uid: string, criarUrl: (b: Blob) => string = (b) => URL.createObjectURL(b)): Promise<UploadedPdf[]> {
  if (!uid) return [];
  const db = await abrir(); if (!db) return [];
  try {
    const salvo: any = await new Promise((ok) => { const r = db.transaction(LOJA, "readonly").objectStore(LOJA).get(chave(uid)); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
    if (!salvo || Date.now() - (salvo.salvoEm || 0) > VALIDADE_MS) return [];
    return (salvo.itens as PdfGuardado[]).map((i) => ({ ...(i.pdf as any), previewUrl: i.blob ? criarUrl(i.blob) : "", isExtracting: false })) as UploadedPdf[];
  } catch { return []; } finally { db.close(); }
}
