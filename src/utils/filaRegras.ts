// Regras PURAS do acompanhamento da fila pelo celular (sem banco e sem rede): saneamento do resumo que a extensão envia, quando avisar e quando o computador "parou".
// O resumo tem SÓ números, estados e uma mensagem curta de erro (sem número de processo, sem texto de autos).
import { mascararTexto } from "./saudeRegras";

export interface ResumoFila {
  total: number; aguardando: number; analisando: number; concluidos: number; erros: number; pausados: number;
  modo: string; ia: string; pausa: string; ultimoErro: string; versao: string; geradoEm: number;
}
export type TipoAviso = "concluida" | "erro" | "pausa" | "parou";
export interface AvisoFila { tipo: TipoAviso; titulo: string; corpo: string }
export const MINUTOS_SEM_SINAL = 15;

const n = (v: unknown, max = 100000) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const t = (v: unknown, max: number) => mascararTexto(v, max);

/** Aceita só os campos esperados, com limites (o navegador pode mandar qualquer coisa). */
export function sanearResumo(b: any, agora = Date.now()): ResumoFila {
  return { total: n(b?.total), aguardando: n(b?.aguardando), analisando: n(b?.analisando), concluidos: n(b?.concluidos), erros: n(b?.erros), pausados: n(b?.pausados),
    modo: t(b?.modo, 20), ia: t(b?.ia, 30), pausa: t(b?.pausa, 160), ultimoErro: t(b?.ultimoErro, 200), versao: /^\d+(\.\d+)*$/.test(String(b?.versao || "")) ? String(b.versao) : "", geradoEm: agora };
}
export const pendentes = (r: Pick<ResumoFila, "aguardando" | "analisando" | "pausados">) => r.aguardando + r.analisando + r.pausados;

/** Compara o resumo anterior com o novo e diz o que merece aviso. Só avisa mudança (nunca repete o mesmo estado). */
export function detectarAvisos(antes: ResumoFila | null, agora: ResumoFila): AvisoFila[] {
  const out: AvisoFila[] = [];
  if (antes && pendentes(antes) > 0 && pendentes(agora) === 0 && agora.total > 0)
    out.push({ tipo: "concluida", titulo: "Fila concluída", corpo: `${agora.concluidos} concluído(s)${agora.erros ? `, ${agora.erros} com erro` : ""}. Confira no Studio.` });
  if (antes && agora.erros > antes.erros) out.push({ tipo: "erro", titulo: "Um processo parou com erro", corpo: agora.ultimoErro || "Veja o motivo na esteira da extensão." });
  if (agora.pausa && agora.pausa !== (antes?.pausa || "")) out.push({ tipo: "pausa", titulo: "A fila precisa de você", corpo: agora.pausa });
  return out;
}
/** O computador "parou de responder": há trabalho pendente e nenhum sinal da extensão há mais de MINUTOS_SEM_SINAL. */
export const computadorSemSinal = (r: ResumoFila, ultimoSinal: number, agora = Date.now()) => pendentes(r) > 0 && agora - ultimoSinal > MINUTOS_SEM_SINAL * 60_000;
export const computadorOnline = (ultimoSinal: number, agora = Date.now()) => !!ultimoSinal && agora - ultimoSinal <= 5 * 60_000;
