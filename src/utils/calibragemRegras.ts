// Regras PURAS do painel de calibragem do Super Admin (motores, gabinetes, extensão). Sem banco e sem rede. SÓ LEEM e resumem dados: nenhum limite é alterado.

// ---------- Motores ----------
export const MOTORES = [
  { id: "analise", nome: "Análise (Gerar Minuta)", rotas: ["/api/generate-minute"], modulo: ["minuta"] },
  { id: "turbo", nome: "Análise Turbo", rotas: ["/api/generate-minute-turbo"], modulo: ["turbo"] },
  { id: "lupa", nome: "Lupa do Magistrado", rotas: ["/api/audit-assessor-draft"], modulo: ["lupa_magistrado"] },
  { id: "gigante", nome: "Processo Gigante", rotas: ["/api/gigante-lote", "/api/gigante-fusao"], modulo: [] },
  { id: "audiencia", nome: "Audiência (Copiloto)", rotas: ["/api/hearing-copilot"], modulo: ["audiencia", "copiloto"] },
  { id: "sinopse", nome: "Sinopse", rotas: ["/api/generate-synopsis"], modulo: [] },
] as const;
export const motorDaRota = (caminho: string): string | null => { const c = String(caminho || "").split("?")[0]; return MOTORES.find((m) => (m.rotas as readonly string[]).includes(c))?.id || null; };
export const motorDoModulo = (modulo: string): string | null => MOTORES.find((m) => (m.modulo as readonly string[]).includes(modulo))?.id || null;

/** Status que contam como "cota/sobrecarga da IA" (e não como erro do nosso servidor). */
export const ehCota = (status: number) => status === 429 || status === 503;
export const ehErro = (status: number) => status >= 500 && !ehCota(status);
export const HORA = 3_600_000;
export const horaDe = (ts: number) => Math.floor(ts / HORA) * HORA;

export interface LinhaMetrica { hora: number; motor: string; n: number; erros: number; cota: number; ms_total: number; ms_max: number; bytes_total: number; bytes_max: number }
export interface UsoIA { motor: string; tokens: number; custo: number; modelo: string }
export interface ResumoMotor {
  id: string; nome: string; n: number; erros: number; cota: number; taxaErro: number; taxaCota: number; mediaMs: number; maxMs: number; kbMedio: number; kbMax: number;
  execucoesIA: number; tokensMedios: number; custoTotal: number; modelos: { modelo: string; n: number }[]; porDia: { dia: string; n: number; erros: number; cota: number }[]; avisos: string[];
}
const diaBR = (ts: number) => new Date(ts - 3 * HORA).toISOString().slice(0, 10);

/** Junta métricas por hora + uso de IA em um quadro por motor, com avisos em português simples (limiares fixos: só informam). */
export function resumirMotores(linhas: LinhaMetrica[], usos: UsoIA[]): ResumoMotor[] {
  return MOTORES.map((m) => {
    const ls = linhas.filter((l) => l.motor === m.id), us = usos.filter((u) => u.motor === m.id);
    const n = ls.reduce((s, l) => s + l.n, 0), erros = ls.reduce((s, l) => s + l.erros, 0), cota = ls.reduce((s, l) => s + l.cota, 0);
    const ms = ls.reduce((s, l) => s + l.ms_total, 0), bytes = ls.reduce((s, l) => s + l.bytes_total, 0);
    const dias = new Map<string, { dia: string; n: number; erros: number; cota: number }>();
    for (const l of ls) { const d = diaBR(l.hora), x = dias.get(d) || { dia: d, n: 0, erros: 0, cota: 0 }; x.n += l.n; x.erros += l.erros; x.cota += l.cota; dias.set(d, x); }
    const mod = new Map<string, number>(); for (const u of us) mod.set(u.modelo || "(não informado)", (mod.get(u.modelo || "(não informado)") || 0) + 1);
    const r: ResumoMotor = { id: m.id, nome: m.nome, n, erros, cota, taxaErro: n ? erros / n : 0, taxaCota: n ? cota / n : 0, mediaMs: n ? Math.round(ms / n) : 0, maxMs: Math.max(0, ...ls.map((l) => l.ms_max)), kbMedio: n ? Math.round(bytes / n / 1024) : 0, kbMax: Math.round(Math.max(0, ...ls.map((l) => l.bytes_max)) / 1024),
      execucoesIA: us.length, tokensMedios: us.length ? Math.round(us.reduce((s, u) => s + u.tokens, 0) / us.length) : 0, custoTotal: us.reduce((s, u) => s + u.custo, 0),
      modelos: [...mod.entries()].map(([modelo, k]) => ({ modelo, n: k })).sort((a, b) => b.n - a.n).slice(0, 4), porDia: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)), avisos: [] };
    if (n >= 5 && r.taxaErro > 0.1) r.avisos.push(`Erros em ${Math.round(r.taxaErro * 100)}% dos pedidos (mais de 10%).`);
    if (n >= 5 && r.taxaCota > 0.15) r.avisos.push(`Cota/sobrecarga da IA em ${Math.round(r.taxaCota * 100)}% dos pedidos (mais de 15%).`);
    if (n >= 3 && r.mediaMs > 240_000) r.avisos.push(`Tempo médio alto: ${Math.round(r.mediaMs / 1000)}s por pedido.`);
    return r;
  });
}

