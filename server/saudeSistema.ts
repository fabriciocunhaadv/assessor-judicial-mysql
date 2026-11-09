// SAÚDE DO SISTEMA (servidor): coletor único de eventos (erros do servidor, banco, IA, retomadas, extensão, versão) numa tabela própria do MySQL,
// com métricas por hora, alertas automáticos e limpeza sozinha depois de 30 dias. Gravar um evento NUNCA derruba nem atrasa o sistema:
// vai para uma fila em memória e é gravado em lote; se o banco falhar, o evento é descartado (a fila tem limite).
import express from "express";
import crypto from "node:crypto";
import { banco, garantirEsquema, definirAoErroBanco, definirAoRecuperarBanco } from "./historyRoutes";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { mascararTexto, normalizarParaAssinatura, agruparEventos, gerarAlertas, semaforoDoTipo, nivelDeAviso, contarExpiracoes, RETENCAO_DIAS, type EventoSaudeBase, type SeveridadeSaude } from "../src/utils/saudeRegras";

export const saudeRouter = express.Router();
export interface EventoSaude { tipo: string; modulo: string; severidade: SeveridadeSaude; mensagem: string; detalhe?: Record<string, unknown>; email?: string; tenant?: string; duracaoMs?: number }

const TIPOS = ["servidor", "banco", "ia", "retomada", "extensao", "cliente", "sistema", "versao"], SEVS = ["info", "aviso", "erro"];
const TIPOS_DO_CLIENTE = new Set(["retomada", "extensao", "cliente", "versao"]);      // o navegador só pode informar estes; "servidor/banco/ia/sistema" são só do próprio servidor
const DIA = 86_400_000;
let fila: any[] = [], esquema: Promise<void> | null = null;
const limitePorAssinatura = new Map<string, { janela: number; n: number }>();

