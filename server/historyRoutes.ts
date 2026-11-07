// API do HISTÓRICO em MySQL (substitui as coleções history e history_index do Firestore).
// Login próprio (server/authRoutes.ts): o navegador manda a sessão (Authorization: Bearer) e o servidor confere no banco.
// Credenciais do banco SÓ em variáveis de ambiente (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).
import express from "express";
import mysql from "mysql2/promise";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { resumoLeve, digitosDoProcesso } from "../src/utils/historicoLeve";
import { aplicarUnidade, lerPedidoDeLote } from "../src/utils/mudarUnidade";

export const historyRouter = express.Router();

const LISTA_PADRAO = 40, LISTA_MAXIMA = 300, COMPLETO_MAXIMO = 200;


// ---------- banco ----------
let pool: mysql.Pool | null = null;
let esquemaPronto: Promise<void> | null = null;
export const banco = (): mysql.Pool => {
  if (!pool) {
    const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
    if (!MYSQL_USER || !MYSQL_DATABASE) throw new Error("Banco MySQL não configurado (defina MYSQL_USER, MYSQL_PASSWORD e MYSQL_DATABASE nas variáveis de ambiente).");
    pool = mysql.createPool({ host: MYSQL_HOST || "localhost", port: Number(MYSQL_PORT) || 3306, user: MYSQL_USER, password: MYSQL_PASSWORD || "", database: MYSQL_DATABASE, connectionLimit: 8, charset: "utf8mb4" });
  }
  return pool;
};
// só CRIA o que falta (CREATE TABLE IF NOT EXISTS): nunca altera nem apaga dados existentes
export const garantirEsquema = (): Promise<void> => (esquemaPronto ||= (async () => {
  const b = banco();
  await b.query(`CREATE TABLE IF NOT EXISTS history (
    tenant VARCHAR(64) NOT NULL, id VARCHAR(128) NOT NULL, unit_id VARCHAR(64) NOT NULL, created_by VARCHAR(128) NOT NULL DEFAULT '',
    date BIGINT NOT NULL DEFAULT 0, numero_limpo VARCHAR(32) NOT NULL DEFAULT '', atualizado_em BIGINT NOT NULL DEFAULT 0, data LONGTEXT NOT NULL,
    PRIMARY KEY (tenant, id), KEY ix_hist_numero (tenant, numero_limpo)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await b.query(`CREATE TABLE IF NOT EXISTS history_index (
    tenant VARCHAR(64) NOT NULL, id VARCHAR(128) NOT NULL, unit_id VARCHAR(64) NOT NULL, created_by VARCHAR(128) NOT NULL DEFAULT '',
    date BIGINT NOT NULL DEFAULT 0, numero_limpo VARCHAR(32) NOT NULL DEFAULT '', atualizado_em BIGINT NOT NULL DEFAULT 0, data MEDIUMTEXT NOT NULL,
    PRIMARY KEY (tenant, id), KEY ix_idx_unidade (tenant, unit_id, date), KEY ix_idx_criador (tenant, created_by), KEY ix_idx_numero (tenant, numero_limpo)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquemaPronto = null; throw e; }));

// ---------- autenticação (sessão própria: server/authRoutes.ts) ----------
interface Usuario { uid: string; email: string; superAdmin: boolean; tenant: string; ids: string[] }
const autenticar = async (req: express.Request): Promise<Usuario> => {
  const u = await autenticarSessao(req);
  let antigos: string[] = []; try { const x = JSON.parse(u.row?.extras || "{}").uidsAntigos; if (Array.isArray(x)) antigos = x.map(String).slice(0, 50); } catch { /* sem vínculo */ }
  return { uid: u.uid, email: u.email, superAdmin: u.superAdmin, tenant: u.tenant, ids: [u.uid, ...antigos] };      // ids: o do cadastro atual + os do sistema antigo vinculados pelo Super Admin
};
/** Minutas do usuário: as que têm algum dos ids dele OU o mesmo e-mail de autor (minutas do sistema antigo continuam dele mesmo com outro id). */
const condicaoMeus = (u: Usuario) => ({ sql: `(created_by IN (${u.ids.map(() => "?").join(",")}) OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(data,'$.creatorEmail')))=?)`, args: [...u.ids, String(u.email || "").toLowerCase()] });

// ---------- regras ----------
/** Filtro por autor: `criador` pode trazer vários ids separados por vírgula e `email` o e-mail de autor; vale quem tiver qualquer um deles (a mesma pessoa pode ter ids diferentes, o e-mail do login é o que a identifica). */
const condicaoAutor = (criador: string, email: string, u: Usuario) => {
  if (!criador && !email) return null;
  if (criador === u.uid && !email) return condicaoMeus(u);
  const ids = criador.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50), partes: string[] = [], args: any[] = [];
  if (ids.length) { partes.push(`created_by IN (${ids.map(() => "?").join(",")})`); args.push(...ids); }
  if (email) { partes.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(data,'$.creatorEmail')))=?"); args.push(email.toLowerCase().trim()); }
  return { sql: `(${partes.join(" OR ")})`, args };
};
const ehDono = (u: Usuario, createdBy?: string | null) => u.superAdmin || !createdBy || createdBy === "anonymous" || u.ids.includes(createdBy);
const unidadeDe = (req: express.Request) => String(req.query.unit || "montes_claros");
const agora = () => Date.now();

