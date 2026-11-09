// Envia ao servidor (painel "Saúde do sistema") eventos que só o navegador sabe: retomadas automáticas, adiamento de atualização
// e erros da EXTENSÃO (a extensão deixa os eventos numa fila e o app os recolhe pela ponte abaixo). Melhor esforço: nunca atrapalha o uso.
import { getApiHeaders } from "./apiKeyManager";

export interface EventoCliente { tipo: "retomada" | "extensao" | "cliente" | "versao"; modulo: string; severidade: "info" | "aviso" | "erro"; mensagem: string; detalhe?: Record<string, unknown>; duracaoMs?: number }
let fila: EventoCliente[] = [], timer: ReturnType<typeof setTimeout> | null = null, enviados = 0;
const ultimoPorMensagem = new Map<string, number>();

async function esvaziar(): Promise<void> {
  timer = null;
  while (fila.length) {
    const lote = fila.splice(0, 20);
    try { await fetch("/api/saude/evento", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }) as any, body: JSON.stringify({ eventos: lote }) }); } catch { /* sem rede: descarta */ }
  }
}
/** Informa um evento. Repetições da mesma mensagem dentro de 1 hora são ignoradas (exceto `sempre`). */
export function reportarSaude(e: EventoCliente, sempre = false): void {
  try {
    if (enviados >= 100) return;
    const chave = `${e.tipo}|${e.modulo}|${e.mensagem}`, agora = Date.now();
    if (!sempre && agora - (ultimoPorMensagem.get(chave) || 0) < 3_600_000) return;
    ultimoPorMensagem.set(chave, agora); enviados++; fila.push(e);
    if (!timer) timer = setTimeout(() => { void esvaziar(); }, 3000);
  } catch { /* nunca atrapalha */ }
}

/** Presença da extensão (uma vez por dia e por versão): a extensão deixa a versão em `data-assessor-extensao`; o painel Calibragem → Extensão mostra quem está desatualizado. */
function informarPresenca(): void {
  const versao = document.documentElement.dataset.assessorExtensao; if (!versao || !/^\d+(\.\d+)*$/.test(versao)) return;
  const chave = `ext_presenca_${new Date().toISOString().slice(0, 10)}_${versao}`;
  try { if (localStorage.getItem(chave)) return; localStorage.setItem(chave, "1"); } catch { /* sem armazenamento: informa mesmo assim (reportarSaude limita a 1 por hora) */ }
  reportarSaude({ tipo: "extensao", modulo: "presenca", severidade: "info", mensagem: `[v${versao}] extensão ativa`, detalhe: { versao } }, true);
}

let ponteLigada = false;
/** Ponte com a extensão: o script da extensão deixa os eventos em `data-projudi-saude-fila` e avisa com o evento `projudi:saude`; o app envia e confirma em `data-projudi-saude-ack`. */
export function ligarPonteDaExtensao(): void {
  if (ponteLigada || typeof window === "undefined") return; ponteLigada = true;
  const recolher = () => {
    try { informarPresenca(); } catch { /* ignora */ }
    try {
      const el = document.documentElement, bruto = el.dataset.projudiSaudeFila; if (!bruto) return;
      const lista: any[] = JSON.parse(bruto); if (!Array.isArray(lista) || !lista.length) return;
      const ids: string[] = [];
      for (const x of lista.slice(0, 40)) { ids.push(String(x.id || "")); reportarSaude({ tipo: "extensao", modulo: String(x.modulo || "extensao").slice(0, 60), severidade: x.severidade === "erro" || x.severidade === "info" ? x.severidade : "aviso", mensagem: `[v${String(x.versao || "?")}] ${String(x.mensagem || "")}`.slice(0, 500), detalhe: x.detalhe && typeof x.detalhe === "object" ? x.detalhe : undefined }, true); }
      el.dataset.projudiSaudeAck = JSON.stringify(ids); delete el.dataset.projudiSaudeFila;
    } catch { /* ignora */ }
  };
  window.addEventListener("projudi:saude", recolher); setInterval(recolher, 15000); setTimeout(recolher, 4000);
}
