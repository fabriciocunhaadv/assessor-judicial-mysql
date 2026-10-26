// LOGIN PRÓPRIO (sem Firebase): cadastro por formulário, aprovação pelo super admin, senha com hash (scrypt) e sessão assinada (JWT).
// Segredos SÓ em variáveis de ambiente: SESSION_SECRET (obrigatória), SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD (criam o super admin se ele ainda não existir).
import express from "express";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { banco, garantirEsquema } from "./historyRoutes";

export const authRouter = express.Router();

export interface UsuarioSessao { uid: string; email: string; name: string; role: string; superAdmin: boolean; tenant: string; row: any }
const GABINETES_PRINCIPAIS = ["", "gabinete_default", "default", "gab_rafael_machado", "rafael_machado", "montes_claros", "fazenda_nova", "principal", "gabinete_principal"];
export const tenantCanonico = (t: string) => (GABINETES_PRINCIPAIS.includes((t || "").toLowerCase().trim()) ? "gabinete_default" : String(t).trim());
export const SENHA_INICIAL = "12345678";      // senha padrão de quem recebe o acesso liberado pelo administrador; no primeiro acesso a pessoa é obrigada a trocá-la
const erro = (status: number, msg: string) => Object.assign(new Error(msg), { status });
/** Texto de erro para a tela: erros do sistema aparecem como são; falhas do banco viram uma dica de configuração (sem expor senha nem detalhes internos). */
export const mensagemDeErro = (e: any): string => {
  if (e?.status) return String(e.message).slice(0, 300);
  const m = String(e?.message || ""), c = String(e?.code || "");
  if (m.startsWith("Banco MySQL não configurado")) return "Banco MySQL não configurado: defina MYSQL_USER, MYSQL_PASSWORD e MYSQL_DATABASE nas variáveis de ambiente e reimplante.";
  if (c === "ER_ACCESS_DENIED_ERROR") return "O MySQL recusou o usuário ou a senha. Confira MYSQL_USER e MYSQL_PASSWORD.";
  if (c === "ER_BAD_DB_ERROR") return "O banco informado não existe. Confira MYSQL_DATABASE.";
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(c)) return "Não consegui conectar ao MySQL. Confira MYSQL_HOST (use localhost) e MYSQL_PORT (3306).";
  return "erro interno (veja os logs de execução do servidor)";
};

