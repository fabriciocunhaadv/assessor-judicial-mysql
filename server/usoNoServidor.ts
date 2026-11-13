// CONSUMO DE IA CONTADO NO SERVIDOR: cada análise (minuta, Turbo, Lupa, Mesa de Audiência) que termina com sucesso é somada aqui, de quem fez a chamada,
// sem depender de o navegador gravar depois. Grava no mesmo formato que o navegador gravava (registro da execução + contadores do mês), então as telas
// "Tokens" e "Utilização" continuam lendo igual. Uma falha aqui só vai para o log do servidor: nunca atrapalha a resposta ao usuário.
import type { RequestHandler } from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { calculateCostBrl } from "../src/utils/custoIA";

type Modulo = "minuta" | "turbo" | "lupa_magistrado" | "audiencia" | "ia_externa" | "sentenca_video" | "copiloto" | "chat_refino" | "modelos" | "apoio" | "gigante" | "outros";
const ROTAS: Record<string, { modulo: Modulo; rotulo: string }> = {
  "/api/generate-minute": { modulo: "minuta", rotulo: "Minuta" },
  "/api/generate-minute-turbo": { modulo: "turbo", rotulo: "Minuta Turbo" },
  "/api/audit-assessor-draft": { modulo: "lupa_magistrado", rotulo: "Auditoria: Lupa do Magistrado" },
  "/api/hearing-copilot": { modulo: "audiencia", rotulo: "Mesa de Audiência" },
  "/api/mutirao-video": { modulo: "sentenca_video", rotulo: "Sentença com vídeo da audiência (degravação + motor principal)" },
  "/api/mapa-processo": { modulo: "apoio", rotulo: "Mapa do processo (leitura completa dos autos)" },
  "/api/chat-agaia": { modulo: "chat_refino", rotulo: "Chat da minuta (consulta / reescrita)" },
  "/api/lateral-agent-chat": { modulo: "copiloto", rotulo: "Copiloto IA" },
  "/api/reestruturar-minuta": { modulo: "modelos", rotulo: "Aplicar modelo / paradigma à minuta" },
  "/api/conferir-modelos": { modulo: "modelos", rotulo: "Conferir minuta com os modelos do Projudi" },
  "/api/assistente-sugerir": { modulo: "apoio", rotulo: "Assistente do dia (sugestão)" },
  "/api/ocr-paginas": { modulo: "apoio", rotulo: "OCR de páginas por IA" },
  "/api/gigante-lote": { modulo: "gigante", rotulo: "Processo gigante: leitura de um trecho" },
  "/api/gigante-fusao": { modulo: "gigante", rotulo: "Processo gigante: fusão das fichas" },
  "/api/advogado-peticao/auto-extract-evidence": { modulo: "outros", rotulo: "Petição 360°: leitura dos autos e provas" },
  "/api/advogado-peticao/generate-full-petition": { modulo: "outros", rotulo: "Petição 360°: redação da peça" },
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
export async function registrarUso(p: { tenant: string; uid: string; email: string; nome: string; modulo: Modulo; rotulo: string; uso: UsoExtraido; nativa: boolean; idLog?: string }, bancoDeTeste?: any): Promise<void> {
  if (!bancoDeTeste) await garantirDocs();
  const agora = Date.now(), d = new Date(agora);
  const custo = p.nativa ? calculateCostBrl(p.uso.prompt, p.uso.saida, p.uso.modelo) : 0;
  const colLogs = `gabinetes/${p.tenant}/usageLogs`, colMes = `gabinetes/${p.tenant}/token_usage`;
  const mes = d.toISOString().slice(0, 7), hoje = d.toISOString().slice(0, 10), chave = chaveEmail(p.email);
  const log = {
    id: p.idLog || `srv-${agora}-${Math.random().toString(36).slice(2, 8)}`, timestamp: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }), timeMs: agora,
    label: `${p.rotulo}${p.uso.processo ? ` (${p.uso.processo})` : ""}`.slice(0, 160), processNumber: p.uso.processo || "Gabinete TJGO", model: p.uso.modelo,
    promptTokens: p.uso.prompt, outputTokens: p.uso.saida, totalTokens: p.uso.total, costBrl: custo, userId: p.uid, userName: p.nome, userEmail: p.email,
    module: p.modulo, keyType: p.nativa ? "native" : "byok", keyLabel: p.nativa ? "Chave Nativa Corporativa" : "Chave Pessoal", tenantId: p.tenant, tenant: p.tenant, registradoPor: "servidor",
  };
  const con: any = await (bancoDeTeste || banco()).getConnection();
  try {
    await con.beginTransaction();
    if (p.idLog) { const [ja] = await con.query("SELECT 1 FROM docs WHERE col=? AND id=?", [colLogs, log.id]); if (ja[0]) { await con.rollback(); return; } }      // mesma execução avisada duas vezes (nova tentativa de entrega): conta uma só
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

/** Minuta feita FORA da IA do Studio (ChatGPT, Gemini, Claude, IA do Jusbrasil ou Agaia, pela esteira da extensão) e entregue ao Studio: conta como uma execução do módulo "IA externa" (sem tokens: o consumo é da conta da pessoa naquele site). */
export const ORIGENS_EXTERNAS = /^[\p{L}\p{N} .\-]{2,40}$/u;
export const usoExterno = (): RequestHandler => async (req: any, res: any) => {
  try {
    const u = req.usuarioSessao; if (!u) return res.status(401).json({ ok: false });
    const origem = String(req.body?.origem || "").trim(), processo = String(req.body?.processo || "").slice(0, 60), chave = String(req.body?.chave || "").replace(/[^\w-]/g, "").slice(0, 60);
    if (!ORIGENS_EXTERNAS.test(origem)) return res.status(400).json({ ok: false, erro: "origem inválida" });
    await registrarUso({ tenant: u.tenant, uid: u.uid, email: String(u.email || ""), nome: String(u.name || String(u.email || "").split("@")[0] || "Assessor"), modulo: "ia_externa", rotulo: `Minuta feita em ${origem}`, uso: { prompt: 0, saida: 0, total: 0, modelo: origem, processo }, nativa: false, idLog: chave ? `ext-${u.uid}-${chave}` : undefined });
    res.json({ ok: true });
  } catch (e: any) { console.error("[uso-externo]", e?.message || e); res.status(500).json({ ok: false }); }
};

/** USO DA EXTENSÃO: a extensão (Chrome) soma localmente o que a pessoa fez (processos na esteira por modo, OCR, PDF para texto, baixar arquivos…) e o app entrega aqui, por dia.
 *  Só contagens: nenhum conteúdo de processo. Cada lote tem um código: o mesmo lote reenviado não soma duas vezes. */
export async function registrarUsoExtensao(p: { tenant: string; uid: string; email: string; nome: string; lote: string; dias: Record<string, Record<string, number>>; versao?: string }, bancoDeTeste?: any): Promise<number> {
  if (!bancoDeTeste) await garantirDocs();
  const col = `gabinetes/${p.tenant}/usoExtensao`, agora = Date.now();
  const con: any = await (bancoDeTeste || banco()).getConnection();
  let gravados = 0;
  try {
    await con.beginTransaction();
    for (const [dia, recursos] of Object.entries(p.dias)) {
      const id = `${p.uid}_${dia}`;
      const [rows] = await con.query("SELECT data FROM docs WHERE col=? AND id=? FOR UPDATE", [col, id]);
      let doc: any = {}; try { doc = rows[0] ? JSON.parse(rows[0].data) : {}; } catch { doc = {}; }
      if (Array.isArray(doc.lotes) && doc.lotes.includes(p.lote)) continue;
      const rec = { ...(doc.recursos || {}) }; for (const [r, n] of Object.entries(recursos)) rec[r] = (Number(rec[r]) || 0) + n;
      const novo = { uid: p.uid, email: p.email, nome: p.nome, tenant: p.tenant, dia, recursos: rec, lotes: [...(doc.lotes || []), p.lote].slice(-20), versao: p.versao || doc.versao || "", atualizadoEm: agora };
      await con.query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [col, id, JSON.stringify(novo), agora]);
      gravados++;
    }
    await con.commit();
  } catch (e) { try { await con.rollback(); } catch { /* sem transação */ } throw e; }
  finally { con.release(); }
  return gravados;
}
export const usoExtensao = (): RequestHandler => async (req: any, res: any) => {
  try {
    const u = req.usuarioSessao; if (!u) return res.status(401).json({ ok: false });
    const lote = String(req.body?.lote || "").replace(/[^\w-]/g, "").slice(0, 60); if (lote.length < 6) return res.status(400).json({ ok: false, erro: "lote inválido" });
    const dias: Record<string, Record<string, number>> = {};
    for (const [d, rs] of Object.entries(req.body?.dias || {}).slice(0, 14)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !rs || typeof rs !== "object") continue;
      const o: Record<string, number> = {};
      for (const [r, n] of Object.entries(rs as any).slice(0, 30)) { const v = Math.floor(Number(n)); if (/^[a-z0-9_]{2,40}$/.test(r) && v > 0 && v <= 100000) o[r] = v; }
      if (Object.keys(o).length) dias[d] = o;
    }
    if (Object.keys(dias).length) await registrarUsoExtensao({ tenant: u.tenant, uid: u.uid, email: String(u.email || ""), nome: String(u.name || String(u.email || "").split("@")[0] || "Assessor"), lote, dias, versao: String(req.body?.versao || "").slice(0, 20) });
    res.json({ ok: true, lote });
  } catch (e: any) { console.error("[uso-extensao]", e?.message || e); res.status(500).json({ ok: false }); }
};