const limparNaoDefinidos = (o: any): any => JSON.parse(JSON.stringify(o ?? null));

export async function gravarAtoDoTenant(tenant: string, ato: any) {
  const b = banco();
  const numeroLimpo = digitosDoProcesso(ato.processNumber || ato.result?.minute?.processNumber).slice(0, 32);
  const linha = { id: String(ato.id), unit: String(ato.unitId || "montes_claros"), criador: String(ato.createdBy || ""), data: Number(ato.date) || 0 };
  const t = agora();
  await b.query(
    `INSERT INTO history (tenant,id,unit_id,created_by,date,numero_limpo,atualizado_em,data) VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE unit_id=VALUES(unit_id), created_by=VALUES(created_by), date=VALUES(date), numero_limpo=VALUES(numero_limpo), atualizado_em=VALUES(atualizado_em), data=VALUES(data)`,
    [tenant, linha.id, linha.unit, linha.criador, linha.data, numeroLimpo, t, JSON.stringify(ato)]);
  await b.query(
    `INSERT INTO history_index (tenant,id,unit_id,created_by,date,numero_limpo,atualizado_em,data) VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE unit_id=VALUES(unit_id), created_by=VALUES(created_by), date=VALUES(date), numero_limpo=VALUES(numero_limpo), atualizado_em=VALUES(atualizado_em), data=VALUES(data)`,
    [tenant, linha.id, linha.unit, linha.criador, linha.data, numeroLimpo, t, JSON.stringify(resumoLeve(ato, "mysql"))]);
}
const gravarAto = (u: Usuario, ato: any) => gravarAtoDoTenant(u.tenant, ato);

async function lerAto(u: Usuario, id: string): Promise<any | null> {
  const [rows] = await banco().query<any[]>("SELECT data FROM history WHERE tenant=? AND id=?", [u.tenant, id]);
  return rows.length ? JSON.parse(rows[0].data) : null;
}
const atosDoProcesso = async (u: Usuario, processNumber: string): Promise<any[]> => {
  const limpo = digitosDoProcesso(processNumber);
  const [rows] = limpo.length >= 5
    ? await banco().query<any[]>("SELECT data FROM history WHERE tenant=? AND numero_limpo=?", [u.tenant, limpo])
    : await banco().query<any[]>("SELECT data FROM history WHERE tenant=? AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.processNumber'))=?", [u.tenant, processNumber]);
  return rows.map((r) => JSON.parse(r.data));
};
const mesclarMinuta = (ato: any, campos: Record<string, any>) =>
  ato.result ? { ...ato.result, minute: { ...ato.result.minute, ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v)) } } : undefined;

// ---------- rotas ----------
const rota = (f: (req: express.Request, res: express.Response, u: Usuario) => Promise<any>): express.RequestHandler => async (req, res) => {
  try { const u = await autenticar(req); await garantirEsquema(); await f(req, res, u); }
  catch (e: any) {
    const status = e?.status || 500;
    if (status >= 500) console.error("[history]", e?.message || e);
    res.status(status).json({ erro: mensagemDeErro(e) });
  }
};