const garantir = () => (esquema ||= (async () => {
  await garantirEsquema();
  await consulta(`CREATE TABLE IF NOT EXISTS saude_eventos (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, ts BIGINT NOT NULL, tipo VARCHAR(24) NOT NULL, modulo VARCHAR(80) NOT NULL DEFAULT '', severidade VARCHAR(8) NOT NULL,
    assinatura CHAR(40) NOT NULL, mensagem VARCHAR(600) NOT NULL, detalhe TEXT NULL, email VARCHAR(190) NOT NULL DEFAULT '', tenant VARCHAR(120) NOT NULL DEFAULT '', duracao_ms INT NOT NULL DEFAULT 0,
    KEY ix_saude_ts (ts), KEY ix_saude_assin (assinatura, ts), KEY ix_saude_tipo (tipo, ts)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquema = null; throw e; }));

/** Consulta SEM passar pelo gancho de erro do banco (senão uma falha do banco geraria evento, que falharia de novo, em laço). */
export const consultaSaude = (sql: string, params: any[] = []) => consulta(sql, params);
export const garantirSaude = () => garantir();
export const esvaziarFilaSaude = () => descarregar();
const limpadores: ((limite: number) => Promise<number>)[] = [];
/** Outros módulos registram aqui o que também deve ser limpo na rotina de 30 dias. */
export const aoLimparSaude = (f: (limite: number) => Promise<number>) => { limpadores.push(f); };
const consulta = async (sql: string, params: any[] = []): Promise<any> => { const b: any = banco(); return (b.__original ? b.__original(sql, params) : b.query(sql, params)); };

/** Registra um evento (síncrono e à prova de falhas). */
export function registrarSaude(e: EventoSaude): void {
  try {
    if (!TIPOS.includes(e.tipo) || !SEVS.includes(e.severidade)) return;
    const mensagem = mascararTexto(e.mensagem, 600); if (!mensagem) return;
    const assinatura = crypto.createHash("sha1").update(`${e.tipo}|${e.modulo}|${normalizarParaAssinatura(mensagem)}`).digest("hex");
    const agora = Date.now(), lim = limitePorAssinatura.get(assinatura);
    if (!lim || agora - lim.janela > 60_000) limitePorAssinatura.set(assinatura, { janela: agora, n: 1 });
    else if (++lim.n > 30) return;      // tempestade do mesmo erro: guarda só os 30 primeiros do minuto
    if (limitePorAssinatura.size > 2000) limitePorAssinatura.clear();
    if (fila.length >= 500) return;
    let detalhe: string | null = null; try { if (e.detalhe) detalhe = mascararTexto(JSON.stringify(e.detalhe), 2000); } catch { /* sem detalhe */ }
    fila.push([agora, e.tipo, mascararTexto(e.modulo, 80), e.severidade, assinatura, mensagem, detalhe, mascararTexto(e.email || "", 190).replace("[email]", e.email || ""), String(e.tenant || "").slice(0, 120), Math.max(0, Math.round(e.duracaoMs || 0))]);
  } catch { /* o monitor nunca derruba o sistema */ }
}

async function descarregar(): Promise<void> {
  if (!fila.length) return;
  const lote = fila; fila = [];
  try { await garantir(); await consulta("INSERT INTO saude_eventos (ts, tipo, modulo, severidade, assinatura, mensagem, detalhe, email, tenant, duracao_ms) VALUES ?", [lote]); }
  catch { if (fila.length + lote.length <= 200) fila = lote.concat(fila); }      // banco fora do ar: tenta de novo no próximo ciclo (com limite)
}

// ---------- métricas em memória: IA por hora e rotas ----------
const ia = { chamadas: 0, ok: 0, f503: 0, f429: 0, timeout: 0, auth: 0, outro: 0, tokens: 0, desde: Date.now() };
export function contarIA(resultado: "ok" | "503" | "429" | "timeout" | "auth" | "outro", tokens = 0): void {
  ia.chamadas++; if (resultado === "ok") { ia.ok++; ia.tokens += tokens || 0; } else if (resultado === "503") ia.f503++; else if (resultado === "429") ia.f429++; else if (resultado === "timeout") ia.timeout++; else if (resultado === "auth") ia.auth++; else ia.outro++;
}
const rotas = new Map<string, { n: number; erros: number; total: number; max: number; recentes: number[] }>();
function contarRota(caminho: string, status: number, ms: number): void {
  const k = caminho.split("?")[0].replace(/\/[0-9a-f-]{16,}$/i, "/:id").slice(0, 80); let r = rotas.get(k);
  if (!r) { if (rotas.size > 150) return; r = { n: 0, erros: 0, total: 0, max: 0, recentes: [] }; rotas.set(k, r); }
  r.n++; r.total += ms; r.max = Math.max(r.max, ms); if (status >= 500) r.erros++; r.recentes.push(ms); if (r.recentes.length > 100) r.recentes.shift();
}
/** Middleware: mede cada pedido /api (tempo e status). Só vira evento o que passa de 500 ou demora mais de 5 minutos. */
export const medirPedidos: express.RequestHandler = (req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    try {
      const ms = Date.now() - t0, caminho = String(req.originalUrl || req.url || ""); if (!caminho.startsWith("/api/") || /\/api\/(progresso|resultado)\//.test(caminho)) return;
      contarRota(caminho, res.statusCode, ms);
      const quem = (req as any).usuarioSessao as { email?: string; tenant?: string } | undefined;      // a sessão já está preenchida quando o pedido termina
      if (res.statusCode >= 500) registrarSaude({ tipo: "servidor", modulo: caminho.split("?")[0].replace(/\/[0-9a-f-]{16,}$/i, "/:id"), severidade: "erro", mensagem: `HTTP ${res.statusCode} em ${req.method} ${caminho.split("?")[0]}`, duracaoMs: ms, email: quem?.email, tenant: quem?.tenant });
      else if (ms > 5 * 60_000) registrarSaude({ tipo: "servidor", modulo: caminho.split("?")[0], severidade: "aviso", mensagem: `Pedido muito demorado (${Math.round(ms / 1000)}s) em ${req.method} ${caminho.split("?")[0]}`, duracaoMs: ms, email: quem?.email, tenant: quem?.tenant });
    } catch { /* ignora */ }
  });
  next();
};

function despejarMetricaDaHora(): void {
  if (!ia.chamadas) { ia.desde = Date.now(); return; }
  registrarSaude({ tipo: "ia", modulo: "metrica_hora", severidade: "info", mensagem: `IA na última hora: ${ia.chamadas} chamadas, ${ia.ok} ok, ${ia.f503} alta demanda (503), ${ia.f429} cota (429), ${ia.timeout} tempo esgotado, ${ia.auth} chave inválida, ${ia.outro} outras; ${ia.tokens} tokens`, detalhe: { ...ia } });
  Object.assign(ia, { chamadas: 0, ok: 0, f503: 0, f429: 0, timeout: 0, auth: 0, outro: 0, tokens: 0, desde: Date.now() });
}

// ---------- limpeza automática (30 dias) ----------
export async function limparSaude(): Promise<{ eventos: number; erros: number; operacoes: number; extras: number }> {
  await garantir();
  const limite = Date.now() - RETENCAO_DIAS * DIA;
  const [r1]: any = await consulta("DELETE FROM saude_eventos WHERE ts < ?", [limite]);
  // monitores antigos (erros da tela e operações) ficam na tabela docs: mesma regra de 30 dias; erro "aceito" (correção ainda pendente) não é apagado
  const [r2]: any = await consulta("DELETE FROM docs WHERE col REGEXP '^gabinetes/[^/]+/error_events$' AND updated_at < ? AND data NOT LIKE '%\"situacao\":\"aceito\"%'", [limite]);
  const [r3]: any = await consulta("DELETE FROM docs WHERE col REGEXP '^gabinetes/[^/]+/ops_events$' AND updated_at < ?", [limite]);
  let extras = 0; for (const f of limpadores) { try { extras += await f(limite); } catch { /* um limpador com falha não impede os outros */ } }
  const out = { eventos: r1?.affectedRows || 0, erros: r2?.affectedRows || 0, operacoes: r3?.affectedRows || 0, extras };
  await consulta("INSERT INTO docs (col, id, data, updated_at) VALUES ('settings','saude_limpeza',?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [JSON.stringify({ ts: Date.now(), ...out }), Date.now()]);
  return out;
}

// ---------- rotas ----------
const soSuper = async (req: express.Request) => { const u = await autenticarSessao(req); if (!u.superAdmin) throw Object.assign(new Error("somente o super administrador"), { status: 403 }); return u; };
const limiteUsuario = new Map<string, { janela: number; n: number }>();

/** Navegador e extensão informam eventos (retomadas, erros da extensão, adiamento de versão). Qualquer usuário logado; limitado e filtrado. */
saudeRouter.post("/evento", async (req, res) => {
  try {
    const u = await autenticarSessao(req), agora = Date.now(), l = limiteUsuario.get(u.uid);
    if (!l || agora - l.janela > 60_000) limiteUsuario.set(u.uid, { janela: agora, n: 1 }); else if (++l.n > 20) return void res.status(429).json({ ok: false });
    const lista = Array.isArray(req.body?.eventos) ? req.body.eventos.slice(0, 20) : [];
    for (const e of lista) {
      if (!TIPOS_DO_CLIENTE.has(String(e?.tipo)) || !SEVS.includes(String(e?.severidade))) continue;
      registrarSaude({ tipo: String(e.tipo), modulo: String(e.modulo || "").slice(0, 80), severidade: e.severidade, mensagem: String(e.mensagem || ""), detalhe: typeof e.detalhe === "object" ? e.detalhe : undefined, email: u.email, tenant: u.tenant, duracaoMs: Number(e.duracaoMs) || 0 });
    }
    res.json({ ok: true, aceitos: lista.length });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

const paraEvento = (r: any): EventoSaudeBase & Record<string, any> => ({ id: Number(r.id), ts: Number(r.ts), tipo: r.tipo, modulo: r.modulo, severidade: r.severidade, assinatura: r.assinatura, mensagem: r.mensagem, email: r.email || undefined, detalhe: r.detalhe, duracaoMs: Number(r.duracao_ms) });

saudeRouter.get("/resumo", async (req, res) => {
  try {
    await soSuper(req); await garantir(); await descarregar();
    const horas = Math.min(RETENCAO_DIAS * 24, Math.max(1, Number(req.query.horas) || 24)), agora = Date.now(), janela = horas * 3_600_000;
    const [linhas]: any = await consulta("SELECT id, ts, tipo, modulo, severidade, assinatura, mensagem, email, duracao_ms FROM saude_eventos WHERE ts >= ? ORDER BY ts DESC LIMIT 20000", [agora - janela]);
    const eventos = linhas.map(paraEvento);
    const recentes: EventoSaudeBase[] = eventos.filter((e: EventoSaudeBase) => e.ts >= agora - 86_400_000);
    const tipos = TIPOS.map((t) => ({ tipo: t, semaforo: semaforoDoTipo(eventos, t, agora), total: eventos.filter((e: any) => e.tipo === t && e.severidade !== "info").length }));
    const porHora = janela <= 48 * 3_600_000, passo = porHora ? 3_600_000 : DIA, n = Math.ceil(janela / passo), serie = Array.from({ length: n }, (_, i) => ({ ts: agora - (n - i) * passo, erro: 0, aviso: 0 }));
    for (const e of eventos) { if (e.severidade === "info") continue; const i = n - 1 - Math.floor((agora - e.ts) / passo); if (i >= 0 && i < n) serie[i][e.severidade as "erro" | "aviso"]++; }
    const grupos = agruparEventos(eventos.filter((e: EventoSaudeBase) => e.severidade !== "info"), janela, agora).slice(0, 40);
    const [[maisAntigo]]: any = await consulta("SELECT MIN(ts) AS ts, COUNT(*) AS n FROM saude_eventos").then((r: any) => [r[0]]);
    const [ant]: any = await consulta("SELECT ts FROM saude_eventos WHERE ts < ? ORDER BY ts LIMIT 20000", [Date.now() - (RETENCAO_DIAS - 7) * DIA]);
    const [lim]: any = await consulta("SELECT data FROM docs WHERE col='settings' AND id='saude_limpeza'");
    let ultimaLimpeza: any = null; try { ultimaLimpeza = lim?.[0] ? JSON.parse(lim[0].data) : null; } catch { /* sem registro */ }
    res.json({
      horas, geradoEm: agora, tipos, serie, passo, grupos, alertas: gerarAlertas(recentes, agora), totalEventos: eventos.length,
      ia: { horaAtual: { ...ia }, ultimas24h: recentes.filter((e: any) => e.tipo === "ia" && e.modulo === "metrica_hora").length },
      rotas: [...rotas.entries()].map(([k, r]) => { const o = [...r.recentes].sort((a, b) => a - b); return { rota: k, n: r.n, erros: r.erros, mediaMs: Math.round(r.total / r.n), p95Ms: o[Math.min(o.length - 1, Math.floor(o.length * 0.95))] || 0, maxMs: r.max }; }).sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 15),
      retencao: { dias: RETENCAO_DIAS, maisAntigoTs: maisAntigo?.ts ? Number(maisAntigo.ts) : null, total: Number(maisAntigo?.n || 0), nivelAviso: nivelDeAviso(maisAntigo?.ts ? Number(maisAntigo.ts) : null), expiram: contarExpiracoes(ant.map((x: any) => Number(x.ts))), ultimaLimpeza },
    });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

saudeRouter.get("/eventos", async (req, res) => {
  try {
    await soSuper(req); await garantir(); await descarregar();
    const onde: string[] = ["ts >= ?"], p: any[] = [Date.now() - Math.min(RETENCAO_DIAS * 24, Number(req.query.horas) || 24) * 3_600_000];
    if (req.query.assinatura) { onde.push("assinatura = ?"); p.push(String(req.query.assinatura).slice(0, 40)); }
    if (req.query.tipo) { onde.push("tipo = ?"); p.push(String(req.query.tipo).slice(0, 24)); }
    const [linhas]: any = await consulta(`SELECT id, ts, tipo, modulo, severidade, assinatura, mensagem, detalhe, email, duracao_ms FROM saude_eventos WHERE ${onde.join(" AND ")} ORDER BY ts DESC LIMIT ?`, [...p, Math.min(300, Number(req.query.limite) || 100)]);
    res.json({ eventos: linhas.map(paraEvento) });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

/** Exporta tudo o que está guardado (para o aviso de 7, 3 e 1 dia: quem quiser guardar baixa antes de apagar). */
saudeRouter.get("/exportar", async (req, res) => {
  try {
    await soSuper(req); await garantir(); await descarregar();
    const [linhas]: any = await consulta("SELECT id, ts, tipo, modulo, severidade, assinatura, mensagem, detalhe, email, duracao_ms FROM saude_eventos ORDER BY ts DESC LIMIT 50000");
    res.json({ exportadoEm: Date.now(), retencaoDias: RETENCAO_DIAS, eventos: linhas.map(paraEvento) });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

saudeRouter.post("/limpar", async (req, res) => {
  try { await soSuper(req); res.json(await limparSaude()); } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

let iniciada = false;
/** Liga o coletor: grava a fila a cada 5 s, resume a IA a cada hora, limpa a cada 6 h, vigia erros soltos e registra cada (re)início do servidor. */
export function iniciarSaudeDoSistema(): void {
  if (iniciada) return; iniciada = true;
  definirAoErroBanco((e, sql) => registrarSaude({ tipo: "banco", modulo: String(sql || "").trim().split(/\s+/).slice(0, 3).join(" ").slice(0, 60), severidade: "erro", mensagem: `${e?.code || "ERRO"}: ${e?.sqlMessage || e?.message || e}` }));
  definirAoRecuperarBanco((ms) => registrarSaude({ tipo: "banco", modulo: "conexao", severidade: "info", mensagem: `MySQL voltou a responder (ficou instável por ${Math.max(1, Math.round(ms / 1000))}s)`, duracaoMs: ms }));
  process.on("unhandledRejection", (e: any) => registrarSaude({ tipo: "servidor", modulo: "promessa", severidade: "erro", mensagem: String(e?.message || e), detalhe: { pilha: String(e?.stack || "").split("\n").slice(0, 4).join(" | ") } }));
  process.on("uncaughtException", (e: any) => registrarSaude({ tipo: "servidor", modulo: "excecao", severidade: "erro", mensagem: String(e?.message || e), detalhe: { pilha: String(e?.stack || "").split("\n").slice(0, 4).join(" | ") } }));
  for (const s of ["SIGTERM", "SIGINT"] as const) process.once(s, () => { registrarSaude({ tipo: "sistema", modulo: "servidor", severidade: "info", mensagem: `Servidor encerrando (${s})` }); void descarregar().finally(() => process.exit(0)); });
  registrarSaude({ tipo: "sistema", modulo: "servidor", severidade: "info", mensagem: "Servidor iniciado", detalhe: { node: process.version, memoriaMB: Math.round(process.memoryUsage().rss / 1048576) } });
  setInterval(() => { void descarregar(); }, 5000).unref?.();
  setInterval(despejarMetricaDaHora, 3_600_000).unref?.();
  const limpar = () => { limparSaude().then((r) => { if (r.eventos + r.erros + r.operacoes) console.log(`[saúde] limpeza de 30 dias: ${r.eventos} eventos, ${r.erros} erros, ${r.operacoes} operações`); }).catch((e) => console.warn("[saúde] limpeza falhou:", e?.code || "", e?.message || e)); };
  setTimeout(limpar, 2 * 60_000).unref?.(); setInterval(limpar, 6 * 3_600_000).unref?.();
}
