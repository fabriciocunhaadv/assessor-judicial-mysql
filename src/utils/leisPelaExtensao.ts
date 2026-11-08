// Ponte com a extensão Conclusões Projudi para a Central de fontes oficiais: o Planalto bloqueia o servidor, mas não o navegador do Super Admin.
// O app pede as leis por um atributo da página (+ evento); a extensão busca no navegador e devolve UMA lei por vez no atributo `data-projudi-lei-entrega`.
export interface LeiPedida { id: string; nome: string; url: string }
export interface EntregaLei { pedidoId: string; id: string; nome: string; bytes: Uint8Array }
export interface ResultadoSiteNavegador { id: string; status: number; tipo?: string; bytes?: number; ms?: number; amostra?: string; linhas?: number; bloqueio?: string; erro?: string; urlFinal?: string }
export interface FimDaBusca { pedidoId?: string; modo?: "leis" | "teste"; feitas?: number; falhas?: number; bloqueios?: number; erro?: string }

/** A extensão deixa a versão instalada num atributo da página (a mesma tarja “extensão instalada”). */
export const versaoDaExtensao = (): string => { try { return document.documentElement.dataset.assessorExtensao || ""; } catch { return ""; } };
/** A busca de leis precisa da versão 1.0.88 ou mais nova. */
export const extensaoSabeBuscarLeis = (v = versaoDaExtensao()): boolean => {
  const p = v.split(".").map((x) => parseInt(x, 10) || 0);
  return p.length >= 3 && (p[0] > 1 || (p[0] === 1 && (p[1] > 0 || p[2] >= 88)));
};

export function b64ParaBytes(b64: string): Uint8Array { const bin = atob(b64), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }

/** O teste de acesso pelo navegador precisa da extensão 1.0.89 ou mais nova. */
export const extensaoSabeTestarSites = (v = versaoDaExtensao()): boolean => { const p = v.split(".").map((x) => parseInt(x, 10) || 0); return p.length >= 3 && (p[0] > 1 || (p[0] === 1 && (p[1] > 0 || p[2] >= 89))); };

export function pedirLeisPelaExtensao(leis: LeiPedida[], modo: "leis" | "teste" = "leis"): string {
  const pedidoId = `${modo}-${Date.now().toString(36)}`;
  document.documentElement.dataset.projudiLeisPedido = JSON.stringify({ pedidoId, modo, leis: leis.map((l) => ({ id: l.id, nome: l.nome, url: l.url })) });
  window.dispatchEvent(new Event("projudi:leis-pedido"));
  return pedidoId;
}

/** Ouve as entregas da extensão. Cada lei é lida do atributo (que é limpo na hora, liberando a próxima) e tratada em fila, uma de cada vez. */
export function ligarEntregasDeLeis(aoEntrega: (e: EntregaLei) => Promise<void>, aoFim: (f: FimDaBusca) => void, aoTeste?: (r: ResultadoSiteNavegador) => void): () => void {
  let cadeia: Promise<void> = Promise.resolve();
  const lerEntrega = () => {
    const el = document.documentElement, bruto = el.dataset.projudiLeiEntrega; if (!bruto) return;
    delete el.dataset.projudiLeiEntrega;
    try { const j = JSON.parse(bruto); const bytes = b64ParaBytes(String(j.b64 || "")); cadeia = cadeia.then(() => aoEntrega({ pedidoId: String(j.pedidoId || ""), id: String(j.id || ""), nome: String(j.nome || ""), bytes })).catch(() => {}); } catch { /* entrega inválida */ }
  };
  const lerFim = () => {
    const el = document.documentElement, bruto = el.dataset.projudiLeisFim; if (!bruto) return;
    try { if (JSON.parse(bruto)?.modo === "fonte") return; } catch { /* segue */ }      // o fim da busca de fontes pendentes é lido pela aba "Fontes pendentes"
    delete el.dataset.projudiLeisFim;
    try { const f = JSON.parse(bruto); cadeia = cadeia.then(() => aoFim(f)); } catch { /* fim inválido */ }
  };
  const lerTeste = () => {      // resultado de UM site do teste de acesso
    const el = document.documentElement, bruto = el.dataset.projudiTesteEntrega; if (!bruto) return;
    delete el.dataset.projudiTesteEntrega;
    try { const j = JSON.parse(bruto); if (j?.resultado?.id) aoTeste?.(j.resultado as ResultadoSiteNavegador); } catch { /* resultado inválido */ }
  };
  window.addEventListener("projudi:teste-entrega", lerTeste);
  window.addEventListener("projudi:lei-entrega", lerEntrega); window.addEventListener("projudi:leis-fim", lerFim);
  return () => { window.removeEventListener("projudi:teste-entrega", lerTeste); window.removeEventListener("projudi:lei-entrega", lerEntrega); window.removeEventListener("projudi:leis-fim", lerFim); };
}

