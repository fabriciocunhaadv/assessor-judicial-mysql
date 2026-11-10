// PDF inserido no Studio: quem trata é a EXTENSÃO (confere página por página, faz OCR só nas páginas de imagem, inclusive as que têm só o carimbo do Projudi,
// e devolve o TEXTO). Sem a extensão, o computador é bloqueado com o link de instalação; só no CELULAR (onde não dá para instalar) o Studio lê o PDF sozinho (OCR por IA).
import { detectarAparelho, type Aparelho } from "./instalacaoApp";

export const LINK_EXTENSAO = "https://chromewebstore.google.com/detail/conclus%C3%B5es-projudi/ioiadaafdnannofgkoioefhejkpmlgpe?hl=pt-BR";
export type Caminho = "extensao" | "studio" | "instalar" | "atualizar";

export interface EstadoExtensao { automatico: boolean; versao: string; recursos: string; aparelho: Aparelho }
/** Decide quem trata o PDF. Regras PURAS (testáveis). */
export function decidirCaminho(e: EstadoExtensao): Caminho {
  if (e.automatico) return "studio";      // a esteira da extensão já entrega o PDF com OCR: não tratar de novo
  if (e.recursos.split(",").map((x) => x.trim()).includes("pdf")) return "extensao";
  if (e.aparelho !== "computador") return "studio";      // celular/tablet: não dá para instalar a extensão
  return e.versao ? "atualizar" : "instalar";
}

export function lerEstado(): EstadoExtensao {
  const el = document.documentElement.dataset;
  return { automatico: el.assessorAuto === "1", versao: el.assessorExtensao || "", recursos: el.assessorExtensaoRecursos || "", aparelho: detectarAparelho(navigator.userAgent, (navigator as any).platform || "", navigator.maxTouchPoints || 0) };
}
/** O script da extensão marca a página logo depois de carregar: espera um pouco antes de concluir que ela não está instalada. */
export async function caminhoAtual(esperaMs = 1500): Promise<Caminho> {
  const t0 = Date.now();
  for (;;) { const e = lerEstado(); const c = decidirCaminho(e); if (c !== "instalar" && c !== "atualizar") return c; if (Date.now() - t0 >= esperaMs) return c; await new Promise((ok) => setTimeout(ok, 200)); }
}

export interface ResultadoExtensao { texto: string; paginas: number; ocr: number; paginasOcr: number[]; puladas: number[]; segundos: number; vazias: number[]; pdfComOcr?: Blob }
export interface OpcoesExtensao { aoProgresso?: (etapa: string, feitas: number, total: number) => void; sinal?: AbortSignal }
const PARTE = 1_500_000;      // bytes por pedaço enviado à extensão

const paraBase64 = (blob: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => { const s = String(r.result || ""); ok(s.slice(s.indexOf("base64,") + 7)); }; r.onerror = () => no(new Error("não consegui ler o arquivo")); r.readAsDataURL(blob); });

/** Entrega o PDF à extensão (em partes) e espera o texto. Erros viram `Error` com a causa em português. */
export async function tratarPdfNaExtensao(file: File, op: OpcoesExtensao = {}): Promise<ResultadoExtensao> {
  const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");
  const origem = window.location.origin;
  const pdfPartes: string[] = []; const espera = new Map<string, (m: any) => void>(); let progressoEm = Date.now(), resultado: ((m: any) => void) | null = null, vigia: ReturnType<typeof setInterval> | null = null;
  const ouvir = (ev: MessageEvent) => {
    const m = ev.data; if (ev.source !== window || !m || m.__projudiResp !== "pdf-tratar" || m.id !== id) return;
    if (m.tipo === "progresso") { progressoEm = Date.now(); op.aoProgresso?.(String(m.etapa || ""), Number(m.feitas) || 0, Number(m.total) || 0); return; }
    if (m.tipo === "pdf-parte") { progressoEm = Date.now(); pdfPartes[Number(m.n) || 0] = String(m.dados || ""); op.aoProgresso?.("Recebendo o PDF com OCR", pdfPartes.filter(Boolean).length, Number(m.total) || 0); return; }
    if (m.tipo === "resultado") { resultado?.(m); return; }
    const chave = m.tipo === "parte-ok" ? `parte-ok:${m.n}` : m.tipo; espera.get(chave)?.(m); espera.get("erro")?.(m.tipo === "erro" ? m : null);
  };
  window.addEventListener("message", ouvir);
  const enviar = (o: Record<string, unknown>) => window.postMessage({ __projudi: "pdf-tratar", id, ...o }, origem);
  const aguardar = (tipo: string, ms: number) => new Promise<any>((ok, no) => {
    const t = setTimeout(() => { espera.delete(tipo); no(new Error("a extensão não respondeu a tempo")); }, ms);
    espera.set(tipo, (m) => { clearTimeout(t); espera.delete(tipo); ok(m); });
    espera.set("erro", (m) => { if (m?.tipo === "erro") { clearTimeout(t); no(new Error(m.erro || "falha na extensão")); } });
  });
  op.sinal?.addEventListener("abort", () => enviar({ fase: "cancelar" }));
  try {
    op.aoProgresso?.("Abrindo o tratamento na extensão", 0, 0);
    const pronto = aguardar("pronto", 45_000); enviar({ fase: "inicio" }); await pronto;
    const partes = Math.max(1, Math.ceil(file.size / PARTE));
    for (let n = 0; n < partes; n++) {
      if (op.sinal?.aborted) throw new Error("cancelado");
      const dados = await paraBase64(file.slice(n * PARTE, (n + 1) * PARTE));
      const ok = aguardar(`parte-ok:${n}`, 60_000); enviar({ fase: "parte", n, dados }); await ok;
      op.aoProgresso?.("Enviando o PDF para a extensão", n + 1, partes);
    }
    const fim = aguardar("fim-ok", 20_000);
    const res = new Promise<any>((ok, no) => {
      progressoEm = Date.now(); resultado = ok;
      vigia = setInterval(() => { if (Date.now() - progressoEm > 180_000) no(new Error("o tratamento na extensão parou de responder (a aba foi fechada?)")); }, 5000);
    });
    enviar({ fase: "fim" }); await fim;
    const m = await res;
    if (!m.ok) throw new Error(m.erro || "a extensão não conseguiu tratar o PDF");
    let pdfComOcr: Blob | undefined;
    const esperadas = Number(m.pdfPartes) || 0;
    if (esperadas > 0 && pdfPartes.filter(Boolean).length === esperadas) {
      try { pdfComOcr = new Blob(pdfPartes.map((b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }), { type: "application/pdf" }); } catch { /* fica com o original */ }
    }
    return { pdfComOcr, vazias: Array.isArray(m.vazias) ? m.vazias : [], texto: String(m.texto || ""), paginas: Number(m.paginas) || 0, ocr: Number(m.ocr) || 0, paginasOcr: Array.isArray(m.paginasOcr) ? m.paginasOcr : [], puladas: Array.isArray(m.puladas) ? m.puladas : [], segundos: Number(m.segundos) || 0 };
  } finally { window.removeEventListener("message", ouvir); if (vigia) clearInterval(vigia); }
}
