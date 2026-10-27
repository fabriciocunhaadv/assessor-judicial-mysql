// CONSUMO DE IA CONTADO NO SERVIDOR: cada análise (minuta, Turbo, Lupa, Mesa de Audiência) que termina com sucesso é somada aqui, de quem fez a chamada,
// sem depender de o navegador gravar depois. Grava no mesmo formato que o navegador gravava (registro da execução + contadores do mês), então as telas
// "Tokens" e "Utilização" continuam lendo igual. Uma falha aqui só vai para o log do servidor: nunca atrapalha a resposta ao usuário.
import type { RequestHandler } from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { calculateCostBrl } from "../src/utils/custoIA";

type Modulo = "minuta" | "turbo" | "lupa_magistrado" | "audiencia";
const ROTAS: Record<string, { modulo: Modulo; rotulo: string }> = {
  "/api/generate-minute": { modulo: "minuta", rotulo: "Minuta" },
  "/api/generate-minute-turbo": { modulo: "turbo", rotulo: "Minuta Turbo" },
  "/api/audit-assessor-draft": { modulo: "lupa_magistrado", rotulo: "Auditoria: Lupa do Magistrado" },
  "/api/hearing-copilot": { modulo: "audiencia", rotulo: "Mesa de Audiência" },
};

export interface UsoExtraido { prompt: number; saida: number; total: number; modelo: string; processo: string }

/** Tira do corpo da resposta os tokens de cada rota (generate-minute / audit / hearing: usage; turbo: stats). Devolve null se não houver consumo. */
export function extrairUso(corpo: any): UsoExtraido | null {
  if (!corpo || typeof corpo !== "object") return null;
  const u = corpo.usage, s = corpo.stats;
  let prompt = 0, saida = 0, total = 0;
  if (u && (u.totalTokenCount || u.promptTokenCount)) { prompt = Number(u.promptTokenCount) || 0; saida = Number(u.candidatesTokenCount) || 0; total = Number(u.totalTokenCount) || prompt + saida; }
  else if (s && (s.tokensUsed || s.promptTokens)) { prompt = Number(s.promptTokens) || 0; saida = Number(s.candidatesTokens) || 0; total = Number(s.tokensUsed) || prompt + saida; }
  if (!(total > 0)) return null;
  const modelo = String(corpo.modelUsed || s?.modelUsed || "Gemini Flash").slice(0, 80);
  const processo = String(corpo.processNumber || corpo.minute?.processNumber || corpo.data?.processNumber || "").slice(0, 60);
  return { prompt, saida, total, modelo, processo };
}

const chaveEmail = (e: string) => e.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
const somar = (a: any, uso: UsoExtraido, custo: number) => ({
  ...(a || {}),
  totalTokens: (Number(a?.totalTokens) || 0) + uso.total, promptTokens: (Number(a?.promptTokens) || 0) + uso.prompt, candidatesTokens: (Number(a?.candidatesTokens) || 0) + uso.saida,
  requestCount: (Number(a?.requestCount) || 0) + 1, ...(a?.costBrl !== undefined || custo ? { costBrl: Number(((Number(a?.costBrl) || 0) + custo).toFixed(6)) } : {}),
});