/** Lista leve (resumos). ?unit= &criador= &numeros=a,b &limite= (padrão 40) &antes=<date> (próxima página) &completo=1 (atos inteiros, pesado). */
historyRouter.get("/", rota(async (req, res, u) => {
  const unit = unidadeDe(req), criador = String(req.query.criador || ""), numeros = String(req.query.numeros || "").split(",").map(digitosDoProcesso).filter((n) => n.length >= 7).slice(0, 10);
  const completo = req.query.completo === "1";
  const limite = Math.max(1, Math.min(Number(req.query.limite) || LISTA_PADRAO, completo ? COMPLETO_MAXIMO : LISTA_MAXIMA));
  const antes = Number(req.query.antes) || 0;
  const tabela = completo ? "history" : "history_index";
  const onde = ["tenant=?", "unit_id=?"], args: any[] = [u.tenant, unit];
  { const c = condicaoAutor(criador, String(req.query.email || ""), u); if (c) { onde.push(c.sql); args.push(...c.args); } }
  if (numeros.length) { onde.push(`numero_limpo IN (${numeros.map(() => "?").join(",")})`); args.push(...numeros); }
  if (antes) { onde.push("date<?"); args.push(antes); }
  const [rows] = await banco().query<any[]>(`SELECT id, data FROM ${tabela} WHERE ${onde.join(" AND ")} ORDER BY date DESC LIMIT ?`, [...args, limite + 1]);
  const itens = rows.slice(0, limite).map((r) => ({ ...JSON.parse(r.data), id: r.id }));
  res.json({ itens, temMais: rows.length > limite });
}));

/** Assinatura barata da lista (quantidade + última alteração): o navegador só baixa a lista de novo quando ela muda. */
historyRouter.get("/assinatura", rota(async (req, res, u) => {
  const criador = String(req.query.criador || "");
  const c = condicaoAutor(criador, String(req.query.email || ""), u);      // "minhas": ids do usuário (inclusive os antigos) ou o mesmo e-mail de autor
  const [rows] = await banco().query<any[]>(`SELECT COUNT(*) n, COALESCE(MAX(atualizado_em),0) ultima FROM history_index WHERE tenant=? AND unit_id=?${c ? ` AND ${c.sql}` : ""}`, [u.tenant, unidadeDe(req), ...(c ? c.args : [])]);
  res.json({ n: Number(rows[0].n), ultima: Number(rows[0].ultima) });
}));

/** Dono e unidade do ato (confere gravação e permissão de excluir sem baixar a minuta). */
historyRouter.get("/:id/meta", rota(async (req, res, u) => {
  const [rows] = await banco().query<any[]>("SELECT unit_id, created_by FROM history_index WHERE tenant=? AND id=?", [u.tenant, req.params.id]);
  res.json(rows.length ? { existe: true, unitId: rows[0].unit_id, createdBy: rows[0].created_by || undefined } : { existe: false });
}));

/** Minuta completa (só ao abrir o ato). */
historyRouter.get("/:id", rota(async (req, res, u) => {
  const ato = await lerAto(u, req.params.id);
  if (!ato) return void res.status(404).json({ erro: "ato não encontrado" });
  res.json({ ...ato, id: req.params.id });
}));

historyRouter.put("/:id", rota(async (req, res, u) => {
  const ato = req.body || {};
  if (!ato.id || ato.id !== req.params.id) throw Object.assign(new Error("ato sem identificador"), { status: 400 });
  if (ato.leve) throw Object.assign(new Error("ato em versão resumida não pode ser gravado por cima do completo"), { status: 400 });
  if (!ato.processNumber && !ato.result) throw Object.assign(new Error("ato sem processo e sem resultado"), { status: 400 });
  const existente = await lerAto(u, ato.id);
  // a marca "lançado no Projudi" não se perde quando o ato é regravado
  if (ato.lancadoProjudi === undefined && existente?.lancadoProjudi !== undefined) ato.lancadoProjudi = existente.lancadoProjudi;
  await gravarAto(u, limparNaoDefinidos({ ...ato, tenant: u.tenant, unitId: ato.unitId || unidadeDe(req), createdBy: ato.createdBy || u.uid, creatorEmail: ato.creatorEmail || u.email }));
  res.json({ ok: true });
}));

/** Alterações pontuais de um ato: { op: "lancado" | "unidade" | "categoria" | "chat", ... } */
historyRouter.patch("/:id", rota(async (req, res, u) => {
  const ato = await lerAto(u, req.params.id);
  if (!ato) return void res.json({ ok: false });
  const b = req.body || {};
  if (b.op === "lancado") ato.lancadoProjudi = b.quando ?? null;
  else if (b.op === "unidade") {
    if (b.unitId) ato.unitId = b.unitId;
    const r = mesclarMinuta(ato, { judicialUnit: b.judicialUnit, comarca: b.comarca, vara: b.vara }); if (r) ato.result = r;
  } else if (b.op === "categoria") {
    ato.promptCategory = b.promptCategory;
    const r = mesclarMinuta(ato, { vara: b.vara }); if (r) ato.result = r;
  } else if (b.op === "chat") {
    ato.chatMessages = b.chatMessages || [];
    if ((b.minute || b.versions) && ato.result) {
      const original = ato.result.originalMinute || ato.originalMinute || ato.result.minute;
      const versoes = b.versions || ato.result.versions || ato.versions || [];
      ato.result = { ...ato.result, originalMinute: original, versions: versoes, ...(b.minute ? { minute: b.minute } : {}) };
      if (!ato.originalMinute && original) ato.originalMinute = original;
      if (versoes.length) ato.versions = versoes;
    }
  } else throw Object.assign(new Error("operação desconhecida"), { status: 400 });
  await gravarAto(u, limparNaoDefinidos(ato));
  res.json({ ok: true });
}));

