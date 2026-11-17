// MONITOR SÓ DE LEITURA: deixa o dono do sistema (ou quem ele autorizar com um token) ver o que acontece no Studio sem abrir o banco de fora.
// Tudo aqui é SELECT: não grava, não apaga, não altera nada. Montado ANTES do porteiro de sessão (/api exige login) porque quem chama (um agente de monitoramento) não tem login de usuário.
// Acesso: (1) cabeçalho X-Monitor-Token igual à variável de ambiente MONITOR_TOKEN (mínimo 32 caracteres; sem a variável, a rota fica DESLIGADA), ou (2) sessão de Super Admin.
// O token nunca vai na URL (URL aparece em log). Não devolve senhas, chaves nem o texto dos autos/minutas.
import express from "express";
import crypto from "node:crypto";
import { banco } from "./historyRoutes";
import { consultaSaude, garantirSaude, esvaziarFilaSaude } from "./saudeSistema";
import { autenticarSessao } from "./authRoutes";

export const monitorRouter = express.Router();

const HASH = (s: string) => crypto.createHash("sha256").update(s).digest();
export function tokenConfere(informado: string, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < 32 || !informado) return false;
  return crypto.timingSafeEqual(HASH(informado), HASH(esperado));      // compara os hashes: tempo igual, tamanhos iguais
}

const limite = new Map<string, { janela: number; n: number }>();
const dentroDoLimite = (chave: string): boolean => {
  const agora = Date.now(), l = limite.get(chave);
  if (limite.size > 500) limite.clear();
  if (!l || agora - l.janela > 60_000) { limite.set(chave, { janela: agora, n: 1 }); return true; }
  return ++l.n <= 30;
};

monitorRouter.use(async (req: any, res, next) => {
  try {
    if (req.method !== "GET") return void res.status(405).json({ erro: "só leitura" });
    const esperado = process.env.MONITOR_TOKEN;
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const informado = String(req.headers["x-monitor-token"] || bearer || "");
    if (!dentroDoLimite(`${req.ip}|${informado ? "t" : "s"}`)) return void res.status(429).json({ erro: "muitos pedidos; espere um minuto" });
    if (informado) {
      if (!esperado || esperado.length < 32) return void res.status(404).json({ erro: "monitor desligado" });      // não revela se existe ou não
      if (!tokenConfere(informado, esperado)) return void res.status(401).json({ erro: "token inválido" });
      return next();
    }
    if (req.headers["x-assessor-sessao"]) {
      const u = await autenticarSessao(req);
      if (u.superAdmin) return next();
      return void res.status(403).json({ erro: "somente o super administrador" });
    }
    return void res.status(esperado ? 401 : 404).json({ erro: esperado ? "token necessário" : "monitor desligado" });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: "falha na autenticação" }); }
});

const horasDe = (q: any, padrao = 24, max = 24 * 30) => Math.min(max, Math.max(1, Number(q) || padrao));

// ---------- uso de IA (dos registros por execução que o servidor grava) ----------
export interface ResumoUso {
  execucoes: number; tokens: number; custoBrl: number;
  porModulo: { modulo: string; chamadas: number; tokens: number; custoBrl: number }[];
  porUsuario: { usuario: string; chamadas: number; tokens: number; modulos: Record<string, number> }[];
  porHora: { hora: string; chamadas: number; tokens: number }[];
  porModelo: { modelo: string; chamadas: number; tokens: number }[];
  maiores: { quando: string; rotulo: string; tokens: number; modulo: string; usuario: string }[];
}
/** Soma as execuções (cada linha é o JSON de um registro de uso). Tolerante: linha estragada é ignorada. */
export function agregarUso(linhas: any[], desdeMs: number): ResumoUso {
  const modulo = new Map<string, any>(), usuario = new Map<string, any>(), hora = new Map<string, any>(), modelo = new Map<string, any>();
  const execs: any[] = []; let tokens = 0, custo = 0;
  for (const l of linhas) {
    let d: any = l; if (typeof l === "string") { try { d = JSON.parse(l); } catch { continue; } }
    if (!d || typeof d !== "object") continue;
    const t = Number(d.timeMs) || 0; if (t && t < desdeMs) continue;
    const tk = Number(d.totalTokens) || 0, c = Number(d.costBrl) || 0, m = String(d.module || "outros"), u = String(d.userEmail || d.userName || "?"), mod = String(d.model || "?");
    tokens += tk; custo += c;
    const a = modulo.get(m) || { modulo: m, chamadas: 0, tokens: 0, custoBrl: 0 }; a.chamadas++; a.tokens += tk; a.custoBrl += c; modulo.set(m, a);
    const b = usuario.get(u) || { usuario: u, chamadas: 0, tokens: 0, modulos: {} as Record<string, number> }; b.chamadas++; b.tokens += tk; b.modulos[m] = (b.modulos[m] || 0) + 1; usuario.set(u, b);
    const hk = t ? new Date(Math.floor(t / 3_600_000) * 3_600_000).toISOString().slice(0, 13) + "h" : "?";
    const h = hora.get(hk) || { hora: hk, chamadas: 0, tokens: 0 }; h.chamadas++; h.tokens += tk; hora.set(hk, h);
    const g = modelo.get(mod) || { modelo: mod, chamadas: 0, tokens: 0 }; g.chamadas++; g.tokens += tk; modelo.set(mod, g);
    execs.push({ quando: t ? new Date(t).toISOString() : "?", rotulo: String(d.label || "").slice(0, 100), tokens: tk, modulo: m, usuario: u });
  }
  const ord = <T,>(m: Map<string, T>, f: (x: T) => number) => [...m.values()].sort((x, y) => f(y) - f(x));
  return {
    execucoes: execs.length, tokens, custoBrl: Number(custo.toFixed(4)),
    porModulo: ord(modulo, (x: any) => x.tokens).map((x: any) => ({ ...x, custoBrl: Number(x.custoBrl.toFixed(4)) })),
    porUsuario: ord(usuario, (x: any) => x.tokens).slice(0, 30),
    porHora: [...hora.values()].sort((a, b) => a.hora.localeCompare(b.hora)),
    porModelo: ord(modelo, (x: any) => x.tokens).slice(0, 12),
    maiores: execs.sort((a, b) => b.tokens - a.tokens).slice(0, 15),
  };
}

