// Ponte com a extensão Conclusões Projudi para a Central de fontes oficiais: o Planalto bloqueia o servidor, mas não o navegador do Super Admin.
// O app pede as leis por um atributo da página (+ evento); a extensão busca no navegador e devolve UMA lei por vez no atributo `data-projudi-lei-entrega`.
export interface LeiPedida { id: string; nome: string; url: string }
export interface EntregaLei { pedidoId: string; id: string; nome: string; bytes: Uint8Array }
export interface FimDaBusca { pedidoId?: string; feitas?: number; falhas?: number; bloqueios?: number; erro?: string }

/** A extensão deixa a versão instalada num atributo da página (a mesma tarja “extensão instalada”). */
export const versaoDaExtensao = (): string => { try { return document.documentElement.dataset.assessorExtensao || ""; } catch { return ""; } };
/** A busca de leis precisa da versão 1.0.88 ou mais nova. */
export const extensaoSabeBuscarLeis = (v = versaoDaExtensao()): boolean => {
  const p = v.split(".").map((x) => parseInt(x, 10) || 0);
  return p.length >= 3 && (p[0] > 1 || (p[0] === 1 && (p[1] > 0 || p[2] >= 88)));
};

export function b64ParaBytes(b64: string): Uint8Array { const bin = atob(b64), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }

export function pedirLeisPelaExtensao(leis: LeiPedida[]): string {
  const pedidoId = `leis-${Date.now().toString(36)}`;
  document.documentElement.dataset.projudiLeisPedido = JSON.stringify({ pedidoId, leis: leis.map((l) => ({ id: l.id, nome: l.nome, url: l.url })) });
  window.dispatchEvent(new Event("projudi:leis-pedido"));
  return pedidoId;
}

/** Ouve as entregas da extensão. Cada lei é lida do atributo (que é limpo na hora, liberando a próxima) e tratada em fila, uma de cada vez. */
export function ligarEntregasDeLeis(aoEntrega: (e: EntregaLei) => Promise<void>, aoFim: (f: FimDaBusca) => void): () => void {
  let cadeia: Promise<void> = Promise.resolve();
  const lerEntrega = () => {
    const el = document.documentElement, bruto = el.dataset.projudiLeiEntrega; if (!bruto) return;
    delete el.dataset.projudiLeiEntrega;
    try { const j = JSON.parse(bruto); const bytes = b64ParaBytes(String(j.b64 || "")); cadeia = cadeia.then(() => aoEntrega({ pedidoId: String(j.pedidoId || ""), id: String(j.id || ""), nome: String(j.nome || ""), bytes })).catch(() => {}); } catch { /* entrega inválida */ }
  };
  const lerFim = () => {
    const el = document.documentElement, bruto = el.dataset.projudiLeisFim; if (!bruto) return;
    delete el.dataset.projudiLeisFim;
    try { const f = JSON.parse(bruto); cadeia = cadeia.then(() => aoFim(f)); } catch { /* fim inválido */ }
  };
  window.addEventListener("projudi:lei-entrega", lerEntrega); window.addEventListener("projudi:leis-fim", lerFim);
  return () => { window.removeEventListener("projudi:lei-entrega", lerEntrega); window.removeEventListener("projudi:leis-fim", lerFim); };
}