/** Soma uma execução no registro do gabinete e nos contadores do mês (token_usage). */
export async function registrarUso(p: { tenant: string; uid: string; email: string; nome: string; modulo: Modulo; rotulo: string; uso: UsoExtraido; nativa: boolean }, bancoDeTeste?: any): Promise<void> {
  if (!bancoDeTeste) await garantirDocs();
  const agora = Date.now(), d = new Date(agora);
  const custo = p.nativa ? calculateCostBrl(p.uso.prompt, p.uso.saida, p.uso.modelo) : 0;
  const colLogs = `gabinetes/${p.tenant}/usageLogs`, colMes = `gabinetes/${p.tenant}/token_usage`;
  const mes = d.toISOString().slice(0, 7), hoje = d.toISOString().slice(0, 10), chave = chaveEmail(p.email);
  const log = {
    id: `srv-${agora}-${Math.random().toString(36).slice(2, 8)}`, timestamp: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }), timeMs: agora,
    label: `${p.rotulo}${p.uso.processo ? ` (${p.uso.processo})` : ""}`.slice(0, 160), processNumber: p.uso.processo || "Gabinete TJGO", model: p.uso.modelo,
    promptTokens: p.uso.prompt, outputTokens: p.uso.saida, totalTokens: p.uso.total, costBrl: custo, userId: p.uid, userName: p.nome, userEmail: p.email,
    module: p.modulo, keyType: p.nativa ? "native" : "byok", keyLabel: p.nativa ? "Chave Nativa Corporativa" : "Chave Pessoal", tenantId: p.tenant, tenant: p.tenant, registradoPor: "servidor",
  };
  const con: any = await (bancoDeTeste || banco()).getConnection();
  try {
    await con.beginTransaction();
    await con.query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?)", [colLogs, log.id, JSON.stringify(log), agora]);
    const [rows] = await con.query("SELECT data FROM docs WHERE col=? AND id=? FOR UPDATE", [colMes, mes]);
    let doc: any = {};
    try { doc = rows[0] ? JSON.parse(rows[0].data) : {}; } catch { doc = {}; }
    const usuarios = doc.users || {}, antes = usuarios[chave] || {};
    const modulosUsuario = { ...(antes.modules || {}) };
    modulosUsuario[p.modulo] = somar(modulosUsuario[p.modulo], p.uso, custo);
    const modulosMes = { ...(doc.modules || {}) };
    modulosMes[p.modulo] = somar(modulosMes[p.modulo], p.uso, custo);
    const { costBrl: _c, ...mesSemCusto } = somar(doc, p.uso, 0) as any;
    const { costBrl: _d, ...usuarioSemCusto } = somar(antes, p.uso, 0) as any;
    const novo = {
      ...doc, ...mesSemCusto, monthKey: mes, tenantId: p.tenant, lastUsedAt: agora, modules: modulosMes,
      users: {
        ...usuarios,
        [chave]: {
          ...usuarioSemCusto, userEmail: p.email, userName: p.nome, lastUsedAt: agora, keyMode: p.nativa ? "native" : "custom",
          activeKeyLabel: p.nativa ? "Chave Nativa Corporativa" : (antes.activeKeyLabel || "Chave Pessoal"), activeKeySnippet: p.nativa ? "NATIVA" : (antes.activeKeySnippet || ""),
          poolSize: antes.poolSize || 1, rotationsCount: antes.rotationsCount || 0,
          dailyRequests: antes.dailyDate === hoje ? (Number(antes.dailyRequests) || 0) + 1 : 1, dailyDate: hoje,
          lastRotationAt: antes.lastRotationAt || null, lastRotationReason: antes.lastRotationReason || null, modules: modulosUsuario,
        },
      },
    };
    if (p.nativa) novo.costBrl = Number(((Number(doc.costBrl) || 0) + custo).toFixed(6));
    novo.users[chave].costBrl = Number(((Number(antes.costBrl) || 0) + custo).toFixed(6));
    await con.query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [colMes, mes, JSON.stringify(novo), agora]);
    await con.commit();
  } catch (e) { try { await con.rollback(); } catch { /* sem transação */ } throw e; }
  finally { con.release(); }
}

/** Ligado nas rotas de IA: só conta quando o navegador do app avisa (X-Uso-No-Servidor: 1), para o navegador não contar de novo. */
export const contarUsoNoServidor = (ehNativa: (req: any) => boolean): RequestHandler => (req: any, res: any, next) => {
  const rota = ROTAS[String(req.baseUrl || "").replace(/\/+$/, "") || String(req.originalUrl || "").split("?")[0]];
  if (req.method !== "POST" || String(req.headers["x-uso-no-servidor"] || "") !== "1" || !rota || !req.usuarioSessao) return next();
  const partes: Buffer[] = []; let tam = 0;
  const juntar = (c: any) => { try { if (c && typeof c !== "function" && tam < 8_000_000) { const b = Buffer.isBuffer(c) ? c : Buffer.from(String(c)); partes.push(b); tam += b.length; } } catch { /* ignora */ } };
  const escrever = res.write.bind(res), terminar = res.end.bind(res);
  res.write = (c: any, ...a: any[]) => { juntar(c); return escrever(c, ...a); };
  res.end = (c?: any, ...a: any[]) => {
    juntar(c);
    const r = terminar(c, ...a);
    try {
      if ((res.statusCode || 200) < 300 && tam < 8_000_000) {
        const uso = extrairUso(JSON.parse(Buffer.concat(partes).toString("utf8").trim()));
        if (uso) {
          const u = req.usuarioSessao;
          registrarUso({ tenant: u.tenant, uid: u.uid, email: String(u.email || ""), nome: String(u.name || String(u.email || "").split("@")[0] || "Assessor"), modulo: rota.modulo, rotulo: rota.rotulo, uso, nativa: ehNativa(req) })
            .catch((e) => console.error("[uso-no-servidor] não gravou o consumo:", e?.message || e));
        }
      }
    } catch { /* resposta que não é JSON de análise: nada a contar */ }
    return r;
  };
  next();
};
