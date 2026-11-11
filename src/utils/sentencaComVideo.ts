// SENTENÇA COM O VÍDEO DA AUDIÊNCIA, SEM TELA: a extensão (esteira) entrega o PDF dos autos e os vídeos/áudios de cada processo (em partes, pela ponte da página) e este módulo faz
// o mesmo caminho do Mutirão: lê o PDF → ata prévia → envia as mídias → degravação + sentença (mesma base do estúdio principal) → salva no Histórico → devolve a minuta à extensão.
// Serve para qualquer processo que teve audiência de instrução com vídeo, em fila (um processo por vez).
import { lerAutosPdf } from "./lerAutosPdf";
import { enviarMidiaEmPartes } from "./enviarMidia";
import { fetchRecuperavel } from "./fetchRecuperavel";
import { getApiHeaders, getCustomApiKey } from "./apiKeyManager";
import { getKnowledgeDocs } from "./knowledgeDb";
import { getCabinetTeses } from "./tesesDb";
import { saveToHistory } from "./historyDb";
import type { SavedAnalysis } from "../types";

export interface PedidoSentencaVideo { reqId: string; processo: string; promptTitulo: string; promptTexto: string; promptCategoria?: string; pdf: File; videos: File[] }
export type ResultadoSentencaVideo = { ok: true; minuta: string; transcricao: string; processo: string; autor: string; reu: string; historicoId: string; fontes?: any; aviso?: string } | { ok: false; erro: string; semRetry?: boolean };

