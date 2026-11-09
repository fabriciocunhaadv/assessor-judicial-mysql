// Fila no celular (lado do navegador): (1) leva ao servidor o resumo da fila que a extensão deixa na página; (2) liga/desliga os avisos deste aparelho (Web Push).
import { getApiHeaders } from "./apiKeyManager";

const json = async (url: string, corpo?: unknown) => {
  const r = await fetch(url, { method: corpo === undefined ? "GET" : "POST", headers: getApiHeaders(corpo === undefined ? {} : { "Content-Type": "application/json" }) as any, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.erro || `HTTP ${r.status}`); return j;
};
export const lerMinhaFila = () => json("/api/fila/minha");
export const salvarPrefs = (prefs: Record<string, boolean>) => json("/api/fila/prefs", { prefs });
export const enviarAvisoDeTeste = () => json("/api/fila/push/teste", {});
export const enviarComando = (tipo: string) => json("/api/fila/comando", { tipo });

let ponteLigada = false, ultimoEnvio = 0, ultimoTexto = "";
/** A extensão deixa o resumo em `data-projudi-fila-resumo` e avisa com `projudi:fila`; só envia se mudou (ou a cada 3 min, para provar que o computador está ativo). */
export function ligarPonteDaFila(): void {
  if (ponteLigada || typeof window === "undefined") return; ponteLigada = true;
  const enviar = () => {
    try {
      const bruto = document.documentElement.dataset.projudiFilaResumo; if (!bruto) return;
      const agora = Date.now(); if (bruto === ultimoTexto && agora - ultimoEnvio < 180_000) return; if (agora - ultimoEnvio < 15_000) return;
      ultimoTexto = bruto; ultimoEnvio = agora;
      void json("/api/fila/resumo", { resumo: JSON.parse(bruto) }).catch(() => { ultimoTexto = ""; });
    } catch { /* ignora */ }
  };
  window.addEventListener("projudi:fila", enviar); setInterval(enviar, 20_000); setTimeout(enviar, 5000);
  // comandos do celular: só o Studio do COMPUTADOR (o que tem a extensão) busca os pendentes e os entrega à extensão; o resultado volta pelo mesmo caminho
  const buscarComandos = () => {
    try {
      if (!document.documentElement.dataset.assessorExtensao || document.documentElement.dataset.projudiFilaComandos) return;
      void json("/api/fila/comandos/pendentes").then((j) => { if (Array.isArray(j.comandos) && j.comandos.length) { document.documentElement.dataset.projudiFilaComandos = JSON.stringify(j.comandos); window.dispatchEvent(new Event("projudi:fila-comandos")); } }).catch(() => {});
    } catch { /* ignora */ }
  };
  window.addEventListener("projudi:fila-resultado", () => {
    try {
      const lista = JSON.parse(document.documentElement.dataset.projudiFilaResultado || "[]"); if (!Array.isArray(lista) || !lista.length) return;
      void json("/api/fila/comandos/resultado", { resultados: lista }).then(() => { document.documentElement.dataset.projudiFilaResultadoAck = JSON.stringify(lista.map((r: any) => r.id)); window.dispatchEvent(new Event("projudi:fila-resultado-ok")); }).catch(() => {});
    } catch { /* ignora */ }
  });
  setInterval(buscarComandos, 12_000); setTimeout(buscarComandos, 6000);
}

// ---------- avisos deste aparelho ----------
export const suportaAvisos = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64ParaBytes = (b: string) => { const p = "=".repeat((4 - (b.length % 4)) % 4), s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export async function registrarServiceWorker() { if (!("serviceWorker" in navigator)) return null; try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; } }
export async function avisosAtivosNesteAparelho(): Promise<boolean> {
  if (!suportaAvisos()) return false; try { const reg = await navigator.serviceWorker.getRegistration(); return !!(reg && (await reg.pushManager.getSubscription())) && Notification.permission === "granted"; } catch { return false; }
}
/** Pede permissão (só em resposta a um clique), assina o aparelho e cadastra no servidor. */
export async function ativarAvisos(): Promise<void> {
  if (!suportaAvisos()) throw new Error("Este navegador não suporta avisos. No iPhone, use “Adicionar à Tela de Início” e abra o app por lá.");
  const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("A permissão para avisos foi negada. Libere nas configurações do navegador para este site.");
  const reg = (await registrarServiceWorker()) || (await navigator.serviceWorker.ready); await navigator.serviceWorker.ready;
  const { chave } = await json("/api/fila/push/chave");
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(chave) }));
  await json("/api/fila/push/assinar", { assinatura: sub.toJSON() });
}
export async function desativarAvisos(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); if (!sub) return;
  await json("/api/fila/push/remover", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe();
}
