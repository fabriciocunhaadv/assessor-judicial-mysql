// Sessão do Mutirão Expresso FORA do componente: o que a pessoa está fazendo (PDF em leitura, mídias anexadas, ata, degravação, sentença) continua mesmo que ela troque de aba
// ("Pauta Normal"), feche a janela da Mesa ou recarregue a página. As tarefas em andamento usam estes "setters", que não dependem de o componente estar na tela.
// Persistência: IndexedDB (aceita os arquivos de vídeo). Tarefas que estavam EM ANDAMENTO quando a página recarregou não podem continuar (a leitura do PDF e o envio da mídia são refeitos).
import { useSyncExternalStore, useCallback } from "react";

type Dados = Record<string, any>;
const INICIAL: Dados = {
  step: "upload", selectedPromptId: "", ataMobileTab: "media", sentenceMobileTab: "sentence",
  isProcessingPdf: false, isProcessingVideo: false, progressoPdf: "", progressoMidia: "", processInfo: { processNumber: "", author: "", defendant: "" },
  ataText: "", sentenceText: "", transcription: "", videoFiles: [], pdfFullText: "", sentencasDaSessao: 0, bloqueioExt: null, pdfNome: "", progIdSentenca: "",
};
const PERSISTIR = ["step", "selectedPromptId", "processInfo", "ataText", "sentenceText", "transcription", "videoFiles", "pdfFullText", "sentencasDaSessao", "pdfNome", "progIdSentenca"];
let dados: Dados = { ...INICIAL };
const ouvintes = new Set<() => void>();
let chaveUsuario = "", carregadoPara = "", recuperou: string | null = null, tempo: ReturnType<typeof setTimeout> | null = null;

const abrir = (): Promise<IDBDatabase | null> => new Promise((ok) => {
  try { if (typeof indexedDB === "undefined") return ok(null); const r = indexedDB.open("mutirao_sessao", 1); r.onupgradeneeded = () => r.result.createObjectStore("s"); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); }
});
const gravarAgora = async () => {
  if (!chaveUsuario) return;
  const db = await abrir(); if (!db) return;
  try {
    const copia: Dados = {}; for (const k of PERSISTIR) copia[k] = dados[k];
    const vazio = !copia.pdfFullText && !copia.ataText && !copia.sentenceText && !(copia.videoFiles || []).length;
    await new Promise<void>((ok) => { const t = db.transaction("s", "readwrite"); if (vazio) t.objectStore("s").delete(chaveUsuario); else t.objectStore("s").put({ ...copia, salvoEm: Date.now() }, chaveUsuario); t.oncomplete = () => ok(); t.onerror = () => ok(); t.onabort = () => ok(); });
  } catch { /* sem espaço ou navegador privado: segue sem salvar */ } finally { db.close(); }
};
const agendarGravacao = () => { if (tempo) clearTimeout(tempo); tempo = setTimeout(() => { tempo = null; void gravarAgora(); }, 800); };
const avisar = () => ouvintes.forEach((f) => f());

export const sessaoMutirao = {
  ler: <T,>(k: string): T => dados[k] as T,
  definir(k: string, v: any) {
    const novo = typeof v === "function" ? v(dados[k]) : v;
    if (Object.is(novo, dados[k])) return;
    dados = { ...dados, [k]: novo }; avisar();
    if (PERSISTIR.includes(k)) agendarGravacao();
  },
  assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  /** Restaura a sessão deste usuário (uma vez por carregamento da página). Devolve o aviso a mostrar, se algo ficou pela metade. */
  async carregar(uid: string): Promise<string | null> {
    if (!uid || carregadoPara === uid) return recuperou;
    carregadoPara = uid; chaveUsuario = `u:${uid}`;
    const db = await abrir(); if (!db) return null;
    try {
      const salvo: Dados | undefined = await new Promise((ok) => { const t = db.transaction("s", "readonly"), r = t.objectStore("s").get(chaveUsuario); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); });
      if (salvo && Date.now() - (salvo.salvoEm || 0) < 7 * 24 * 3600_000) {
        const jaTem = dados.pdfFullText || dados.ataText || dados.sentenceText || dados.videoFiles.length;      // a pessoa já começou algo nesta página: não sobrescreve
        if (!jaTem) { const r: Dados = {}; for (const k of PERSISTIR) if (salvo[k] !== undefined) r[k] = salvo[k]; dados = { ...dados, ...r, isProcessingPdf: false, isProcessingVideo: false }; avisar(); recuperou = "Sessão do Mutirão recuperada de onde parou."; return recuperou; }
      }
    } finally { db.close(); }
    return null;
  },
  /** Zera tudo (nova pauta). */
  limpar() { dados = { ...INICIAL, selectedPromptId: dados.selectedPromptId, sentencasDaSessao: 0 }; avisar(); agendarGravacao(); },
  vaiGravar: () => gravarAgora(),
  /** só para testes */ _resetar() { dados = { ...INICIAL }; carregadoPara = ""; chaveUsuario = ""; recuperou = null; ouvintes.clear(); },
};

/** Como `useState`, mas o valor vive na sessão acima e sobrevive a trocas de aba, fechamento da janela e recarga da página. */
export function useSessao<T>(chave: string): [T, (v: T | ((a: T) => T)) => void] {
  const valor = useSyncExternalStore(sessaoMutirao.assinar, () => dados[chave] as T, () => INICIAL[chave] as T);
  const definir = useCallback((v: T | ((a: T) => T)) => sessaoMutirao.definir(chave, v), [chave]);
  return [valor, definir];
}
