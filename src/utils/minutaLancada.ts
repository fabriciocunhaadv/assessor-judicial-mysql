// “Buscar minuta lançada” (só Super Admin): pede à extensão o texto que está salvo na pré-análise do Projudi (ponte window.postMessage, como "modelos" e "pdf-tratar").
// A extensão só LÊ o editor: não escolhe tipo nem modelo, não escreve e não salva nada no Projudi. Exige a extensão 3.0.6+ (recurso "minuta-lancada").
import type { MinuteData } from "../types";

export type EstadoExtensaoMinutaLancada = "ok" | "sem-extensao" | "antiga";
export const estadoDaExtensaoParaMinutaLancada = (): EstadoExtensaoMinutaLancada => {
  const d = document.documentElement.dataset;
  if (!d.assessorExtensao) return "sem-extensao";
  return (d.assessorExtensaoRecursos || "").split(",").includes("minuta-lancada") ? "ok" : "antiga";
};

export interface MinutaLancadaLida { ok: boolean; html?: string; tela?: string; erro?: string }

/** Nunca lança: falha vira { ok: false, erro }. */
export function buscarMinutaLancada(processo: string, aoProgresso?: (texto: string) => void, sinal?: AbortSignal): Promise<MinutaLancadaLida> {
  return new Promise((resolver) => {
    const reqId = "ml" + Date.now() + Math.random().toString(36).slice(2, 6);
    let fim = false;
    const terminar = (r: MinutaLancadaLida) => { if (fim) return; fim = true; clearTimeout(t); window.removeEventListener("message", ouvir); resolver(r); };
    const t = setTimeout(() => terminar({ ok: false, erro: "A extensão não respondeu a tempo (o Projudi pode estar lento, sem login, ou a aba foi fechada)." }), 240_000);
    const ouvir = (ev: MessageEvent) => {
      const d = ev.data; if (ev.source !== window || !d || d.__projudiResp !== "minuta-lancada" || d.reqId !== reqId) return;
      if (d.tipo === "progresso") { aoProgresso?.(String(d.texto || "")); return; }
      if (d.tipo === "fim") terminar({ ok: !!d.ok, html: String(d.html || ""), tela: String(d.tela || ""), erro: d.ok ? undefined : String(d.erro || "Falha na extensão.") });
    };
    window.addEventListener("message", ouvir);
    sinal?.addEventListener("abort", () => terminar({ ok: false, erro: "Cancelado." }));
    window.postMessage({ __projudi: "minuta-lancada", fase: "ler", reqId, processo }, window.location.origin);
  });
}

/** Texto completo da minuta como o Studio a gerou (o mesmo que o botão Copiar usa). */
export function textoCompletoDaMinuta(minute: MinuteData): string {
  if (minute.fullFormattedText && minute.fullFormattedText.trim().length > 0) return minute.fullFormattedText;
  const nl = (s: string) => s.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
  return [minute.header, minute.title, minute.relatorio ? `I - RELATÓRIO\n\n${nl(minute.relatorio)}` : "", minute.fundamentacao ? `II - FUNDAMENTAÇÃO\n\n${nl(minute.fundamentacao)}` : "", minute.dispositivo ? `III - DISPOSITIVO\n\n${nl(minute.dispositivo)}` : "", minute.closing ? nl(minute.closing) : ""].filter(Boolean).join("\n\n");
}
