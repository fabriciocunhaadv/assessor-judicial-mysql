// FILA NO CELULAR: a extensão (pelo Studio aberto) envia um RESUMO da fila (só números, estados e uma mensagem curta de erro); o servidor guarda o último resumo
// de cada usuário, mostra em "Minha fila" (inclusive no celular) e envia avisos (notificação do aparelho, Web Push) quando a fila conclui, para por erro,
// pede login/verificação ou o computador para de dar sinal. Nada aqui altera a fila nem os motores: é só informação, e cada usuário só vê a própria fila.
import express from "express";
import crypto from "node:crypto";
import webpush from "web-push";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { consultaSaude, garantirSaude, aoLimparSaude } from "./saudeSistema";
import { sanearResumo, detectarAvisos, computadorSemSinal, computadorOnline, comandoValido, comandoExpirado, type ResumoFila, type AvisoFila, type TipoAviso } from "../src/utils/filaRegras";

export const filaRouter = express.Router();
const TIPOS: TipoAviso[] = ["concluida", "erro", "pausa", "parou"];
const PREFS_PADRAO: Record<TipoAviso, boolean> = { concluida: true, erro: true, pausa: true, parou: true };
let esquema: Promise<void> | null = null, vapid: { publica: string; privada: string } | null = null, iniciada = false;
const ultimoAviso = new Map<string, number>();

