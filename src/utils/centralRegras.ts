// Regras PURAS da "Central de decisões" do Super Admin (sem banco, sem rede): o que precisa de atenção hoje e o status de cada erro agrupado.
// Só LÊ o que o sistema já registra; não altera nenhum motor.
import type { AlertaSaude, GrupoSaude } from "./saudeRegras";

export type StatusGrupo = "novo" | "investigando" | "resolvido" | "ignorado";
export type StatusEfetivo = StatusGrupo | "reincidente";
export interface EstadoGrupo { status: StatusGrupo; nota: string; ts: number; por?: string }
export const ROTULO_STATUS: Record<StatusEfetivo, string> = { novo: "Novo", investigando: "Em investigação", resolvido: "Resolvido", ignorado: "Ignorado", reincidente: "Voltou (reincidente)" };

/** Resolvido que voltou a acontecer depois da marcação vira "reincidente". Sem marcação = "novo". */
export function statusEfetivo(g: Pick<GrupoSaude, "ultimo">, e?: EstadoGrupo | null): StatusEfetivo {
  if (!e) return "novo";
  if (e.status === "resolvido" && g.ultimo > e.ts) return "reincidente";
  return e.status;
}
export const estaAberto = (s: StatusEfetivo) => s === "novo" || s === "reincidente" || s === "investigando";

export interface Decisao { chave: string; prioridade: 1 | 2 | 3; titulo: string; detalhe: string; acao: { tipo: "aba" | "grupo" | "fontes" | "exportar"; alvo?: string; rotulo: string } }
export interface EntradaCentral { grupos: (GrupoSaude & { estado?: EstadoGrupo | null })[]; alertas: AlertaSaude[]; fontesPendentes: number; nivelRetencao: 7 | 3 | 1 | null; dispensas: Record<string, number>; agora: number }

/** Lista ordenada do que precisa de você agora (o que foi dispensado some até a data marcada). */
export function montarDecisoes(x: EntradaCentral): Decisao[] {
  const out: Decisao[] = [];
  for (const a of x.alertas) out.push({ chave: "a:" + a.codigo, prioridade: a.gravidade === "alta" ? 1 : 2, titulo: a.texto, detalhe: "Alerta automático da Saúde do sistema.", acao: { tipo: "aba", alvo: "saude", rotulo: "Abrir Saúde" } });
  for (const g of x.grupos) {
    const s = statusEfetivo(g, g.estado); if (!(s === "novo" || s === "reincidente")) continue;
    if (g.severidade !== "erro" && !(g.total >= 10)) continue;
    out.push({ chave: "g:" + g.assinatura, prioridade: s === "reincidente" || g.ultimaHora > 0 ? 1 : 2, titulo: `${s === "reincidente" ? "Voltou: " : "Erro novo: "}${g.mensagem.slice(0, 140)}`, detalhe: `${g.tipo}/${g.modulo} · ${g.total} ocorrência(s) · ${g.usuarios} usuário(s)`, acao: { tipo: "grupo", alvo: g.assinatura, rotulo: "Ver e classificar" } });
  }
  if (x.fontesPendentes > 0) out.push({ chave: "f:pendentes", prioridade: 3, titulo: `${x.fontesPendentes} fonte(s) citada(s) pelos motores ainda fora da base`, detalhe: "Central de fontes → Fontes pendentes: incluir, buscar pela extensão ou ignorar.", acao: { tipo: "fontes", rotulo: "Entendi (esconder 7 dias)" } });
  if (x.nivelRetencao) out.push({ chave: "r:" + x.nivelRetencao, prioridade: x.nivelRetencao === 1 ? 1 : 3, titulo: `Os registros mais antigos serão apagados em até ${x.nivelRetencao} dia(s)`, detalhe: "Limpeza automática de 30 dias. Baixe o arquivo se quiser guardar.", acao: { tipo: "exportar", rotulo: "Baixar registros" } });
  return out.filter((d) => !(x.dispensas[d.chave] > x.agora)).sort((a, b) => a.prioridade - b.prioridade);
}

/** Texto para colar no chat com o Claude (só dos grupos escolhidos), com status e notas. */
export function pedidoDeCorrecaoCentral(gs: (GrupoSaude & { estado?: EstadoGrupo | null })[]): string {
  const q = (t: number) => new Date(t).toLocaleString("pt-BR");
  const itens = gs.map((g, i) => `${i + 1}. [${g.severidade}] ${g.tipo}/${g.modulo} — ${g.total} ocorrência(s), ${g.usuarios} usuário(s), de ${q(g.primeiro)} a ${q(g.ultimo)}; status: ${ROTULO_STATUS[statusEfetivo(g, g.estado)]}${g.estado?.nota ? `; minha nota: ${g.estado.nota}` : ""}\n   Mensagem: ${g.mensagem}`).join("\n");
  return `Claude, a Central de decisões do assessor-judicial apontou os erros abaixo.\n\n${itens}\n\nInvestigue a causa de cada um, mostre o trecho exato que pretende alterar e espere minha autorização antes de mexer no código.`;
}
