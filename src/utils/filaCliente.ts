// Fila no celular (lado do navegador): (1) leva ao servidor o resumo da fila que a extensão deixa na página; (2) liga/desliga os avisos deste aparelho (Web Push).
import { getApiHeaders } from "./apiKeyManager";
import { detectarAvisos, computadorSemSinal, type ResumoFila } from "./filaRegras";
import { reportarSaude } from "./saudeCliente";

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
/** Traduz o erro técnico do navegador em orientação para o usuário. */
export function explicarErroDeAvisos(e: any): string {
  const m = String(e?.message || e || ""), n = String(e?.name || "");
  if (/push service error|AbortError|Registration failed/i.test(m + n)) return "O celular não conseguiu se registrar no serviço de avisos do Google. Tente: (1) trocar entre Wi-Fi e dados móveis; (2) desligar VPN, DNS privado e bloqueador de anúncios; (3) atualizar o Chrome e o Google Play Services; (4) deixar data e hora em automático. Se continuar, use “Avisar só com o app aberto”, logo abaixo.";
  if (/NotAllowedError|permission|negad/i.test(m + n)) return "A permissão para avisos foi negada. Libere em Configurações do navegador → Notificações deste site.";
  if (/InvalidStateError/i.test(n)) return "Já existe um registro de avisos antigo neste aparelho. Desligue os avisos, feche o app e abra de novo.";
  if (/NetworkError|Failed to fetch|offline/i.test(m + n)) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return m || "Não consegui ligar os avisos.";
}
/** Diagnóstico curto (para o Super Admin ver na Saúde e para o usuário conferir). */
export async function diagnosticoDeAvisos(): Promise<string> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    return [`permissão=${typeof Notification !== "undefined" ? Notification.permission : "?"}`, `sw=${reg ? (reg.active ? "ativo" : "registrado") : "não"}`, `push=${"PushManager" in window ? "sim" : "não"}`, `online=${navigator.onLine}`, `app=${window.matchMedia?.("(display-mode: standalone)").matches ? "instalado" : "navegador"}`].join(" · ");
  } catch { return ""; }
}
/** Pede permissão (só em resposta a um clique), assina o aparelho e cadastra no servidor. O serviço de avisos do Google às vezes falha na 1ª vez: tenta até 3 vezes. */
export async function ativarAvisos(): Promise<void> {
  if (!suportaAvisos()) throw new Error("Este navegador não suporta avisos. No iPhone, use “Adicionar à Tela de Início” e abra o app por lá.");
  const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("A permissão para avisos foi negada. Libere nas configurações do navegador para este site.");
  const reg = (await registrarServiceWorker()) || (await navigator.serviceWorker.ready); await navigator.serviceWorker.ready;
  const { chave } = await json("/api/fila/push/chave");
  let sub = await reg.pushManager.getSubscription(), ultimo: any = null;
  for (let t = 0; !sub && t < 3; t++) {
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(chave) }); }
    catch (e) {
      ultimo = e; if (/InvalidStateError/i.test(String((e as any)?.name))) { try { await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* segue */ } }
      await new Promise((ok) => setTimeout(ok, 1500 * (t + 1)));
    }
  }
  if (!sub) { reportarSaude({ tipo: "cliente", modulo: "avisos", severidade: "aviso", mensagem: `Falha ao ligar avisos no celular: ${String((ultimo as any)?.message || ultimo).slice(0, 120)} (${await diagnosticoDeAvisos()})` }); throw ultimo || new Error("push service error"); }
  await json("/api/fila/push/assinar", { assinatura: sub.toJSON() });
}
export async function desativarAvisos(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); if (!sub) return;
  await json("/api/fila/push/remover", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe();
}

// ---------- avisos só com o app aberto (plano B quando o serviço de avisos do Google não funciona neste aparelho) ----------
const LS_LOCAL = "fila_avisos_locais";
export const avisosLocaisAtivos = (): boolean => { try { return localStorage.getItem(LS_LOCAL) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted"; } catch { return false; } };
export async function ativarAvisosLocais(): Promise<void> {
  if (typeof Notification === "undefined") throw new Error("Este navegador não mostra notificações.");
  const p = await Notification.requestPermission(); if (p !== "granted") throw new Error("A permissão para avisos foi negada. Libere em Configurações do navegador → Notificações deste site.");
  localStorage.setItem(LS_LOCAL, "1");
}
export const desativarAvisosLocais = () => { try { localStorage.removeItem(LS_LOCAL); } catch { /* ignora */ } };
const mostrar = async (titulo: string, corpo: string, tag: string) => {
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.showNotification(titulo, { body: corpo, tag, icon: "/icon-192.png", badge: "/icon-192.png" } as any); else new Notification(titulo, { body: corpo, tag }); } catch { /* sem permissão */ }
};
let localLigado = false, anteriorLocal: ResumoFila | null = null, avisouParou = false;
/** Com o app aberto (mesmo em segundo plano, enquanto o Android deixar), confere a fila a cada 30 s e mostra a notificação pelo próprio aparelho. Não depende do serviço de avisos do Google. */
export function ligarAvisosLocais(): void {
  if (localLigado || typeof window === "undefined") return; localLigado = true;
  setInterval(async () => {
    if (!avisosLocaisAtivos()) return;
    try {
      const m = await lerMinhaFila(), novo: ResumoFila | null = m.resumo; if (!novo || !novo.total) return;
      for (const a of detectarAvisos(anteriorLocal, novo)) if (m.prefs?.[a.tipo] !== false) await mostrar(a.titulo, a.corpo, a.tipo);
      if (computadorSemSinal(novo, m.ultimoSinal)) { if (!avisouParou && m.prefs?.parou !== false) { avisouParou = true; await mostrar("O computador parou de responder", "A fila tem processos pendentes e a extensão está sem sinal há mais de 15 minutos.", "parou"); } } else avisouParou = false;
      anteriorLocal = novo;
    } catch { /* sem rede: tenta no próximo ciclo */ }
  }, 30_000);
}
