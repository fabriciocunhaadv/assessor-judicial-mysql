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
import { chaveDoArquivo, degravacaoDoArquivo, guardarDegravacaoDoArquivo } from "./degravacaoGuardada";
import type { SavedAnalysis } from "../types";
import { registrarOperacao } from "./monitorOperacao";
import { entradasExternas } from "./entradaExterna";
import { resolverUnidade } from "./minutaExterna";
import { organizarMinutaExterna } from "./organizarMinutaExterna";

export interface PedidoSentencaVideo { reqId: string; processo: string; promptTitulo: string; promptTexto: string; promptCategoria?: string; serventia?: string; degravacaoPronta?: string; quadro?: string; pdf?: File; videos: File[]; /** a degravação veio COLADA pelo usuário (sem vídeo): a etiqueta do Histórico diz "transcrição" */ origemTexto?: boolean; /** nomes dos vídeos de onde veio a degravação pronta (etiqueta do Histórico) */ nomesOrigem?: string[];
  /** Mutirão Expresso manual: os autos (já com o quadro) e a ata prévia já foram lidos na tela; usa os mesmos, sem ler de novo. */ textoAutos?: string; ataPronta?: { ataText: string; processNumber?: string; author?: string; defendant?: string };
  /** avisa o id da análise guardada no servidor (a tela usa para recuperar o resultado se a página recarregar) */ aoIniciarAnalise?: (progId: string) => void }
export type ResultadoSentencaVideo = { ok: true; minuta: string; transcricao: string; processo: string; autor: string; reu: string; historicoId: string; fontes?: any; aviso?: string } | { ok: false; erro: string; semRetry?: boolean; transcricao?: string };