// ---------- esquema ----------
let usuariosPronto: Promise<void> | null = null;
export const garantirUsuarios = (): Promise<void> => (usuariosPronto ||= (async () => {
  const b = banco();
  await b.query(`CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY, email VARCHAR(190) NOT NULL, name VARCHAR(190) NOT NULL, password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(24) NOT NULL DEFAULT 'user', status VARCHAR(16) NOT NULL DEFAULT 'pendente', tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    is_judge TINYINT(1) NOT NULL DEFAULT 0, judge_title VARCHAR(190) NOT NULL DEFAULT '', can_use_native_key TINYINT(1) NOT NULL DEFAULT 0,
    allowed_units TEXT NULL, completed_tours TEXT NULL, extras LONGTEXT NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
    UNIQUE KEY ux_users_email (email), KEY ix_users_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  try { await b.query("ALTER TABLE users ADD COLUMN extras LONGTEXT NULL"); } catch { /* coluna já existe */ }
  try { await b.query("ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0"); } catch { /* coluna já existe */ }
  // cria o super admin só se NÃO existir (nunca altera um existente)
  const email = (process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim(), senha = process.env.SUPERADMIN_PASSWORD || "";
  if (email && senha) {
    const [r] = await b.query<any[]>("SELECT id FROM users WHERE email=?", [email]);
    // redefinição de emergência: só com SUPERADMIN_RESET_SENHA=sim nas variáveis de ambiente (quem controla o servidor); troca só a senha do super admin
    if (r.length && process.env.SUPERADMIN_RESET_SENHA === "sim") await b.query("UPDATE users SET password_hash=?, role='super_admin', status='aprovado', updated_at=? WHERE id=?", [hashSenha(senha), Date.now(), r[0].id]);
    if (!r.length) await b.query("INSERT INTO users (id,email,name,password_hash,role,status,tenant_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)", [crypto.randomUUID(), email, "Super Administrador", hashSenha(senha), "super_admin", "aprovado", "gabinete_default", Date.now(), Date.now()]);
  }
})().catch((e) => { usuariosPronto = null; throw e; }));

// ---------- senha e sessão ----------
const hashSenha = (s: string) => { const sal = crypto.randomBytes(16); return `scrypt$${sal.toString("hex")}$${crypto.scryptSync(s, sal, 64).toString("hex")}`; };
const confereSenha = (s: string, h: string) => {
  const [t, sal, hex] = String(h).split("$"); if (t !== "scrypt" || !sal || !hex) return false;
  const a = crypto.scryptSync(s, Buffer.from(sal, "hex"), 64), b = Buffer.from(hex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const segredo = () => { const s = process.env.SESSION_SECRET || ""; if (s.length < 32) throw erro(500, "SESSION_SECRET não configurada (mínimo 32 caracteres)."); return new TextEncoder().encode(s); };
const criarToken = (uid: string) => new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(uid).setIssuedAt().setExpirationTime("7d").sign(segredo());

export const perfilPublico = (r: any) => ({
  ...(r.extras ? JSON.parse(r.extras) : {}),
  uid: r.id, email: r.email, name: r.name, role: r.role === "super_admin" ? "admin" : r.role, superAdmin: r.role === "super_admin", isActive: r.status === "aprovado",
  isJudge: !!r.is_judge, judgeTitle: r.judge_title || "", tenantId: r.tenant_id || "unassigned", canUseNativeKey: !!r.can_use_native_key, mustChangePassword: !!r.must_change_password,
  allowedUnits: r.allowed_units ? JSON.parse(r.allowed_units) : [], completedTours: r.completed_tours ? JSON.parse(r.completed_tours) : [], createdAt: Number(r.created_at),
});

/** Confere o token e o cadastro no banco A CADA chamada (desativar um usuário vale na hora). */
/** Porteiro das rotas /api que não são de login nem do banco (análises, Lupa, Mesa, Turbo, chat...): sem sessão válida, nada roda (e a chave do Gemini do servidor não fica exposta). */
export const exigirSessao: express.RequestHandler = async (req: any, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/db/") || req.path === "/native-key-info" || req.path === "/legislacao-status" || req.path === "/legislacao-teste" || req.path === "/lookup-legislation") return next();      // diagnósticos só de leitura da consulta ao Planalto (texto de lei pública; com limite de uso em server.ts)      // essas rotas conferem a sessão sozinhas (ou só informam se existe chave do servidor)
  try {
    if (!req.headers["x-assessor-sessao"]) throw erro(401, "login necessário");
    req.usuarioSessao = await autenticarSessao(req);
    next();
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e), error: mensagemDeErro(e), codigo: e?.codigo }); }
};

export async function autenticarSessao(req: express.Request, opcoes: { permitirTrocaPendente?: boolean } = {}): Promise<UsuarioSessao> {
  await garantirUsuarios();
  const h = String(req.headers.authorization || ""), proprio = String(req.headers["x-assessor-sessao"] || "");
  const token = proprio || (h.startsWith("Bearer ") ? h.slice(7) : "");      // as demais rotas usam Authorization para chaves do Gemini; por isso há um cabeçalho próprio da sessão
  if (!token) throw erro(401, "login necessário");
  let uid: string;
  try { uid = String((await jwtVerify(token, segredo())).payload.sub); } catch (e: any) { if (e?.status) throw e; throw erro(401, "sessão inválida ou vencida"); }
  const [rows] = await banco().query<any[]>("SELECT * FROM users WHERE id=?", [uid]);
  const r = rows[0];
  if (!r || r.status !== "aprovado") throw erro(401, "acesso não autorizado");
  if (r.must_change_password && !opcoes.permitirTrocaPendente) throw Object.assign(erro(403, "Troque a senha inicial para continuar."), { codigo: "trocar_senha" });
  const superAdmin = r.role === "super_admin";
  const pedido = String(req.headers["x-tenant-id"] || "");
  const tenant = superAdmin && pedido ? tenantCanonico(pedido) : tenantCanonico(r.tenant_id);
  if (!superAdmin && pedido && tenantCanonico(pedido) !== tenant) throw erro(403, "este usuário não pertence a este gabinete");
  return { uid, email: r.email, name: r.name, role: r.role, superAdmin, tenant, row: r };
}

const rota = (f: (req: express.Request, res: express.Response) => Promise<any>): express.RequestHandler => async (req, res) => {
  try { await garantirUsuarios(); await f(req, res); }
  catch (e: any) { const s = e?.status || 500; if (s >= 500) console.error("[auth]", e?.code || "", e?.message || e); res.status(s).json({ erro: mensagemDeErro(e) }); }
};
const soSuperAdmin = async (req: express.Request) => { const u = await autenticarSessao(req); if (!u.superAdmin) throw erro(403, "somente o super administrador"); return u; };

// freio contra tentativa de senha: 8 erros em 15 minutos por e-mail+IP
const falhas = new Map<string, { n: number; ate: number }>();
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 190;

authRouter.post("/register", rota(async (req, res) => {
  const { name, email, password } = req.body || {};
  const em = String(email || "").toLowerCase().trim(), nome = String(name || "").trim();
  if (nome.length < 3 || nome.length > 190) throw erro(400, "Informe o nome completo.");
  if (!emailValido(em)) throw erro(400, "E-mail inválido.");
  if (String(password || "").length < 8) throw erro(400, "A senha precisa ter pelo menos 8 caracteres.");
  const [ex] = await banco().query<any[]>("SELECT id FROM users WHERE email=?", [em]);
  if (ex.length) throw erro(409, "Já existe um cadastro com este e-mail.");
  await banco().query("INSERT INTO users (id,email,name,password_hash,role,status,tenant_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)", [crypto.randomUUID(), em, nome, hashSenha(String(password)), "user", "pendente", "", Date.now(), Date.now()]);
  res.json({ ok: true, mensagem: "Cadastro recebido. Aguarde a aprovação do administrador para entrar." });
}));

authRouter.post("/login", rota(async (req, res) => {
  const em = String(req.body?.email || "").toLowerCase().trim(), chave = `${em}|${req.ip}`, f = falhas.get(chave);
  if (f && f.ate > Date.now() && f.n >= 8) throw erro(429, "Muitas tentativas. Tente de novo em alguns minutos.");
  const [rows] = await banco().query<any[]>("SELECT * FROM users WHERE email=?", [em]);
  const r = rows[0];
  if (!r || !confereSenha(String(req.body?.password || ""), r.password_hash)) {
    falhas.set(chave, { n: (f && f.ate > Date.now() ? f.n : 0) + 1, ate: Date.now() + 15 * 60_000 });
    throw erro(401, "E-mail ou senha incorretos.");
  }
  if (r.status === "pendente") throw erro(403, "Seu cadastro ainda aguarda a aprovação do administrador.");
  if (r.status !== "aprovado") throw erro(403, "Acesso não autorizado. Fale com o administrador.");
  falhas.delete(chave);
  res.json({ token: await criarToken(r.id), perfil: perfilPublico(r) });
}));

/** Onde estão os dados: todos veem o motor e a hospedagem; o super admin vê também o nome do banco, o servidor e quanto há em cada tabela. */
authRouter.get("/banco", rota(async (req, res) => {
  const u = await autenticarSessao(req);
  const base = { motor: "MySQL", hospedagem: "Hostinger" };
  const dono = (process.env.SUPERADMIN_EMAIL || "fabriciocunha.adv@gmail.com").toLowerCase().trim();
  if (!u.superAdmin || String(u.email || "").toLowerCase().trim() !== dono) throw erro(403, "informação restrita ao super administrador");
  await garantirEsquema().catch(() => {});
  const conta = async (t: string) => { try { return Number(((await banco().query<any[]>(`SELECT COUNT(*) n FROM ${t}`))[0] as any[])[0].n); } catch { return 0; } };      // tabela ainda não criada = 0
  const [cad] = await banco().query<any[]>("SELECT status, COUNT(*) n FROM users GROUP BY status");
  res.json({
    ...base, banco: process.env.MYSQL_DATABASE || "", servidor: process.env.MYSQL_HOST || "localhost",
    cadastros: { tabela: "users", porSituacao: Object.fromEntries(cad.map((r) => [r.status, Number(r.n)])) },
    tabelas: [
      { nome: "users", descricao: "cadastros e logins", linhas: await conta("users") },
      { nome: "history", descricao: "minutas completas do Histórico", linhas: await conta("history") },
      { nome: "history_index", descricao: "resumos leves da lista do Histórico", linhas: await conta("history_index") },
      { nome: "docs", descricao: "prompts, teses, paradigmas, agenda, gabinetes e demais configurações", linhas: await conta("docs") },
    ],
  });
}));

authRouter.get("/me", rota(async (req, res) => { const u = await autenticarSessao(req, { permitirTrocaPendente: true }); res.json({ perfil: perfilPublico(u.row) }); }));

authRouter.patch("/me", rota(async (req, res) => {
  const u = await autenticarSessao(req, { permitirTrocaPendente: true });
  if (Array.isArray(req.body?.completedTours) && !u.row.must_change_password) await banco().query("UPDATE users SET completed_tours=?, updated_at=? WHERE id=?", [JSON.stringify(req.body.completedTours.map(String).slice(0, 100)), Date.now(), u.uid]);
  if (typeof req.body?.nome === "string" && req.body.nome.trim().length >= 3) await banco().query("UPDATE users SET name=?, updated_at=? WHERE id=?", [req.body.nome.trim().slice(0, 190), Date.now(), u.uid]);
  if (req.body?.novaSenha) {
    if (!confereSenha(String(req.body.senhaAtual || ""), u.row.password_hash)) throw erro(403, "Senha atual incorreta.");
    if (String(req.body.novaSenha).length < 8) throw erro(400, "A nova senha precisa ter pelo menos 8 caracteres.");
    if (String(req.body.novaSenha) === SENHA_INICIAL) throw erro(400, "Escolha uma senha diferente da senha inicial.");
    await banco().query("UPDATE users SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?", [hashSenha(String(req.body.novaSenha)), Date.now(), u.uid]);
  }
  res.json({ ok: true });
}));

/** Liberar acesso por e-mail (super admin em qualquer gabinete; administrador só no próprio): cria o usuário já aprovado com a senha inicial padrão, que precisa ser trocada no primeiro acesso. */
authRouter.post("/convidar", rota(async (req, res) => {
  const adm = await autenticarSessao(req);
  const em = String(req.body?.email || "").toLowerCase().trim();
  if (!emailValido(em)) throw erro(400, "E-mail inválido.");
  const alvo = tenantCanonico(String(req.body?.tenantId || adm.tenant));
  if (!adm.superAdmin && !(adm.role === "admin" && alvo === tenantCanonico(adm.row.tenant_id))) throw erro(403, "Só o administrador do gabinete (ou o super administrador) libera acessos.");
  const [rows] = await banco().query<any[]>("SELECT * FROM users WHERE email=?", [em]);
  const r = rows[0], t = Date.now();
  if (!r) {
    await banco().query("INSERT INTO users (id,email,name,password_hash,role,status,tenant_id,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [crypto.randomUUID(), em, em.split("@")[0], hashSenha(SENHA_INICIAL), "user", "aprovado", alvo, 1, t, t]);
    return void res.json({ ok: true, criado: true, senhaInicial: SENHA_INICIAL });
  }
  if (r.role === "super_admin") throw erro(409, "Este e-mail é o do super administrador.");
  if (r.status === "aprovado" && tenantCanonico(r.tenant_id) === alvo) throw erro(409, "Este e-mail já é membro ativo deste gabinete.");
  // já havia cadastro (pedido pendente, recusado, desativado ou de outro gabinete): só libera e leva para o gabinete; a senha que a pessoa escolheu continua valendo
  await banco().query("UPDATE users SET status='aprovado', tenant_id=?, updated_at=? WHERE id=?", [alvo, t, r.id]);
  res.json({ ok: true, criado: false, senhaInicial: null });
}));

// ----- administração (super admin) -----
authRouter.get("/users", rota(async (req, res) => {
  await soSuperAdmin(req);
  const [rows] = await banco().query<any[]>("SELECT * FROM users ORDER BY FIELD(status,'pendente','aprovado','recusado','desativado'), created_at DESC LIMIT 500");
  // perfis trazidos do sistema antigo (por e-mail), para o super admin aprovar já com gabinete, papel e permissões de lá
  const [imp] = await banco().query<any[]>("SELECT id, data FROM docs WHERE col='perfis_importados'").catch(() => [[]] as any);
  const importados = new Map<string, any>((imp as any[]).map((d) => [d.id, JSON.parse(d.data)]));
  res.json({ usuarios: rows.map((r) => { const i = importados.get(r.email); return { ...perfilPublico(r), status: r.status, ...(i ? { perfilImportado: { tenantId: i.tenantId, role: i.role, isJudge: !!i.isJudge, judgeTitle: i.judgeTitle || "" } } : {}) }; }) });
}));

/** { acao: "aprovar" | "recusar" | "desativar" | "reativar", tenantId?, role?, isJudge?, judgeTitle?, allowedUnits? } */
authRouter.post("/users/:id/acao", rota(async (req, res) => {
  const adm = await soSuperAdmin(req), b = req.body || {};
  const [rows] = await banco().query<any[]>("SELECT * FROM users WHERE id=?", [req.params.id]);
  const r = rows[0]; if (!r) throw erro(404, "usuário não encontrado");
  if (r.role === "super_admin" && r.id !== adm.uid) throw erro(403, "o super administrador não pode ser alterado");
  if (r.id === adm.uid && ["recusar", "desativar"].includes(b.acao)) throw erro(400, "você não pode desativar a si mesmo");
  if (b.acao === "redefinir_senha") {
    await banco().query("UPDATE users SET password_hash=?, must_change_password=1, updated_at=? WHERE id=?", [hashSenha(SENHA_INICIAL), Date.now(), r.id]);
    return void res.json({ ok: true, senhaInicial: SENHA_INICIAL });
  }
  if (b.acao === "renomear") {      // o nome é só de exibição (o login é pelo e-mail); vale também para o próprio super administrador
    const nome = String(b.nome || "").trim().slice(0, 190);
    if (nome.length < 2) throw erro(400, "informe o nome (mínimo 2 letras)");
    await banco().query("UPDATE users SET name=?, updated_at=? WHERE id=?", [nome, Date.now(), r.id]);
    return void res.json({ ok: true, nome });
  }
  const status = { aprovar: "aprovado", reativar: "aprovado", recusar: "recusado", desativar: "desativado" }[b.acao as string];
  if (!status) throw erro(400, "ação desconhecida");
  const campos: string[] = ["status=?", "updated_at=?"], args: any[] = [status, Date.now()];
  if (b.acao === "aprovar" && b.usarImportado) {
    const [imp] = await banco().query<any[]>("SELECT data FROM docs WHERE col='perfis_importados' AND id=?", [r.email]);
    if (!imp.length) throw erro(404, "não há perfil importado para este e-mail");
    const i = JSON.parse(imp[0].data);
    Object.assign(b, { tenantId: b.tenantId || i.tenantId, role: i.role === "admin" ? "admin" : "user", isJudge: !!i.isJudge, judgeTitle: i.judgeTitle || "", canUseNativeKey: !!i.canUseNativeKey, allowedUnits: Array.isArray(i.allowedUnits) ? i.allowedUnits : undefined });
    const extras: any = {}; for (const k of ["customApiKey", "customApiKeys", "isCustomKeyActive", "activeKeyId", "keyTelemetry", "claudeApiKey", "provedorChat", "modeloClaude"]) if (i[k] !== undefined) extras[k] = i[k];
    if (Object.keys(extras).length) { campos.push("extras=?"); args.push(JSON.stringify({ ...(r.extras ? JSON.parse(r.extras) : {}), ...extras })); }
  }
  if (b.acao === "aprovar" || (b.acao === "reativar" && b.tenantId)) { campos.push("tenant_id=?"); args.push(tenantCanonico(String(b.tenantId || r.tenant_id || "gabinete_default"))); }
  if (b.role && ["user", "admin"].includes(b.role)) { campos.push("role=?"); args.push(b.role); }
  if (typeof b.isJudge === "boolean") { campos.push("is_judge=?"); args.push(b.isJudge ? 1 : 0); }
  if (typeof b.judgeTitle === "string") { campos.push("judge_title=?"); args.push(b.judgeTitle.slice(0, 190)); }
  if (typeof b.canUseNativeKey === "boolean") { campos.push("can_use_native_key=?"); args.push(b.canUseNativeKey ? 1 : 0); }
  if (Array.isArray(b.allowedUnits)) { campos.push("allowed_units=?"); args.push(JSON.stringify(b.allowedUnits.map(String))); }
  await banco().query(`UPDATE users SET ${campos.join(", ")} WHERE id=?`, [...args, r.id]);
  res.json({ ok: true });
}));