const limpar = (t: string) => String(t || "").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "    ").replace(/^"|"$/g, "").trim();
const novoId = () => globalThis.crypto?.randomUUID?.() || `sv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function executarSentencaComVideo(p: PedidoSentencaVideo, andamento: (t: string, pct?: number) => void = () => {}, cancelado: () => boolean = () => false): Promise<ResultadoSentencaVideo> {
  try {
    // 1) autos
    andamento("Lendo os autos…", 3);
    const lido = await lerAutosPdf(p.pdf, (etapa, f, t) => andamento(`Autos: ${etapa}${t ? ` ${f}/${t}` : ""}`, 3));
    const texto = lido.text || "";
    if (texto.replace(/\s|\[Página[^\]]*\]/g, "").length < 200) return { ok: false, erro: "não consegui extrair texto do PDF dos autos (o OCR pode não ter funcionado)", semRetry: true };
    if (cancelado()) return { ok: false, erro: "cancelado" };

    // 2) ata prévia + dados das partes (mesma rota do Mutirão)
    andamento("Montando a ata prévia…", 12);
    let teses: any = { isEnabled: false, text: "" }; try { teses = await getCabinetTeses(); } catch { /* sem teses */ }
    let base: any[] = []; try { base = (await getKnowledgeDocs()).filter((d: any) => d.isActive); } catch { /* sem base */ }
    const ataRes = await fetch("/api/mutirao-extract-ata", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ pdfText: texto, cabinetTesesText: teses.isEnabled ? teses.text || "" : "", knowledgePdfs: base }) });
    if (!ataRes.ok) throw new Error("Erro ao montar a ata prévia (" + ataRes.status + ")");
    const ata = (await ataRes.json())?.data || {};
    const processo = ata.processNumber || p.processo || "";
    if (cancelado()) return { ok: false, erro: "cancelado" };

    // 3) e 4) mídias + degravação/sentença; se o servidor reiniciar ou a conexão cair no meio, refaz o envio uma vez sozinho (a análise é guardada no servidor, mas a reinicialização a perde)
    let r: any = null, sentenca = "", degravacao = "";
    for (let tentativa = 1; tentativa <= 2 && !sentenca; tentativa++) {
      try {
        if (tentativa === 2) andamento("O servidor reiniciou ou a conexão caiu: tentando de novo…", 20);
    const enviadas: any[] = [];
    for (let k = 0; k < p.videos.length; k++) {
      const f = p.videos[k], pre = p.videos.length > 1 ? `Mídia ${k + 1} de ${p.videos.length}: ` : "";
      andamento(`${pre}enviando…`, 18 + Math.round((k / Math.max(1, p.videos.length)) * 20));
      const e = await enviarMidiaEmPartes(f, (fe, t) => andamento(`${pre}enviando parte ${fe} de ${t}`, 18 + Math.round((k / Math.max(1, p.videos.length)) * 20)));
      enviadas.push({ ...e, nomeMidia: f.name, mimeMidia: f.type || "" });
      if (cancelado()) return { ok: false, erro: "cancelado" };
    }

    // 4) degravação + sentença (o servidor guarda o resultado: se a conexão cair, busca depois)
    andamento("A IA está ouvindo a audiência e redigindo a sentença…", 40);
    const fd = new FormData();
    fd.append("midias", JSON.stringify(enviadas));
    fd.append("ataText", limpar(ata.ataText || "")); fd.append("pdfText", texto); fd.append("processNumber", processo);
    fd.append("customInstruction", ""); fd.append("customPromptTemplate", p.promptTexto || "");
    fd.append("promptTitle", p.promptTitulo || ""); fd.append("promptCategory", p.promptCategoria || "");
    if (teses.isEnabled) { fd.append("cabinetTesesText", teses.text || ""); fd.append("isTesesEnabled", "true"); } else fd.append("isTesesEnabled", "false");
    if (base.length) fd.append("knowledgePdfs", JSON.stringify(base));
    const chave = getCustomApiKey(); if (chave) fd.append("customApiKey", chave);
    const progId = novoId();
    const vigia = setInterval(async () => { try { const a = await (await fetch(`/api/progresso/${encodeURIComponent(progId)}`, { cache: "no-store" })).json(); if (a?.texto) andamento(`${a.texto}${a.decorridoSeg ? ` (${Math.floor(a.decorridoSeg / 60)} min)` : ""}`, 40 + Math.min(55, Number(a.pct) || 0)); } catch { /* sem andamento */ } }, 5000);
    let resp: Response;
    try { resp = await fetchRecuperavel("/api/mutirao-video", { method: "POST", headers: { "x-progresso-id": progId, ...(chave ? { "x-gemini-api-key": chave } : {}) }, body: fd }, { esperaMaxMs: 25 * 60_000 }); } finally { clearInterval(vigia); }
    const corpo = await resp.text();
    try { r = JSON.parse(corpo); } catch { throw Object.assign(new Error(`O servidor não devolveu a resposta da análise (código ${resp.status}${/<html|<!doctype/i.test(corpo) ? ", página de erro da hospedagem" : ""}). Provável causa: o servidor foi reiniciado ou a conexão caiu no meio da degravação.`), { tentarDeNovo: true }); }
    if (!resp.ok || r.success === false) throw new Error(r.error || "Erro ao processar a mídia");
    sentenca = limpar(r.data?.sentenceText || ""), degravacao = limpar(r.data?.transcription || "");
    if (!sentenca) throw new Error("A IA não devolveu a sentença.");

      } catch (e: any) { if (!e?.tentarDeNovo || tentativa === 2) throw e; }
    }
    // 5) Histórico (mesmo formato do Mutirão)
    andamento("Salvando no Histórico…", 97);
    const id = novoId();
    const analise: SavedAnalysis = {
      id, promptTitle: p.promptTitulo || "Sentença de Instrução e Julgamento", promptId: "sentenca_audiencia_video", date: Date.now(), processNumber: processo || "Processo s/ nº",
      processTextContext: "Sentença com vídeo da audiência (esteira da extensão): autos em PDF + mídia degravada.",
      result: { minute: { title: p.promptTitulo || "Sentença", header: "PODER JUDICIÁRIO", processNumber: processo || "Processo s/ nº", parties: { author: ata.author || "Parte Autora", defendant: ata.defendant || "Parte Ré" }, relatorio: degravacao, fundamentacao: "Análise probatória conforme termo e mídia da audiência.", dispositivo: sentenca, fullFormattedText: sentenca } as any, auditAnalysis: {} as any },
    } as any;
    const salvo = await saveToHistory(analise).catch((e: any) => ({ ok: false, erro: String(e?.message || e) }));
    if (!salvo.ok) console.warn("[sentença com vídeo] não gravou no Histórico:", salvo.erro);
    return { ok: true, aviso: salvo.ok ? undefined : `A sentença foi gerada, mas NÃO foi gravada no Histórico (${salvo.erro || "erro"}). Copie o texto daqui.`, minuta: sentenca, transcricao: degravacao, processo, autor: ata.author || "", reu: ata.defendant || "", historicoId: id, fontes: r.fontesConsultadas };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message || e) };
  }
}

// ---------- andamento visível no Studio (a fila roda sem tela: este quadro mostra o que está acontecendo) ----------
export interface ItemSV { reqId: string; processo: string; texto: string; pct: number; estado: "rodando" | "ok" | "erro"; erro?: string; inicio: number; fim?: number }
let itensSV: ItemSV[] = []; const ouvintesSV = new Set<() => void>();
const avisarSV = () => ouvintesSV.forEach((f) => f());
export const filaSentencaVideo = {
  lista: () => itensSV,
  assinar: (f: () => void) => { ouvintesSV.add(f); return () => { ouvintesSV.delete(f); }; },
  atualizar(reqId: string, mudanca: Partial<ItemSV>, novo?: Partial<ItemSV>) {
    const i = itensSV.findIndex((x) => x.reqId === reqId);
    if (i < 0) itensSV = [...itensSV, { reqId, processo: "", texto: "", pct: 0, estado: "rodando", inicio: Date.now(), ...novo, ...mudanca } as ItemSV];
    else itensSV = itensSV.map((x, k) => (k === i ? { ...x, ...mudanca } : x));
    avisarSV();
  },
  remover(reqId: string) { itensSV = itensSV.filter((x) => x.reqId !== reqId); avisarSV(); },
};

// ---------- ponte com a extensão (window.postMessage ↔ studio-base.js) ----------
const b64ParaBytes = (b: string) => { const s = atob(b || ""), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
interface Recebido { arquivos: Map<number, { nome: string; tipo: string; partes: string[] }>; cancelar: boolean }
const recebidos = new Map<string, Recebido>();
let fila: Promise<unknown> = Promise.resolve();      // um processo por vez

export function instalarPonteSentencaVideo(): () => void {
  if (typeof window === "undefined") return () => {};
  const origem = window.location.origin;
  const resp = (reqId: string, o: Record<string, unknown>) => window.postMessage({ __projudiResp: "sv", reqId, ...o }, origem);
  document.documentElement.dataset.assessorSentencaVideo = "1";      // a extensão só usa este caminho se o Studio avisar que sabe fazer
  const ouvir = (ev: MessageEvent) => {
    const d = ev.data;
    if (ev.source !== window || ev.origin !== origem || !d || d.__projudi !== "sv" || typeof d.reqId !== "string") return;
    const r = recebidos.get(d.reqId) || { arquivos: new Map(), cancelar: false }; recebidos.set(d.reqId, r);
    if (d.fase === "parte") {
      const a = r.arquivos.get(d.idx) || { nome: String(d.nome || ""), tipo: String(d.tipo || ""), partes: [] }; a.partes[d.n] = String(d.dados || ""); r.arquivos.set(d.idx, a);
      resp(d.reqId, { tipo: "parte-ok", idx: d.idx, n: d.n });
    } else if (d.fase === "cancelar") { r.cancelar = true; }
    else if (d.fase === "iniciar") {
      fila = fila.then(async () => {
        const montar = (idx: number): File | null => { const a = r.arquivos.get(idx); if (!a || !a.partes.length || a.partes.some((x) => !x)) return null; return new File(a.partes.map(b64ParaBytes), a.nome, { type: a.tipo }); };
        const pdf = montar(d.pdfIdx), videos = (d.videosIdx as number[]).map(montar);
        if (!pdf || videos.some((v) => !v)) { resp(d.reqId, { tipo: "resultado", ok: false, erro: "o Studio não recebeu os arquivos completos (envie de novo)" }); recebidos.delete(d.reqId); return; }
        resp(d.reqId, { tipo: "iniciado" });
        filaSentencaVideo.atualizar(d.reqId, { processo: String(d.processo || ""), texto: "Começando…", estado: "rodando" });
        const res = await executarSentencaComVideo({ reqId: d.reqId, processo: String(d.processo || ""), promptTitulo: String(d.promptTitulo || ""), promptTexto: String(d.promptTexto || ""), promptCategoria: String(d.promptCategoria || ""), pdf, videos: videos as File[] },
          (texto, pct) => { filaSentencaVideo.atualizar(d.reqId, { texto, pct: pct || 0 }); resp(d.reqId, { tipo: "andamento", texto, pct }); }, () => r.cancelar);
        filaSentencaVideo.atualizar(d.reqId, res.ok ? { estado: "ok", texto: "Sentença pronta e salva no Histórico", pct: 100, fim: Date.now(), processo: res.processo || String(d.processo || "") } : { estado: "erro", erro: (res as any).erro, texto: "Falhou", fim: Date.now() });
        resp(d.reqId, { tipo: "resultado", ...res }); recebidos.delete(d.reqId);
      });
    }
  };
  window.addEventListener("message", ouvir);
  return () => { window.removeEventListener("message", ouvir); delete document.documentElement.dataset.assessorSentencaVideo; };
}