const limpar = (t: string) => String(t || "").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "    ").replace(/^"|"$/g, "").trim();
const novoId = () => globalThis.crypto?.randomUUID?.() || `sv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** MUTIRÃO, VÍDEO A VÍDEO: envia e degrava UMA mídia por vez, guardando cada degravação ao terminar. Reaproveita as que já estão prontas (retomada depois de queda, reinício do servidor ou falha de outro vídeo).
 *  Devolve a degravação completa no formato `=== VÍDEO/ÁUDIO k DE n ("nome") ===`. Uma nova tentativa automática só em falha de conexão/servidor; erro da IA é mostrado com o que já ficou guardado. */
export async function degravarVideosPorEtapas(a: { videos: File[]; processo: string; ataText: string; andamento: (t: string, pct?: number) => void; cancelado?: () => boolean; aoVideoPronto?: (k: number) => void; aoIniciarAnalise?: (progId: string) => void }): Promise<string> {
  const n = a.videos.length, partes: string[] = [], chaveApi = getCustomApiKey();
  const faixa = (k: number, dentro = 0) => 3 + Math.round(((k + dentro) / Math.max(1, n)) * 35);
  for (let k = 0; k < n; k++) {
    if (a.cancelado?.()) throw Object.assign(new Error("cancelado"), { cancelado: true });
    const f = a.videos[k], ck = chaveDoArquivo(f), pre = n > 1 ? `Vídeo ${k + 1} de ${n}: ` : "";
    let tx = degravacaoDoArquivo(ck);
    if (tx) { a.andamento(`${pre}já degravado antes (reaproveitado)`, faixa(k, 1)); }
    else {
      let ultimo: any = null;
      for (let tentativa = 1; tentativa <= 2 && !tx; tentativa++) {
        try {
          if (tentativa === 2) a.andamento(`${pre}a conexão com o servidor caiu: enviando de novo…`, faixa(k));
          a.andamento(`${pre}enviando…`, faixa(k));
          const env = await enviarMidiaEmPartes(f, (fe, t) => a.andamento(`${pre}enviando parte ${fe} de ${t}`, faixa(k, (fe / t) * 0.4)));
          if (a.cancelado?.()) throw Object.assign(new Error("cancelado"), { cancelado: true });
          const progId = novoId(); try { a.aoIniciarAnalise?.(progId); } catch { /* aviso da tela nunca atrapalha */ }
          const vigia = setInterval(async () => { try { const x = await (await fetch(`/api/progresso/${encodeURIComponent(progId)}`, { cache: "no-store" })).json(); if (x?.texto) a.andamento(`${x.texto}${x.decorridoSeg ? ` (${Math.floor(x.decorridoSeg / 60)} min)` : ""}`, faixa(k, 0.5)); } catch { /* sem andamento */ } }, 5000);
          let resp: Response;
          try {
            resp = await fetchRecuperavel("/api/mutirao-degravar", { method: "POST", headers: { "Content-Type": "application/json", "x-progresso-id": progId, ...(chaveApi ? { "x-gemini-api-key": chaveApi } : {}) },
              body: JSON.stringify({ midia: { ...env, nomeMidia: f.name, mimeMidia: f.type || "" }, idx: k, total: n, processNumber: a.processo, ataText: String(a.ataText || "").slice(0, 20000) }) }, { esperaMaxMs: 20 * 60_000 });
          } finally { clearInterval(vigia); }
          const corpo = await resp.text(); let r: any = null;
          try { r = JSON.parse(corpo); } catch { throw Object.assign(new Error(`O servidor não devolveu a degravação (código ${resp.status}${/<html|<!doctype/i.test(corpo) ? ", página de erro da hospedagem" : ""}). Provável causa: o servidor reiniciou.`), { reenviar: true }); }
          if (!resp.ok || r.success === false) throw new Error(r.error || `Erro ${resp.status} ao degravar a mídia`);
          tx = String(r.texto || "").trim();
          if (tx.length < 40) throw new Error("A IA não devolveu a degravação.");
        } catch (e: any) { ultimo = e; if (e?.cancelado || !e?.reenviar || tentativa === 2) break; }
      }
      if (!tx) {
        if (ultimo?.cancelado) throw ultimo;
        const prontos = a.videos.filter((v) => degravacaoDoArquivo(chaveDoArquivo(v))).length;
        throw new Error(`${pre.trim() ? pre : ""}${String(ultimo?.message || ultimo || "falha ao degravar")}${prontos ? ` As degravações de ${prontos} vídeo(s) ficaram guardadas: ao gerar de novo, só o que falta será refeito.` : ""}`);
      }
      guardarDegravacaoDoArquivo(ck, tx);
    }
    try { a.aoVideoPronto?.(k); } catch { /* aviso da tela nunca atrapalha */ }
    partes.push(n > 1 ? `=== VÍDEO/ÁUDIO ${k + 1} DE ${n} ("${f.name}") ===\n${tx}` : tx);
  }
  return partes.join("\n\n");
}

/** O ato do Histórico guarda só o que a pessoa usa: tira do resultado do motor os blocos pesados (texto reduzido dos autos, mapa, pesquisa ao vivo, resumo da 1ª etapa). */
export function enxugarResultado(r: any): any {
  const o = { ...r };
  for (const k of ["autosReduzidos", "mapaProcesso", "groundingTexto", "groundingSources", "stage1Snapshot", "holisticSynopsis", "coberturaLeitura"]) delete o[k];
  return o;
}

async function executarSentencaComVideoInterno(p: PedidoSentencaVideo, andamento: (t: string, pct?: number) => void = () => {}, cancelado: () => boolean = () => false): Promise<ResultadoSentencaVideo> {
  try {
    // 1) autos
    andamento("Lendo os autos…", 3);
    const lido = p.textoAutos ? { text: p.textoAutos } : await lerAutosPdf(p.pdf as File, (etapa, f, t) => andamento(`Autos: ${etapa}${t ? ` ${f}/${t}` : ""}`, 3));
    const texto = (p.quadro || "") + (lido.text || "");      // o quadro de movimentações (cronologia oficial, inclusive movimentos sem arquivo) vem antes dos autos
    if (texto.replace(/\s|\[Página[^\]]*\]/g, "").length < 200) return { ok: false, erro: "não consegui extrair texto do PDF dos autos (o OCR pode não ter funcionado)", semRetry: true };
    if (cancelado()) return { ok: false, erro: "cancelado" };

    // 2) ata prévia + dados das partes (mesma rota do Mutirão)
    andamento("Montando a ata prévia…", 12);
    let teses: any = { isEnabled: false, text: "" }; try { teses = await getCabinetTeses(); } catch { /* sem teses */ }
    let base: any[] = []; try { base = (await getKnowledgeDocs()).filter((d: any) => d.isActive); } catch { /* sem base */ }
    let ata: any = p.ataPronta || null;
    if (!ata) {
      const ataRes = await fetch("/api/mutirao-extract-ata", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ pdfText: texto, cabinetTesesText: teses.isEnabled ? teses.text || "" : "", knowledgePdfs: base }) });
      if (!ataRes.ok) throw new Error("Erro ao montar a ata prévia (" + ataRes.status + ")");
      ata = (await ataRes.json())?.data || {};
    }
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
    if (p.degravacaoPronta) fd.append("degravacaoPronta", p.degravacaoPronta);      // degravação já feita nestes mesmos vídeos: o servidor não recebe nem ouve a mídia de novo
    fd.append("unidadeNome", p.serventia || ""); fd.append("autor", ata.author || ""); fd.append("reu", ata.defendant || "");
    if (teses.isEnabled) { fd.append("cabinetTesesText", teses.text || ""); fd.append("isTesesEnabled", "true"); } else fd.append("isTesesEnabled", "false");
    if (base.length) fd.append("knowledgePdfs", JSON.stringify(base));
    const chave = getCustomApiKey(); if (chave) fd.append("customApiKey", chave);
    const progId = novoId();
    try { p.aoIniciarAnalise?.(progId); } catch { /* aviso da tela nunca atrapalha */ }
    const vigia = setInterval(async () => { try { const a = await (await fetch(`/api/progresso/${encodeURIComponent(progId)}`, { cache: "no-store" })).json(); if (a?.texto) andamento(`${a.texto}${a.decorridoSeg ? ` (${Math.floor(a.decorridoSeg / 60)} min)` : ""}`, 40 + Math.min(55, Number(a.pct) || 0)); } catch { /* sem andamento */ } }, 5000);
    let resp: Response;
    try { resp = await fetchRecuperavel("/api/mutirao-video", { method: "POST", headers: { "x-progresso-id": progId, ...(chave ? { "x-gemini-api-key": chave } : {}) }, body: fd }, { esperaMaxMs: 25 * 60_000 }); } finally { clearInterval(vigia); }
    const corpo = await resp.text();
    try { r = JSON.parse(corpo); } catch { throw Object.assign(new Error(`O servidor não devolveu a resposta da análise (código ${resp.status}${/<html|<!doctype/i.test(corpo) ? ", página de erro da hospedagem" : ""}). Provável causa: o servidor foi reiniciado ou a conexão caiu no meio da degravação.`), { tentarDeNovo: true }); }
    if (!resp.ok || r.success === false) throw Object.assign(new Error(r.error || "Erro ao processar a mídia"), { transcricao: String(r?.data?.transcription || "") });
    sentenca = limpar(r.data?.sentenceText || r.resultado?.minute?.fullFormattedText || ""), degravacao = limpar(r.data?.transcription || "");
    if (!sentenca) throw new Error("A IA não devolveu a sentença.");

      } catch (e: any) { if (!e?.tentarDeNovo || tentativa === 2) throw e; }
    }
    // 5) Histórico: a minuta é SÓ a sentença (a degravação é prova e fica à parte); a vara vem da serventia; etiqueta própria "Sentença com vídeo"
    andamento("Salvando no Histórico…", 97);
    const ctx = entradasExternas.contexto();
    const un = resolverUnidade(p.serventia || "", ctx?.unidades || [], ctx?.ativa);
    const cnj = (String(processo).match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || String(p.processo).match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [processo || "Sem número"])[0];
    let h = 0; for (let i = 0; i < sentenca.length; i++) h = (Math.imul(31, h) + sentenca.charCodeAt(i)) | 0;
    const id = `video-${cnj.replace(/\D/g, "")}-${(h >>> 0).toString(36)}`;      // o mesmo texto do mesmo processo grava no mesmo registro
    const origemVideo = { videos: p.origemTexto ? ["transcrição colada"] : (p.videos.length ? p.videos.map((v) => v.name) : (p.nomesOrigem || [])), degravacaoChars: degravacao.length, em: Date.now() };
    let resultado: any;
    if (r.resultado?.minute) {
      const m = { ...r.resultado.minute }; if (!m.judicialUnit) m.judicialUnit = un.name || p.serventia || "";
      resultado = enxugarResultado({ ...r.resultado, minute: m, origemVideo });
    } else {
      const org = organizarMinutaExterna(sentenca, "");
      resultado = { minute: { title: org.titulo || "SENTENÇA", header: `${un.name || p.serventia || ""}\nPROCESSO Nº ${cnj}`, processNumber: cnj, judicialUnit: un.name || p.serventia || "", parties: { author: org.autor || ata.author || "", defendant: org.reu || ata.defendant || "" }, relatorio: org.relatorio || "", fundamentacao: org.fundamentacao || "", dispositivo: org.dispositivo || "", closing: org.closing || "Documento assinado digitalmente.", fullFormattedText: sentenca }, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] }, origemVideo };
    }
    const analise: SavedAnalysis = {
      id, unitId: un.id, promptTitle: p.promptTitulo || "Sentença de Instrução e Julgamento", promptCategory: p.promptCategoria || "", promptScope: "judicial", date: Date.now(), processNumber: cnj, result: resultado,
      originalMinute: JSON.parse(JSON.stringify(resultado.minute)),
      processTextContext: p.origemTexto ? "[Sentença feita com a transcrição da audiência colada pelo usuário; a transcrição foi usada como prova oral e não faz parte da minuta]" : `[Sentença feita com o vídeo da audiência (${p.videos.length || (p.nomesOrigem || []).length} mídia(s)); a degravação foi usada como prova oral e não faz parte da minuta]`,
      createdBy: ctx?.user?.uid || "anonymous", creatorName: ctx?.user?.displayName || ctx?.user?.email?.split("@")[0] || "Assessor", creatorEmail: ctx?.user?.email || "", chatMessages: [],
    } as any;
    const salvo = await saveToHistory(analise).catch((e: any) => ({ ok: false, erro: String(e?.message || e) }));
    if (!salvo.ok) console.warn("[sentença com vídeo] não gravou no Histórico:", salvo.erro);
    return { ok: true, aviso: salvo.ok ? undefined : `A sentença foi gerada, mas NÃO foi gravada no Histórico (${salvo.erro || "erro"}). Copie o texto daqui.`, minuta: sentenca, transcricao: degravacao, processo: cnj, autor: ata.author || "", reu: ata.defendant || "", historicoId: id, fontes: r.fontesConsultadas };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message || e), transcricao: String(e?.transcricao || "") };
  }
}

/** Roda a sentença com vídeo e REGISTRA a operação no monitor do Super Admin (quem fez, qual prompt, qual unidade, quanto tempo, se deu certo). */
export async function executarSentencaComVideo(p: PedidoSentencaVideo, andamento: (t: string, pct?: number) => void = () => {}, cancelado: () => boolean = () => false): Promise<ResultadoSentencaVideo> {
  const t0 = Date.now();
  const res = await executarSentencaComVideoInterno(p, andamento, cancelado);
  try {
    if (!(res.ok === false && res.erro === "cancelado")) {
      const ctx = entradasExternas.contexto(), un = resolverUnidade(p.serventia || "", ctx?.unidades || [], ctx?.ativa);
      void registrarOperacao({ modulo: "sentenca_video", origem: "esteira", unitId: un.id, unitName: un.name || p.serventia || "", promptTitle: p.promptTitulo, promptCategory: p.promptCategoria, processo: res.ok ? res.processo : p.processo, resultado: res.ok ? "ok" : "erro", erro: res.ok ? "" : (res as any).erro, duracaoMs: Date.now() - t0 });
    }
  } catch { /* o monitor nunca atrapalha */ }
  return res;
}

// ---------- andamento visível no Studio (a fila roda sem tela: este quadro mostra o que está acontecendo) ----------
export interface ItemSV { reqId: string; processo: string; texto: string; pct: number; estado: "rodando" | "ok" | "erro"; erro?: string; inicio: number; fim?: number }
const CHAVE_SV = "assessor_selo_sentenca_video_v1";
let itensSV: ItemSV[] = []; const ouvintesSV = new Set<() => void>(); const interrompidos: string[] = [];
// o quadro SOBREVIVE a recarregar a página: o que estava pronto/falhou continua na tela até a pessoa fechar; o que estava rodando vira "interrompido" (a fila roda nesta página) e a extensão é avisada
try {
  const salvo = JSON.parse(localStorage.getItem(CHAVE_SV) || "[]") as ItemSV[];
  itensSV = (Array.isArray(salvo) ? salvo : []).filter((x) => x && x.reqId && Date.now() - (x.fim || x.inicio || 0) < 24 * 3600_000).map((x) => {
    if (x.estado !== "rodando") return x;
    interrompidos.push(x.reqId);
    return { ...x, estado: "erro" as const, texto: "Interrompido", erro: "A página do Studio foi recarregada enquanto este processo era feito. Use “Tentar de novo” na esteira da extensão.", fim: Date.now() };
  });
} catch { /* sem armazenamento */ }
const gravarSV = () => { try { localStorage.setItem(CHAVE_SV, JSON.stringify(itensSV.slice(-20))); } catch { /* sem espaço */ } };
const avisarSV = () => { gravarSV(); ouvintesSV.forEach((f) => f()); };
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
  document.documentElement.dataset.assessorSentencaVideo = "1";
  for (const id of interrompidos.splice(0)) resp(id, { tipo: "resultado", ok: false, erro: "A página do Studio foi recarregada durante o trabalho. Use “Tentar de novo” (os arquivos serão enviados outra vez)." });      // a extensão só usa este caminho se o Studio avisar que sabe fazer
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
        const res = await executarSentencaComVideo({ reqId: d.reqId, processo: String(d.processo || ""), promptTitulo: String(d.promptTitulo || ""), promptTexto: String(d.promptTexto || ""), promptCategoria: String(d.promptCategoria || ""), serventia: String(d.serventia || ""), degravacaoPronta: String(d.degravacaoPronta || ""), quadro: String(d.quadro || ""), pdf, videos: videos as File[] },
          (texto, pct) => { filaSentencaVideo.atualizar(d.reqId, { texto, pct: pct || 0 }); resp(d.reqId, { tipo: "andamento", texto, pct }); }, () => r.cancelar);
        filaSentencaVideo.atualizar(d.reqId, res.ok ? { estado: "ok", texto: "Sentença pronta e salva no Histórico", pct: 100, fim: Date.now(), processo: res.processo || String(d.processo || "") } : { estado: "erro", erro: (res as any).erro, texto: "Falhou", fim: Date.now() });
        resp(d.reqId, { tipo: "resultado", ...res }); recebidos.delete(d.reqId);
      });
    }
  };
  window.addEventListener("message", ouvir);
  return () => { window.removeEventListener("message", ouvir); delete document.documentElement.dataset.assessorSentencaVideo; };
}
