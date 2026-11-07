// Regras PURAS do painel "Saúde do sistema" (sem banco, sem rede): usadas pelo servidor e pela tela, e testadas sozinhas.
export type TipoSaude = "servidor" | "banco" | "ia" | "retomada" | "extensao" | "cliente" | "sistema" | "versao";
export type SeveridadeSaude = "info" | "aviso" | "erro";
export interface EventoSaudeBase { ts: number; tipo: TipoSaude | string; modulo: string; severidade: SeveridadeSaude; assinatura: string; mensagem: string; email?: string }

export const RETENCAO_DIAS = 30;
export const AVISOS_DIAS = [7, 3, 1] as const;
const DIA = 86_400_000;

/** Tira o que identifica pessoas e processos antes de gravar. */
export function mascararTexto(t: unknown, max = 500): string {
  return String(t ?? "")
    .replace(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g, "[processo]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(AIza[\w-]{10,}|sk-[\w-]{10,}|Bearer\s+[\w.-]{10,})/g, "[chave]")
    .replace(/\s+/g, " ").trim().slice(0, max);
}

/** Texto "sem variações" (números, ids, horários) para agrupar erros iguais numa mesma linha. */
export function normalizarParaAssinatura(m: string): string {
  return String(m || "").toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#id")
    .replace(/\b[0-9a-f]{16,}\b/g, "#id").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Dias que faltam para o evento mais antigo ser apagado (negativo = já venceu). */
export const diasRestantes = (ts: number, agora = Date.now()): number => RETENCAO_DIAS - (agora - ts) / DIA;

/** Aviso de 7, 3 ou 1 dia: devolve o MENOR nível atingido pelo registro mais antigo (null = ainda longe). */
export function nivelDeAviso(maisAntigoTs: number | null | undefined, agora = Date.now()): 7 | 3 | 1 | null {
  if (!maisAntigoTs) return null;
  const r = diasRestantes(maisAntigoTs, agora);
  if (r <= 1) return 1; if (r <= 3) return 3; if (r <= 7) return 7; return null;
}
/** Quantos registros caem em cada faixa de aviso (faltam ≤7, ≤3, ≤1 dia). */
export function contarExpiracoes(tss: number[], agora = Date.now()): { d7: number; d3: number; d1: number } {
  let d7 = 0, d3 = 0, d1 = 0;
  for (const t of tss) { const r = diasRestantes(t, agora); if (r <= 7) d7++; if (r <= 3) d3++; if (r <= 1) d1++; }
  return { d7, d3, d1 };
}

export interface GrupoSaude { assinatura: string; tipo: string; modulo: string; severidade: SeveridadeSaude; mensagem: string; total: number; ultimaHora: number; primeiro: number; ultimo: number; usuarios: number; tendencia: "subindo" | "estavel" | "caindo" }
const PESO: Record<string, number> = { info: 0, aviso: 1, erro: 2 };

/** Agrupa eventos iguais (mesma assinatura) com contagem, usuários e tendência (metade recente x metade antiga da janela). */
export function agruparEventos(eventos: EventoSaudeBase[], janelaMs: number, agora = Date.now()): GrupoSaude[] {
  const m = new Map<string, GrupoSaude & { _us: Set<string>; _rec: number; _ant: number }>();
  const meio = agora - janelaMs / 2;
  for (const e of eventos) {
    let g = m.get(e.assinatura);
    if (!g) { g = { assinatura: e.assinatura, tipo: String(e.tipo), modulo: e.modulo, severidade: e.severidade, mensagem: e.mensagem, total: 0, ultimaHora: 0, primeiro: e.ts, ultimo: e.ts, usuarios: 0, tendencia: "estavel", _us: new Set(), _rec: 0, _ant: 0 }; m.set(e.assinatura, g); }
    g.total++; if (e.ts >= agora - 3_600_000) g.ultimaHora++;
    if (e.ts >= g.ultimo) { g.ultimo = e.ts; g.mensagem = e.mensagem; } if (e.ts < g.primeiro) g.primeiro = e.ts;
    if (PESO[e.severidade] > PESO[g.severidade]) g.severidade = e.severidade;
    if (e.email) g._us.add(e.email); if (e.ts >= meio) g._rec++; else g._ant++;
  }
  return [...m.values()].map(({ _us, _rec, _ant, ...g }) => ({ ...g, usuarios: _us.size, tendencia: (_rec > _ant * 1.5 + 1 ? "subindo" : _ant > _rec * 1.5 + 1 ? "caindo" : "estavel") as GrupoSaude["tendencia"] }))
    .sort((a, b) => PESO[b.severidade] - PESO[a.severidade] || b.ultimaHora - a.ultimaHora || b.total - a.total);
}

export interface AlertaSaude { codigo: string; gravidade: "alta" | "atencao"; texto: string }
/** Alertas AUTOMÁTICOS: repetição do mesmo erro, reinícios, falhas de banco e excesso de recusas da IA. */
export function gerarAlertas(eventos: EventoSaudeBase[], agora = Date.now()): AlertaSaude[] {
  const out: AlertaSaude[] = [];
  const h1 = eventos.filter((e) => e.ts >= agora - 3_600_000), m15 = eventos.filter((e) => e.ts >= agora - 900_000);
  for (const g of agruparEventos(h1, 3_600_000, agora)) if (g.severidade !== "info" && g.total >= 5) out.push({ codigo: "erro_repetido", gravidade: g.severidade === "erro" ? "alta" : "atencao", texto: `O mesmo problema se repetiu ${g.total}x na última hora (${g.tipo}/${g.modulo}): ${g.mensagem}` });
  const reinicios = h1.filter((e) => e.tipo === "sistema" && /iniciado/i.test(e.mensagem)).length;
  if (reinicios >= 2) out.push({ codigo: "reinicios", gravidade: "alta", texto: `O servidor reiniciou ${reinicios}x na última hora (cada reinício perde os resultados em memória).` });
  const banco = m15.filter((e) => e.tipo === "banco" && e.severidade === "erro").length;
  if (banco >= 1) out.push({ codigo: "banco", gravidade: "alta", texto: `${banco} falha(s) do banco de dados nos últimos 15 minutos.` });
  const ia = h1.filter((e) => e.tipo === "ia" && e.severidade !== "info").length;
  if (ia >= 10) out.push({ codigo: "ia_recusas", gravidade: "atencao", texto: `A IA (Google) recusou ou demorou ${ia}x na última hora (cota 429, alta demanda 503 ou tempo esgotado).` });
  const sem = eventos.filter((e) => e.tipo === "extensao" && e.severidade === "erro" && e.ts >= agora - 3_600_000).length;
  if (sem >= 3) out.push({ codigo: "extensao_erros", gravidade: "atencao", texto: `A extensão reportou ${sem} erro(s) na última hora.` });
  return out;
}

export type Semaforo = "verde" | "amarelo" | "vermelho";
/** Cor de cada tipo de evento: vermelho com erro recente, amarelo com avisos/erros mais antigos, verde sem nada. */
export function semaforoDoTipo(eventos: EventoSaudeBase[], tipo: string, agora = Date.now()): Semaforo {
  const t = eventos.filter((e) => e.tipo === tipo);
  if (t.some((e) => e.severidade === "erro" && e.ts >= agora - 3_600_000)) return "vermelho";
  if (t.some((e) => e.severidade === "erro" && e.ts >= agora - 86_400_000) || t.filter((e) => e.severidade === "aviso" && e.ts >= agora - 86_400_000).length >= 10) return "amarelo";
  return "verde";
}

/** Texto para colar no chat com o Claude, no mesmo padrão dos outros monitores. */
export function pedidoDeCorrecaoSaude(grupos: GrupoSaude[]): string {
  const q = (t: number) => new Date(t).toLocaleString("pt-BR");
  const itens = grupos.map((g, i) => `${i + 1}. [${g.severidade}] ${g.tipo}/${g.modulo} — ${g.total} ocorrência(s), ${g.usuarios} usuário(s), de ${q(g.primeiro)} a ${q(g.ultimo)} (tendência: ${g.tendencia}).\n   Mensagem: ${g.mensagem}`).join("\n");
  return `Claude, o painel "Saúde do sistema" do assessor-judicial apontou os problemas abaixo.\n\n${itens}\n\nInvestigue a causa de cada um, mostre o trecho exato que pretende alterar e espere minha autorização antes de mexer no código.`;
}
