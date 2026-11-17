// Envio para a calibragem pelo próprio usuário (assessor/juiz): ao MARCAR COMO LANÇADO ou ao EXCLUIR uma minuta, o sistema oferece enviar ao administrador
// (1) a minuta que o usuário cadastrou no Projudi (lida pela extensão Conclusões Projudi, só leitura) e (2) a minuta que o sistema gerou, para comparar erros e acertos.
// Só envia se a minuta lançada for MESMO lida no Projudi. Qualquer falha termina sem enviar, e o que o usuário estava fazendo (marcar ou excluir) segue normalmente.
import { buscarMinutaLancada, estadoDaExtensaoParaMinutaLancada, extensaoTemSeletorDeServentia, textoCompletoDaMinuta } from "./minutaLancada";
import { compararMinutas, textoDeHtml } from "./compararMinutas";
import type { SavedAnalysis } from "../types";

export type ModoCalibragem = "lancado" | "excluir";
export type Desfecho = "continuar" | "cancelar";
export interface PedidoCalibragem { modo: ModoCalibragem; analysisId: string; processo: string; ato: string; promptTitulo: string; motor: string; cabecalho: string; textoGerado: string }
export type ResultadoEnvio =
  | { status: "enviado" }
  | { status: "extensao-ausente" | "extensao-antiga" | "sem-minuta" | "cancelado" }
  | { status: "erro"; mensagem: string };

const CHAVE = "calib_enviada_";
export const jaEnviouCalibragem = (id: string): boolean => { try { return !!localStorage.getItem(CHAVE + id); } catch { return false; } };
export const marcarCalibragemEnviada = (id: string): void => { try { localStorage.setItem(CHAVE + id, String(Date.now())); } catch { /* sem armazenamento */ } };

/** Dados do pedido a partir de um ato do Histórico/resultado. Sem minuta com texto, devolve null (não há o que enviar). */
export function pedidoDeAto(a: Pick<SavedAnalysis, "id" | "processNumber" | "promptTitle" | "result"> & { originalMinute?: any }, modo: ModoCalibragem): PedidoCalibragem | null {
  // o que o SISTEMA gerou (a versão original, antes de o usuário editar); sem ela, a minuta atual
  const m: any = (a?.result as any)?.originalMinute || a?.originalMinute || a?.result?.minute; if (!m) return null;
  const texto = textoCompletoDaMinuta(m);
  if (texto.replace(/\s+/g, " ").trim().length < 50) return null;
  const processo = String(a.processNumber || m.processNumber || "").trim(); if (!processo) return null;
  return { modo, analysisId: String(a.id || ""), processo, ato: String((a.result as any)?.actType || m.title || "").slice(0, 30), promptTitulo: String(a.promptTitle || "").slice(0, 120), motor: String((a.result as any)?.motor || "principal"), cabecalho: String(m.header || ""), textoGerado: texto };
}

/** Lê a minuta no Projudi (pela extensão) e, só se vier texto de verdade, compara e envia. Nunca lança. */
export async function lerEEnviar(p: PedidoCalibragem, aoProgresso?: (t: string) => void, sinal?: AbortSignal, serventiaUrl?: string): Promise<ResultadoEnvio> {
  try {
    const est = estadoDaExtensaoParaMinutaLancada();
    if (est === "sem-extensao") return { status: "extensao-ausente" };
    if (est === "antiga" || !extensaoTemSeletorDeServentia()) return { status: "extensao-antiga" };      // o envio exige a extensão 3.0.10+ (leitura correta e escolha da serventia)
    const r = await buscarMinutaLancada(p.processo, aoProgresso, sinal, ((p.cabecalho || "") + "\n" + p.textoGerado).slice(0, 1500), serventiaUrl);
    if (sinal?.aborted) return { status: "cancelado" };
    if (!r.ok) return /pré-an[aá]lise.*(n[aã]o abriu|n[aã]o achei)|n[aã]o achei o editor|n[aã]o apareceu na lista|n[aã]o achei o bot[aã]o|conclusos/i.test(r.erro || "") ? { status: "sem-minuta" } : { status: "erro", mensagem: r.erro || "Não consegui ler a minuta no Projudi." };
    const texto = textoDeHtml(r.html || "");
    if (texto.replace(/\s+/g, " ").length < 120) return { status: "sem-minuta" };
    const c = compararMinutas(p.textoGerado, texto);
    const mudancas = c.blocos.filter((b) => b.tipo !== "igual").slice(0, 80).map((b) => ({ tipo: b.tipo, secao: b.secao, original: b.original, lancado: b.lancado }));
    const resp = await fetch("/api/comparacoes-minuta/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processo: p.processo, ato: p.ato, promptTitulo: p.promptTitulo, motor: p.motor, analysisId: p.analysisId, motivo: p.modo, ...c, blocos: undefined, mudancas, textoLancado: texto, textoGerado: p.textoGerado }) });
    if (!resp.ok) { let j: any = {}; try { j = await resp.json(); } catch { /* sem corpo */ } return { status: "erro", mensagem: j?.erro || `o servidor recusou (${resp.status})` }; }
    if (p.analysisId) marcarCalibragemEnviada(p.analysisId);
    return { status: "enviado" };
  } catch (e: any) { return { status: "erro", mensagem: String(e?.message || e) }; }
}

// ---- chave geral (ligada/desligada pelo Super Admin; começa desligada) ----
let chave: { ativo: boolean; t: number } | null = null;
export const esquecerChaveCalibragem = () => { chave = null; };
/** Se o pedido de envio está ligado. Guarda a resposta por 60 s; sem resposta do servidor = desligado (nunca atrapalha o usuário). */
export async function envioDeCalibragemAtivo(): Promise<boolean> {
  if (chave && Date.now() - chave.t < 60_000) return chave.ativo;
  let ativo = false;
  try { const r = await fetch("/api/comparacoes-minuta/config"); if (r.ok) ativo = (await r.json())?.ativo === true; } catch { ativo = false; }
  chave = { ativo, t: Date.now() }; return ativo;
}

// ---- janela (CalibragemEnvioHost) ----
const EVENTO = "assessor:calibragem-pedir";
let hospedeiro = 0, fila: Promise<unknown> = Promise.resolve();
export const registrarHospedeiroCalibragem = (): (() => void) => { hospedeiro++; return () => { hospedeiro = Math.max(0, hospedeiro - 1); }; };
export interface DetalheEvento { pedido: PedidoCalibragem; resolver: (d: Desfecho) => void }
export const NOME_EVENTO_CALIBRAGEM = EVENTO;

/** Mostra a janela e espera a escolha. "continuar" = faça o que o usuário queria (marcar/excluir); "cancelar" = não faça nada.
 *  Sem janela montada, sem minuta, ou se este ato já foi enviado: "continuar" na hora (nunca trava o fluxo). */
export function pedirEnvioCalibragem(pedido: PedidoCalibragem | null): Promise<Desfecho> {
  if (!pedido || !hospedeiro || (pedido.analysisId && jaEnviouCalibragem(pedido.analysisId))) return Promise.resolve("continuar");
  const vez = fila.then(async () => {
    if (!(await envioDeCalibragemAtivo())) return "continuar" as Desfecho;      // chave desligada pelo administrador: não pergunta nada
    return new Promise<Desfecho>((resolver) => { window.dispatchEvent(new CustomEvent<DetalheEvento>(EVENTO, { detail: { pedido, resolver } })); });
  });
  fila = vez.catch(() => undefined);
  return vez;
}