monitorRouter.get("/uso", async (req, res) => {
  try {
    const horas = horasDe(req.query.horas), desde = Date.now() - horas * 3_600_000;
    const [rows]: any = await banco().query("SELECT data FROM docs WHERE col LIKE 'gabinetes/%/usageLogs' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 20000", [desde]);
    res.json({ horas, geradoEm: new Date().toISOString(), truncado: rows.length >= 20000, ...agregarUso(rows.map((r: any) => r.data), desde) });
  } catch { res.status(500).json({ erro: "não consegui ler o uso" }); }
});

// ---------- saúde: erros e avisos agrupados ----------
monitorRouter.get("/saude", async (req, res) => {
  try {
    await garantirSaude(); await esvaziarFilaSaude();
    const horas = horasDe(req.query.horas), desde = Date.now() - horas * 3_600_000;
    const [grupos]: any = await consultaSaude(
      "SELECT tipo, modulo, severidade, mensagem, COUNT(*) AS n, MIN(ts) AS primeiro, MAX(ts) AS ultimo, COUNT(DISTINCT NULLIF(email,'')) AS usuarios FROM saude_eventos WHERE ts >= ? AND severidade IN ('erro','aviso') GROUP BY tipo, modulo, severidade, mensagem ORDER BY n DESC LIMIT 40", [desde]);
    const [horasRows]: any = await consultaSaude(
      "SELECT FLOOR(ts/3600000)*3600000 AS hora, severidade, COUNT(*) AS n FROM saude_eventos WHERE ts >= ? AND severidade IN ('erro','aviso') GROUP BY hora, severidade ORDER BY hora", [desde]);
    const [metricas]: any = await consultaSaude(
      "SELECT ts, mensagem, detalhe FROM saude_eventos WHERE tipo='ia' AND modulo='metrica_hora' AND ts >= ? ORDER BY ts DESC LIMIT 48", [desde]);
    const iso = (v: any) => new Date(Number(v)).toISOString();
    res.json({
      horas, geradoEm: new Date().toISOString(),
      grupos: grupos.map((g: any) => ({ tipo: g.tipo, modulo: g.modulo, severidade: g.severidade, mensagem: String(g.mensagem).slice(0, 300), ocorrencias: Number(g.n), primeiro: iso(g.primeiro), ultimo: iso(g.ultimo), usuarios: Number(g.usuarios) })),
      porHora: horasRows.map((h: any) => ({ hora: iso(h.hora), severidade: h.severidade, n: Number(h.n) })),
      iaPorHora: metricas.map((m: any) => ({ quando: iso(m.ts), resumo: String(m.mensagem).slice(0, 300), detalhe: m.detalhe ? String(m.detalhe).slice(0, 600) : undefined })),
    });
  } catch { res.status(500).json({ erro: "não consegui ler a saúde" }); }
});

// ---------- banco: tamanho das tabelas e das coleções (só números, nunca o conteúdo) ----------
monitorRouter.get("/banco", async (_req, res) => {
  try {
    const [tabelas]: any = await banco().query("SELECT table_name AS nome, table_rows AS linhas, ROUND((data_length + index_length) / 1048576, 1) AS mb FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length + index_length) DESC LIMIT 30");
    const [colecoes]: any = await banco().query("SELECT col, COUNT(*) AS n, MAX(updated_at) AS ultimo FROM docs GROUP BY col ORDER BY n DESC LIMIT 30");
    res.json({
      geradoEm: new Date().toISOString(),
      tabelas: tabelas.map((t: any) => ({ nome: t.nome, linhasAprox: Number(t.linhas), mb: Number(t.mb) })),
      colecoes: colecoes.map((c: any) => ({ colecao: String(c.col).slice(0, 100), docs: Number(c.n), ultimaAlteracao: c.ultimo ? new Date(Number(c.ultimo)).toISOString() : null })),
    });
  } catch { res.status(500).json({ erro: "não consegui ler o banco" }); }
});

monitorRouter.get("/", (_req, res) => res.json({ ok: true, rotas: ["/api/monitor/uso?horas=24", "/api/monitor/saude?horas=24", "/api/monitor/banco"], somenteLeitura: true }));