// ---------- Gabinetes ----------
export const DIA = 86_400_000;
export interface FichaGabinete {
  id: string; nome: string; usuarios: { total: number; ativos30d: number; pendentes: number }; minutasSemana: number; motores: { modulo: string; n: number }[];
  chaves: { nativaLiberada: number; execNativa: number; execPropria: number }; ultimaAtividade: number; erros7d: number; ultimoErro: string; avisos: string[];
}
export const minutasPorSemana = (minutas28d: number) => Math.round((minutas28d / 4) * 10) / 10;
/** Avisos da ficha: abandono e excesso de erros (limiares fixos; só informam). */
export function avisosDoGabinete(f: Pick<FichaGabinete, "usuarios" | "ultimaAtividade" | "erros7d" | "chaves">, agora = Date.now()): string[] {
  const out: string[] = [];
  if (f.usuarios.total > 0 && !f.ultimaAtividade) out.push("Nunca usou o sistema.");
  else if (f.ultimaAtividade && agora - f.ultimaAtividade > 15 * DIA) out.push(`Sem uso há ${Math.floor((agora - f.ultimaAtividade) / DIA)} dias.`);
  if (f.erros7d >= 5) out.push(`${f.erros7d} erro(s) ligados a este gabinete nos últimos 7 dias.`);
  if (f.usuarios.pendentes > 0) out.push(`${f.usuarios.pendentes} usuário(s) aguardando aprovação.`);
  if (f.chaves.nativaLiberada > 0 && f.chaves.execNativa > 0 && f.chaves.execNativa >= 100) out.push(`Uso alto da chave nativa (${f.chaves.execNativa} execuções no período).`);
  return out;
}

// ---------- Extensão ----------
export interface EventoExt { ts: number; email: string; tenant: string; modulo: string; severidade: string; mensagem: string; assinatura: string; detalhe?: any }
/** "1.0.9" < "1.0.10". Inválida = 0. */
export function compararVersao(a: string, b: string): number {
  const p = (v: string) => String(v || "").replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0;
}
export const versaoDoEvento = (e: EventoExt): string => { const v = e.detalhe?.versao; if (typeof v === "string" && /^\d+(\.\d+)*$/.test(v)) return v; const m = /^\[v(\d+(?:\.\d+)*)\]/.exec(e.mensagem || ""); return m ? m[1] : ""; };

export interface UsuarioExt { email: string; versao: string; visto: number; desatualizado: boolean }
/** Versão mais recente informada por cada usuário e quem está atrás da versão mais nova vista. */
export function resumirVersoes(eventos: EventoExt[]): { atual: string; usuarios: UsuarioExt[]; porVersao: { versao: string; usuarios: number }[] } {
  const por = new Map<string, UsuarioExt>();
  for (const e of eventos) { const v = versaoDoEvento(e); if (!v || !e.email) continue; const u = por.get(e.email); if (!u || e.ts > u.visto || (e.ts === u.visto && compararVersao(v, u.versao) > 0)) por.set(e.email, { email: e.email, versao: v, visto: e.ts, desatualizado: false }); }
  const lista = [...por.values()]; let atual = ""; for (const u of lista) if (!atual || compararVersao(u.versao, atual) > 0) atual = u.versao;
  for (const u of lista) u.desatualizado = !!atual && compararVersao(u.versao, atual) < 0;
  const cont = new Map<string, number>(); for (const u of lista) cont.set(u.versao, (cont.get(u.versao) || 0) + 1);
  return { atual, usuarios: lista.sort((a, b) => Number(b.desatualizado) - Number(a.desatualizado) || b.visto - a.visto), porVersao: [...cont.entries()].map(([versao, usuarios]) => ({ versao, usuarios })).sort((a, b) => compararVersao(b.versao, a.versao)) };
}

export interface ResumoIA { ia: string; ok: number; falhas: number; taxaSucesso: number; ultimoErro: string; ultimoUso: number }
/** Sucesso por IA externa (ChatGPT, Gemini, Claude, Jusbrasil), a partir dos eventos "ia-externa" que a extensão informa. */
export function resumirIaExterna(eventos: EventoExt[]): ResumoIA[] {
  const m = new Map<string, ResumoIA & { _t: number }>();
  for (const e of eventos) {
    if (e.modulo !== "ia-externa") continue; const ia = String(e.detalhe?.ia || "").slice(0, 30); if (!ia) continue;
    const r = m.get(ia) || { ia, ok: 0, falhas: 0, taxaSucesso: 0, ultimoErro: "", ultimoUso: 0, _t: 0 };
    if (e.detalhe?.ok === true) r.ok++; else { r.falhas++; if (e.ts >= r._t) { r._t = e.ts; r.ultimoErro = e.mensagem; } }
    r.ultimoUso = Math.max(r.ultimoUso, e.ts); m.set(ia, r);
  }
  return [...m.values()].map(({ _t, ...r }) => ({ ...r, taxaSucesso: r.ok + r.falhas ? r.ok / (r.ok + r.falhas) : 0 })).sort((a, b) => b.ok + b.falhas - (a.ok + a.falhas));
}