const garantir = () => (esquema ||= (async () => {
  await garantirSaude();
  await consultaSaude(`CREATE TABLE IF NOT EXISTS fila_resumo (
    uid VARCHAR(128) NOT NULL PRIMARY KEY, email VARCHAR(190) NOT NULL DEFAULT '', resumo TEXT NOT NULL, ts BIGINT NOT NULL, avisado_parou TINYINT NOT NULL DEFAULT 0, prefs TEXT NULL, KEY ix_fila_ts (ts)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await consultaSaude(`CREATE TABLE IF NOT EXISTS fila_comandos (
    id CHAR(32) NOT NULL PRIMARY KEY, uid VARCHAR(128) NOT NULL, tipo VARCHAR(20) NOT NULL, ts BIGINT NOT NULL, estado VARCHAR(12) NOT NULL DEFAULT 'pendente', resultado VARCHAR(200) NOT NULL DEFAULT '', ts_fim BIGINT NOT NULL DEFAULT 0, KEY ix_fila_cmd (uid, ts)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await consultaSaude(`CREATE TABLE IF NOT EXISTS fila_push (
    id CHAR(40) NOT NULL PRIMARY KEY, uid VARCHAR(128) NOT NULL, assinatura TEXT NOT NULL, ts BIGINT NOT NULL, KEY ix_fila_push_uid (uid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquema = null; throw e; }));

/** Chaves VAPID (identificam o servidor perante os serviços de notificação): geradas uma vez e guardadas no banco. */
async function chaves() {
  if (vapid) return vapid;
  await garantir();
  const [r]: any = await consultaSaude("SELECT data FROM docs WHERE col='settings' AND id='vapid_push'");
  try { const d = r?.[0] ? JSON.parse(r[0].data) : null; if (d?.publica && d?.privada) return (vapid = d); } catch { /* gera de novo */ }
  const k = webpush.generateVAPIDKeys(); vapid = { publica: k.publicKey, privada: k.privateKey };
  await consultaSaude("INSERT INTO docs (col, id, data, updated_at) VALUES ('settings','vapid_push',?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [JSON.stringify(vapid), Date.now()]);
  return vapid;
}
const configurar = async () => { const k = await chaves(); webpush.setVapidDetails(process.env.VAPID_CONTATO || "mailto:suporte@assessor.net.br", k.publica, k.privada); };

const lerPrefs = (t: any): Record<TipoAviso, boolean> => { try { const p = JSON.parse(String(t)); return Object.fromEntries(TIPOS.map((k) => [k, p?.[k] !== false])) as Record<TipoAviso, boolean>; } catch { return { ...PREFS_PADRAO }; } };

/** Envia a notificação a todos os aparelhos do usuário que ativaram os avisos (e respeita as preferências dele). Aparelhos que não existem mais são apagados. */
export async function enviarAviso(uid: string, aviso: AvisoFila, ignorarPrefs = false): Promise<number> {
  await garantir();
  const [fr]: any = await consultaSaude("SELECT prefs FROM fila_resumo WHERE uid=?", [uid]);
  if (!ignorarPrefs && !lerPrefs(fr?.[0]?.prefs)[aviso.tipo]) return 0;
  const chave = `${uid}|${aviso.tipo}`, agora = Date.now();
  if (!ignorarPrefs && agora - (ultimoAviso.get(chave) || 0) < 10 * 60_000) return 0;      // no máximo 1 aviso do mesmo tipo a cada 10 minutos
  ultimoAviso.set(chave, agora); if (ultimoAviso.size > 5000) ultimoAviso.clear();
  const [subs]: any = await consultaSaude("SELECT id, assinatura FROM fila_push WHERE uid=?", [uid]);
  if (!subs.length) return 0;
  await configurar();
  let enviados = 0; const corpo = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, tag: aviso.tipo, url: "/?fila=1" });
  for (const s of subs) {
    try { await webpush.sendNotification(JSON.parse(s.assinatura), corpo, { TTL: 3600 }); enviados++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await consultaSaude("DELETE FROM fila_push WHERE id=?", [s.id]).catch(() => {}); }
  }
  return enviados;
}

const quem = async (req: express.Request) => { const u = await autenticarSessao(req); return { uid: String(u.uid), email: String(u.email || "") }; };
const falha = (res: express.Response, e: any) => res.status(e?.status || 500).json({ erro: mensagemDeErro(e) });
const lerResumo = (t: any): ResumoFila | null => { try { return JSON.parse(String(t)); } catch { return null; } };

/** A extensão (pelo Studio) informa o resumo da fila. */
filaRouter.post("/resumo", async (req, res) => {
  try {
    const { uid, email } = await quem(req); await garantir();
    const novo = sanearResumo(req.body?.resumo, Date.now());
    const [r]: any = await consultaSaude("SELECT resumo FROM fila_resumo WHERE uid=?", [uid]);
    const antes = lerResumo(r?.[0]?.resumo);
    await consultaSaude("INSERT INTO fila_resumo (uid, email, resumo, ts, avisado_parou) VALUES (?,?,?,?,0) ON DUPLICATE KEY UPDATE email=VALUES(email), resumo=VALUES(resumo), ts=VALUES(ts), avisado_parou=0", [uid, email.slice(0, 190), JSON.stringify(novo), novo.geradoEm]);
    const avisos = detectarAvisos(antes, novo); let enviados = 0;
    for (const a of avisos) enviados += await enviarAviso(uid, a).catch(() => 0);
    res.json({ ok: true, avisos: avisos.length, enviados });
  } catch (e: any) { falha(res, e); }
});

/** "Minha fila": o último resumo, se o computador está dando sinal e as preferências. */
filaRouter.get("/minha", async (req, res) => {
  try {
    const { uid } = await quem(req); await garantir();
    const [r]: any = await consultaSaude("SELECT resumo, ts, prefs FROM fila_resumo WHERE uid=?", [uid]);
    const [p]: any = await consultaSaude("SELECT COUNT(*) AS n FROM fila_push WHERE uid=?", [uid]);
    const ts = Number(r?.[0]?.ts || 0);
    const [cm]: any = await consultaSaude("SELECT id, tipo, ts, estado, resultado FROM fila_comandos WHERE uid=? ORDER BY ts DESC LIMIT 5", [uid]);
    const comandos = cm.map((c: any) => ({ id: c.id, tipo: c.tipo, ts: Number(c.ts), estado: c.estado === "pendente" || c.estado === "entregue" ? (comandoExpirado(Number(c.ts)) ? "expirado" : c.estado) : c.estado, resultado: c.resultado }));
    res.json({ comandos, resumo: lerResumo(r?.[0]?.resumo), ultimoSinal: ts, online: computadorOnline(ts), prefs: lerPrefs(r?.[0]?.prefs), aparelhos: Number(p?.[0]?.n || 0), minutosSemSinal: 15 });
  } catch (e: any) { falha(res, e); }
});

filaRouter.post("/prefs", async (req, res) => {
  try {
    const { uid, email } = await quem(req); await garantir();
    const prefs = lerPrefs(JSON.stringify(req.body?.prefs || {}));
    await consultaSaude("INSERT INTO fila_resumo (uid, email, resumo, ts, prefs) VALUES (?,?,?,0,?) ON DUPLICATE KEY UPDATE prefs=VALUES(prefs)", [uid, email.slice(0, 190), "{}", JSON.stringify(prefs)]);
    res.json({ ok: true, prefs });
  } catch (e: any) { falha(res, e); }
});

filaRouter.get("/push/chave", async (req, res) => { try { await quem(req); res.json({ chave: (await chaves()).publica }); } catch (e: any) { falha(res, e); } });

filaRouter.post("/push/assinar", async (req, res) => {
  try {
    const { uid } = await quem(req); await garantir();
    const s = req.body?.assinatura; if (!s || typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return void res.status(400).json({ erro: "assinatura inválida" });
    const [n]: any = await consultaSaude("SELECT COUNT(*) AS n FROM fila_push WHERE uid=?", [uid]); if (Number(n?.[0]?.n || 0) >= 10) return void res.status(400).json({ erro: "limite de 10 aparelhos por usuário" });
    const id = crypto.createHash("sha1").update(s.endpoint).digest("hex");
    await consultaSaude("INSERT INTO fila_push (id, uid, assinatura, ts) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid), assinatura=VALUES(assinatura), ts=VALUES(ts)", [id, uid, JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } }), Date.now()]);
    res.json({ ok: true });
  } catch (e: any) { falha(res, e); }
});

filaRouter.post("/push/remover", async (req, res) => {
  try { const { uid } = await quem(req); await garantir(); await consultaSaude("DELETE FROM fila_push WHERE id=? AND uid=?", [crypto.createHash("sha1").update(String(req.body?.endpoint || "")).digest("hex"), uid]); res.json({ ok: true }); } catch (e: any) { falha(res, e); }
});

/** Botão "Enviar aviso de teste" (para o usuário conferir que o celular recebe). */
filaRouter.post("/push/teste", async (req, res) => {
  try { const { uid } = await quem(req); const n = await enviarAviso(uid, { tipo: "concluida", titulo: "Aviso de teste", corpo: "Se você viu isto, o celular está recebendo os avisos da fila." }, true); res.json({ ok: true, enviados: n }); } catch (e: any) { falha(res, e); }
});


/** O celular manda um comando para a fila do computador (só os 3 seguros; vale por 10 minutos). */
filaRouter.post("/comando", async (req, res) => {
  try {
    const { uid } = await quem(req); await garantir();
    const tipo = req.body?.tipo; if (!comandoValido(tipo)) return void res.status(400).json({ erro: "comando inválido" });
    const agora = Date.now();
    const [rec]: any = await consultaSaude("SELECT COUNT(*) AS n FROM fila_comandos WHERE uid=? AND ts > ?", [uid, agora - 60_000]); if (Number(rec?.[0]?.n || 0) >= 10) return void res.status(429).json({ erro: "muitos comandos seguidos; espere um minuto" });
    const [rr]: any = await consultaSaude("SELECT ts FROM fila_resumo WHERE uid=?", [uid]);
    if (!computadorOnline(Number(rr?.[0]?.ts || 0), agora)) return void res.status(409).json({ erro: "o computador está sem sinal; o comando não chegaria. Confira se o Chrome e o Studio estão abertos." });
    const [dup]: any = await consultaSaude("SELECT id FROM fila_comandos WHERE uid=? AND tipo=? AND estado IN ('pendente','entregue') AND ts > ?", [uid, tipo, agora - 120_000]);
    if (dup?.[0]) return void res.json({ ok: true, id: dup[0].id, repetido: true });
    const id = crypto.randomBytes(16).toString("hex");
    await consultaSaude("INSERT INTO fila_comandos (id, uid, tipo, ts) VALUES (?,?,?,?)", [id, uid, tipo, agora]);
    res.json({ ok: true, id });
  } catch (e: any) { falha(res, e); }
});

/** O Studio aberto no COMPUTADOR (com a extensão) busca os comandos pendentes; cada um é entregue uma só vez e só se tiver menos de 10 minutos. */
filaRouter.get("/comandos/pendentes", async (req, res) => {
  try {
    const { uid } = await quem(req); await garantir();
    const [rows]: any = await consultaSaude("SELECT id, tipo, ts FROM fila_comandos WHERE uid=? AND estado='pendente' ORDER BY ts LIMIT 10", [uid]);
    const validos = rows.filter((c: any) => !comandoExpirado(Number(c.ts)));
    for (const c of rows) await consultaSaude("UPDATE fila_comandos SET estado=? WHERE id=?", [comandoExpirado(Number(c.ts)) ? "expirado" : "entregue", c.id]);
    res.json({ comandos: validos.map((c: any) => ({ id: c.id, tipo: c.tipo, ts: Number(c.ts) })) });
  } catch (e: any) { falha(res, e); }
});

filaRouter.post("/comandos/resultado", async (req, res) => {
  try {
    const { uid } = await quem(req); await garantir();
    const lista = Array.isArray(req.body?.resultados) ? req.body.resultados.slice(0, 10) : [];
    for (const r of lista) {
      if (!/^[0-9a-f]{32}$/.test(String(r?.id))) continue;
      await consultaSaude("UPDATE fila_comandos SET estado=?, resultado=?, ts_fim=? WHERE id=? AND uid=?", [r.ok === true ? "feito" : "falhou", String(r.mensagem || "").replace(/\s+/g, " ").slice(0, 200), Date.now(), String(r.id), uid]);
    }
    res.json({ ok: true });
  } catch (e: any) { falha(res, e); }
});

/** A cada minuto: quem tem trabalho pendente e a extensão calou há mais de 15 minutos recebe UM aviso ("o computador parou de responder"). */
async function vigiar(): Promise<void> {
  await garantir();
  const [rows]: any = await consultaSaude("SELECT uid, resumo, ts FROM fila_resumo WHERE avisado_parou=0 AND ts > 0 AND ts < ? AND ts > ? LIMIT 200", [Date.now() - 15 * 60_000, Date.now() - 24 * 3_600_000]);
  for (const r of rows) {
    const resumo = lerResumo(r.resumo); if (!resumo || !computadorSemSinal(resumo, Number(r.ts))) continue;
    await consultaSaude("UPDATE fila_resumo SET avisado_parou=1 WHERE uid=?", [r.uid]);
    await enviarAviso(String(r.uid), { tipo: "parou", titulo: "O computador parou de responder", corpo: "A fila tem processos pendentes, mas a extensão está sem sinal há mais de 15 minutos. O computador pode ter dormido ou o Chrome fechado." }).catch(() => 0);
  }
}
export function iniciarFilaCelular(): void {
  if (iniciada) return; iniciada = true;
  aoLimparSaude(async (limite) => { await garantir(); const [r]: any = await consultaSaude("DELETE FROM fila_resumo WHERE ts < ? AND ts > 0", [limite]); const [c]: any = await consultaSaude("DELETE FROM fila_comandos WHERE ts < ?", [limite]); return (r?.affectedRows || 0) + (c?.affectedRows || 0); });      // resumos de quem sumiu há 30 dias
  setInterval(() => { vigiar().catch(() => {}); }, 60_000).unref?.();
}
