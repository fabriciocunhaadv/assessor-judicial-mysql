// Modelos cadastrados no Projudi (decisão, despacho, sentença, citação, ofício, certidão, mandado…), guardados POR GABINETE no Studio.
// A extensão captura os textos e entrega pela ponte (window.postMessage); aqui eles são gravados e consultados.
// Uso: com a minuta pronta, "Conferir com os modelos do Projudi" acha os mais parecidos e compara (nada muda sem o usuário aceitar).
import { db, auth } from "../lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc } from "../lib/docstore";
import { globalTenantId } from "../lib/firestoreUtils";
import { MinuteData } from "../types";

export interface ModeloProjudi {
  id: string;            // serventia + id do Projudi (único)
  projudiId: string;
  nome: string;
  tipo: string;          // Decisão, Despacho, Sentença, Citação, Ofício…
  serventia: string;
  texto: string;
  hash: string;
  atualizadoEm: number;
}
export const MODELOS_PROJUDI_EVENTO = "assessor_modelos_projudi_atualizados";
const caminho = () => `gabinetes/${globalTenantId}/modelosProjudi`;
const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const idDe = (serventia: string, projudiId: string) => `${semAcento(serventia).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}_${String(projudiId).replace(/[^\w-]/g, "")}`;
export const hashTexto = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); };

export async function listarModelosProjudi(): Promise<ModeloProjudi[]> {
  if (!auth.currentUser) return [];
  const sn = await getDocs(collection(db, caminho()));
  return sn.docs.map((d: any) => ({ id: d.id, ...d.data() } as ModeloProjudi)).sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
}
export async function apagarModeloProjudi(id: string): Promise<void> { await deleteDoc(doc(db, caminho(), id)); window.dispatchEvent(new Event(MODELOS_PROJUDI_EVENTO)); }

/** Grava os modelos que a extensão enviou: só regrava o que mudou (pelo hash do texto). Devolve quantos foram gravados/atualizados e quantos já estavam iguais. */
export async function receberModelosProjudi(itens: any[]): Promise<{ gravados: number; iguais: number; ignorados: number }> {
  const atuais = new Map((await listarModelosProjudi()).map((m) => [m.id, m]));
  let gravados = 0, iguais = 0, ignorados = 0;
  for (const it of itens || []) {
    const texto = String(it?.texto || "").trim();
    if (!it?.projudiId || !it?.nome || texto.length < 20) { ignorados++; continue; }
    const m: ModeloProjudi = { id: idDe(String(it.serventia || ""), String(it.projudiId)), projudiId: String(it.projudiId), nome: String(it.nome).slice(0, 200), tipo: String(it.tipo || "Outros").slice(0, 40), serventia: String(it.serventia || "").slice(0, 200), texto: texto.slice(0, 60000), hash: hashTexto(texto), atualizadoEm: Date.now() };
    if (atuais.get(m.id)?.hash === m.hash) { iguais++; continue; }
    await setDoc(doc(db, caminho(), m.id), m as any); gravados++;
  }
  if (gravados) window.dispatchEvent(new Event(MODELOS_PROJUDI_EVENTO));
  return { gravados, iguais, ignorados };
}

// ---------- achar os modelos parecidos com a minuta (sem IA) ----------
const RUIDO = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com", "por", "padrao", "modelo", "um", "uma", "no", "na", "ao", "que", "se", "ou", "go", "vara", "unica"]);
const palavras = (s: string) => semAcento(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !RUIDO.has(w));
const radical = (w: string) => w.replace(/(oes|ao|s)$/, "").slice(0, 7);

export const textoDaMinuta = (m: MinuteData) => [m.title, m.relatorio, m.fundamentacao, m.dispositivo, m.closing].filter(Boolean).join("\n\n") || m.fullFormattedText || "";

/** Pontua cada modelo: palavras do NOME do modelo que aparecem na minuta (peso maior no dispositivo) + coincidência do tipo do ato. */
export function modelosParecidos(minuta: MinuteData, modelos: ModeloProjudi[], serventia?: string, limite = 3): { modelo: ModeloProjudi; pontos: number }[] {
  const corpo = semAcento(textoDaMinuta(minuta)), disp = semAcento(minuta.dispositivo || ""), titulo = semAcento(minuta.title || "");
  const tipoAto = /senten/.test(titulo) ? "senten" : /despach/.test(titulo) ? "despach" : /decis/.test(titulo) ? "decis" : "";
  const serv = semAcento(serventia || minuta.judicialUnit || minuta.vara || "");
  const pts = modelos.map((m) => {
    const ws = [...new Set(palavras(m.nome).map(radical))]; if (!ws.length) return { modelo: m, pontos: 0 };
    let acertos = 0;
    for (const w of ws) { if (corpo.includes(w)) acertos += disp.includes(w) ? 1.6 : 1; }
    let pontos = (acertos / ws.length) * 10;
    if (tipoAto && semAcento(m.tipo).startsWith(tipoAto)) pontos += 2;
    if (serv && m.serventia && (serv.includes(semAcento(m.serventia).split(" - ").pop() || "§") || semAcento(m.serventia).includes(serv))) pontos += 1;
    if (/padrao/.test(semAcento(m.nome))) pontos -= 1;      // “Sentença Padrão” serve a qualquer um: só entra se nada for mais específico
    return { modelo: m, pontos };
  });
  return pts.filter((x) => x.pontos >= 3).sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}
