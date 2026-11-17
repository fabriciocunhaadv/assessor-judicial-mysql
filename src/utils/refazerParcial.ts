// “Refazer só com alguns eventos” (minuta do motor principal): o assessor escolhe, no Projudi, só as movimentações que importam e o Studio gera uma NOVA versão da minuta.
// Caminho: botão na minuta → extensão (4.0.0+) abre o Projudi na serventia/processo e na janela “Gerar PDF” → o assessor marca e devolve → download/OCR → esteira → análise normal no Studio,
// gravada no Histórico como versão 2 (ligada à minuta de origem, com a faixa de movimentações usada).
import { origemDoAto } from "./origemDaMinuta";

export const extensaoTemRefazerParcial = (): boolean => (document.documentElement.dataset.assessorExtensaoRecursos || "").split(",").includes("refazer-parcial");
export const extensaoInstalada = (): boolean => !!document.documentElement.dataset.assessorExtensao;

/** Só o motor principal tem o botão: nem Turbo, nem Gigante, nem minuta que veio pronta de fora (Agaia/colada) ou de vídeo. */
export function podeRefazerComPoucosEventos(ato: any): boolean {
  if (!ato) return false;
  const o = origemDoAto(ato);
  if (o.tipo !== "studio") return false;
  const m = String(ato?.result?.motor || "");
  return m !== "turbo" && m !== "gigante";
}

export interface FaixaMovimentos { min: number; max: number; n: number; arquivos: number }
export interface PedidoRefazer extends FaixaMovimentos { de: string; processo: string; t: number }

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
/** Lê o aviso que a extensão deixa na página durante a análise “refazer”. Só vale para o mesmo processo e se for recente (2 h). */
export function lerPedidoRefazer(bruto: string | undefined, processo: string, agora = Date.now()): PedidoRefazer | null {
  if (!bruto) return null;
  try {
    const p = JSON.parse(bruto);
    if (!p || typeof p.de !== "string" || !p.de || agora - Number(p.t || 0) > 2 * 3600_000) return null;
    const a = digitos(p.processo), b = digitos(processo);
    if (a.length >= 7 && b.length >= 7 && a.slice(0, 7) !== b.slice(0, 7)) return null;      // a minuta é de outro processo: não é a refeita
    return { de: p.de, processo: String(p.processo || ""), t: Number(p.t) || agora, min: Math.max(0, +p.min || 0), max: Math.max(0, +p.max || 0), n: Math.max(0, +p.n || 0), arquivos: Math.max(0, +p.arquivos || 0) };
  } catch { return null; }
}

/** “movimentações 77 a 83 (7 marcadas)” — o texto do aviso que acompanha a nova versão. */
export function textoDaFaixa(f?: FaixaMovimentos | null): string {
  if (!f || !f.max) return "";
  const faixa = f.min === f.max ? `a movimentação ${f.min}` : `as movimentações ${f.min} a ${f.max}`;
  return `${faixa}${f.n > 1 ? ` (${f.n} marcadas${f.arquivos ? `, ${f.arquivos} arquivo(s)` : ""})` : ""}`;
}

export interface ResultadoRefazer { ok: boolean; texto?: string; erro?: string; precisaServentia?: boolean }
/** Nunca lança. Resolve quando a janela “Gerar PDF” do Projudi abriu (ok) ou quando algo falhou. */
export function pedirRefazerParcial(dados: { processo: string; de: string; prompt: string; serventiaUrl?: string }, aoProgresso?: (t: string) => void, sinal?: AbortSignal): Promise<ResultadoRefazer> {
  return new Promise((resolver) => {
    const reqId = "rf" + Date.now() + Math.random().toString(36).slice(2, 6);
    let fim = false;
    const terminar = (r: ResultadoRefazer) => { if (fim) return; fim = true; clearTimeout(t); window.removeEventListener("message", ouvir); resolver(r); };
    const t = setTimeout(() => terminar({ ok: false, erro: "A extensão não respondeu a tempo (o Projudi pode estar lento, sem login, ou a aba foi fechada)." }), 240_000);
    const ouvir = (ev: MessageEvent) => {
      const d = ev.data; if (ev.source !== window || !d || d.__projudiResp !== "refazer-parcial" || d.reqId !== reqId) return;
      if (d.tipo === "progresso") { aoProgresso?.(String(d.texto || "")); return; }
      if (d.tipo === "fim") terminar({ ok: !!d.ok, texto: d.ok ? String(d.texto || "") : undefined, erro: d.ok ? undefined : String(d.erro || "Falha na extensão."), precisaServentia: !!d.precisaServentia });
    };
    window.addEventListener("message", ouvir);
    sinal?.addEventListener("abort", () => terminar({ ok: false, erro: "Cancelado." }));
    window.postMessage({ __projudi: "refazer-parcial", fase: "iniciar", reqId, processo: dados.processo, de: dados.de, prompt: String(dados.prompt || "").slice(0, 300), serventiaUrl: dados.serventiaUrl || "" }, window.location.origin);
  });
}
