// Atualizar um modelo do Projudi a pedido do Studio: o app pede à extensão (ponte window.postMessage); ela relê o modelo no Projudi, na aba do próprio usuário,
// e devolve o texto atual. O app grava só se o texto mudou. Exige a extensão 2.0.10+ (recurso "modelos-atualizar") e o Projudi aberto e logado.
import { ModeloProjudi, receberModelosProjudi } from "./modelosProjudi";

export type EstadoExtensaoModelos = "ok" | "sem-extensao" | "antiga";
export const estadoDaExtensaoParaModelos = (): EstadoExtensaoModelos => {
  const d = document.documentElement.dataset;
  if (!d.assessorExtensao) return "sem-extensao";
  return (d.assessorExtensaoRecursos || "").split(",").includes("modelos-atualizar") ? "ok" : "antiga";
};

export interface ResultadoAtualizacao { estado: "atualizado" | "igual" | "erro"; erro?: string }

/** Relê UM modelo no Projudi pela extensão. Nunca lança: erro vira { estado: "erro", erro }. */
export function atualizarModeloPelaExtensao(m: ModeloProjudi, sinal?: AbortSignal): Promise<ResultadoAtualizacao> {
  return new Promise((ok) => {
    const reqId = "au" + Date.now() + Math.random().toString(36).slice(2, 6);
    let fim = false;
    const terminar = (r: ResultadoAtualizacao) => { if (fim) return; fim = true; clearTimeout(t); window.removeEventListener("message", ouvir); ok(r); };
    const t = setTimeout(() => terminar({ estado: "erro", erro: "A extensão não respondeu a tempo (o Projudi pode estar lento ou a aba foi fechada)." }), 150_000);
    const ouvir = (ev: MessageEvent) => {
      const d = ev.data; if (ev.source !== window || !d || d.__projudiResp !== "modelos" || d.reqId !== reqId) return;
      if (d.tipo === "erro") return terminar({ estado: "erro", erro: String(d.erro || "Falha na extensão.") });
      if (d.tipo === "ok-um" && d.item) receberModelosProjudi([d.item]).then((r) => terminar(r.gravados > 0 ? { estado: "atualizado" } : r.iguais > 0 ? { estado: "igual" } : { estado: "erro", erro: "O texto lido veio vazio." }), (e) => terminar({ estado: "erro", erro: String(e?.message || e) }));
    };
    window.addEventListener("message", ouvir);
    sinal?.addEventListener("abort", () => terminar({ estado: "erro", erro: "Cancelado." }));
    window.postMessage({ __projudi: "modelos", fase: "atualizar", reqId, item: { id: m.projudiId, nome: m.nome, tipo: m.tipo, serventia: m.serventia } }, window.location.origin);
  });
}