// ---------- fontes pendentes (leis que os autos citam e o Studio não tem): a extensão procura e devolve uma por vez ----------
export interface ItemParaBuscar { id: string; rotulo: string; tipo: string; esfera: string; ente: string; numero: string; ano: number }
export interface EntregaFonte { pedidoId: string; id: string; nome: string; contentType: string; url: string; bytes?: Uint8Array; erro?: string; tentativas?: string[] }
/** A busca de fontes pendentes precisa da extensão 1.0.90 ou mais nova. */
export const extensaoSabeBuscarFontes = (v = versaoDaExtensao()): boolean => { const p = v.split(".").map((x) => parseInt(x, 10) || 0); return p.length >= 3 && (p[0] > 1 || (p[0] === 1 && (p[1] > 0 || p[2] >= 90))); };
export function pedirFontesPelaExtensao(itens: ItemParaBuscar[], fontesBusca: { id: string; nome: string; esfera: string; ente: string; url: string; ativa: boolean }[]): string {
  const pedidoId = `fonte-${Date.now().toString(36)}`;
  document.documentElement.dataset.projudiLeisPedido = JSON.stringify({ pedidoId, modo: "fonte", leis: itens, fontesBusca });
  window.dispatchEvent(new Event("projudi:leis-pedido"));
  return pedidoId;
}
/** Ouve as entregas da busca de fontes. Cada uma é lida do atributo na hora (liberando a próxima) e tratada em fila. Devolve a função que desliga. */
export function ligarEntregasDeFontes(aoEntrega: (e: EntregaFonte) => Promise<void>, aoFim: (f: FimDaBusca) => void): () => void {
  let cadeia: Promise<void> = Promise.resolve();
  const lerEntrega = () => {
    const el = document.documentElement, bruto = el.dataset.projudiFonteEntrega; if (!bruto) return;
    delete el.dataset.projudiFonteEntrega;
    try { const j = JSON.parse(bruto); const e: EntregaFonte = { pedidoId: String(j.pedidoId || ""), id: String(j.id || ""), nome: String(j.nome || ""), contentType: String(j.contentType || ""), url: String(j.url || ""), bytes: j.b64 ? b64ParaBytes(String(j.b64)) : undefined, erro: j.erro ? String(j.erro) : undefined, tentativas: Array.isArray(j.tentativas) ? j.tentativas.map(String) : undefined }; cadeia = cadeia.then(() => aoEntrega(e)).catch(() => {}); } catch { /* entrega inválida */ }
  };
  const lerFim = () => {
    const el = document.documentElement, bruto = el.dataset.projudiLeisFim; if (!bruto) return;
    try { const f = JSON.parse(bruto); if (f?.modo !== "fonte") return; delete el.dataset.projudiLeisFim; cadeia = cadeia.then(() => aoFim(f)); } catch { /* fim inválido */ }
  };
  window.addEventListener("projudi:fonte-entrega", lerEntrega); window.addEventListener("projudi:leis-fim", lerFim);
  lerEntrega();      // algo que chegou enquanto a aba estava fechada
  return () => { window.removeEventListener("projudi:fonte-entrega", lerEntrega); window.removeEventListener("projudi:leis-fim", lerFim); };
}