/** Mesma alteração em todos os atos de um processo: { op: "unidade" | "categoria", processNumber, ... } */
historyRouter.post("/processo/atualizar", rota(async (req, res, u) => {
  const b = req.body || {};
  if (!b.processNumber) throw Object.assign(new Error("processo não informado"), { status: 400 });
  const atos = await atosDoProcesso(u, b.processNumber);
  for (const ato of atos) {
    if (b.op === "unidade") { ato.unitId = b.unitId; const r = mesclarMinuta(ato, { judicialUnit: b.judicialUnit, comarca: b.comarca, vara: b.vara }); if (r) ato.result = r; }
    else if (b.op === "categoria") { ato.promptCategory = b.promptCategory; const r = mesclarMinuta(ato, { vara: b.vara }); if (r) ato.result = r; }
    else throw Object.assign(new Error("operação desconhecida"), { status: 400 });
    await gravarAto(u, limparNaoDefinidos(ato));
  }
  res.json({ atualizados: atos.length });
}));

/** Super Admin: muda a comarca/unidade de vários atos (ids) e/ou de todos os atos de vários processos, de uma vez. { ids?, processos?, unitId, judicialUnit, comarca?, vara? } */
historyRouter.post("/lote/unidade", rota(async (req, res, u) => {
  if (!u.superAdmin) throw Object.assign(new Error("Somente o Super Administrador muda a comarca/unidade em lote."), { status: 403 });
  const p = lerPedidoDeLote(req.body);
  if ("erro" in p) throw Object.assign(new Error(p.erro), { status: 400 });
  const atos = new Map<string, any>();
  for (const id of p.ids) { const a = await lerAto(u, id); if (a) atos.set(String(a.id || id), a); }
  for (const num of p.processos) for (const a of await atosDoProcesso(u, num)) atos.set(String(a.id), a);
  for (const a of atos.values()) await gravarAto(u, limparNaoDefinidos(aplicarUnidade(a, p.destino)));      // um ato por vez: leve para o banco
  res.json({ atualizados: atos.size });
}));

/** Exclui o dossiê (só as minutas do próprio usuário) na unidade indicada. */
historyRouter.delete("/processo/:numero", rota(async (req, res, u) => {
  const alvo = unidadeDe(req), limpo = digitosDoProcesso(req.params.numero);
  const atos = (await atosDoProcesso(u, req.params.numero)).filter((a) => {
    const unid = a.unitId || "montes_claros";
    if (alvo !== "montes_claros" && unid !== alvo) return false;
    if (alvo === "montes_claros" && unid !== "montes_claros" && !!a.unitId) return false;
    return ehDono(u, a.createdBy) && (limpo.length >= 5 || a.processNumber === req.params.numero);
  });
  for (const a of atos) await apagarAto(u, a.id);
  res.json({ apagados: atos.length });
}));

export async function apagarAtoDoTenant(tenant: string, id: string) {
  await banco().query("DELETE FROM history WHERE tenant=? AND id=?", [tenant, id]);
  await banco().query("DELETE FROM history_index WHERE tenant=? AND id=?", [tenant, id]);
}
const apagarAto = (u: Usuario, id: string) => apagarAtoDoTenant(u.tenant, id);

historyRouter.delete("/:id", rota(async (req, res, u) => {
  const [rows] = await banco().query<any[]>("SELECT created_by FROM history_index WHERE tenant=? AND id=?", [u.tenant, req.params.id]);
  if (rows.length && !ehDono(u, rows[0].created_by)) throw Object.assign(new Error("Só quem gerou a minuta pode excluí-la. Esta minuta foi gerada por outro usuário do gabinete."), { status: 403 });
  await apagarAto(u, req.params.id);
  res.json({ ok: true });
}));
