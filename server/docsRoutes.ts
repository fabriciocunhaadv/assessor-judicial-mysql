// ARMAZÉM DE DOCUMENTOS em MySQL: no lugar do Firestore, para os módulos de configuração (prompts, teses, paradigmas, guia do PROJUDI,
// agenda, unidades, equipe, gabinetes, auditorias, chamados, medições...). Cada documento é um JSON numa tabela `docs`, identificado
// pelo caminho da coleção (ex.: "gabinetes/gabinete_default/prompts") e pelo id. A pasta "users" não fica aqui: é a tabela `users` do login.
// O cliente (src/lib/docstore.ts) fala a mesma "língua" do Firestore, então os módulos quase não mudam.
import express from "express";
import { banco, garantirEsquema, gravarAtoDoTenant, apagarAtoDoTenant } from "./historyRoutes";
import { autenticarSessao, mensagemDeErro, garantirUsuarios, perfilPublico, tenantCanonico, UsuarioSessao } from "./authRoutes";

export const docsRouter = express.Router();
const erro = (status: number, msg: string) => Object.assign(new Error(msg), { status });
const LIMITE_COLECAO = 20000;

let pronto: Promise<void> | null = null;
const garantirDocs = (): Promise<void> => (pronto ||= (async () => {
  await garantirUsuarios();
  await garantirEsquema();      // tabelas do Histórico (a pasta history do armazém usa)
  // só CRIA o que falta; nunca altera nem apaga dados
  await banco().query(`CREATE TABLE IF NOT EXISTS docs (
    col VARCHAR(255) NOT NULL, id VARCHAR(190) NOT NULL, data LONGTEXT NOT NULL, updated_at BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (col, id), KEY ix_docs_col_upd (col, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { pronto = null; throw e; }));

// ---------- caminhos e permissões ----------
/** Caminho da coleção com o gabinete em forma canônica (gabinetes primários antigos viram um só). */
const normalizarCol = (col: string): string => {
  const seg = String(col || "").split("/").filter(Boolean);
  if (!seg.length || seg.length % 2 === 0) throw erro(400, "caminho de coleção inválido");
  if (seg.some((x) => x.length > 190 || x === "." || x === "..")) throw erro(400, "caminho inválido");
  if (seg[0] === "gabinetes" && seg[1]) seg[1] = tenantCanonico(seg[1]);
  return seg.join("/");
};
const PRIVADAS = new Set(["history_index"]);      // o resumo leve é interno da API do Histórico
/** A pasta "history" de um gabinete é a tabela do Histórico (backups, restauração e métricas leem e gravam por aqui). Devolve o gabinete ou null. */
const gabineteDoHistorico = (col: string): string | null => { const m = /^gabinetes\/([^/]+)\/history$/.exec(col); return m ? m[1] : null; };
const podeLer = (u: UsuarioSessao, col: string): boolean => {
  const seg = col.split("/");
  if (seg[0] === "gabinetes") return !PRIVADAS.has(seg[2]) && (u.superAdmin || seg[1] === tenantCanonico(u.row.tenant_id));
  if (seg[0] === "system_snapshots" || seg[0] === "perfis_importados") return u.superAdmin;      // perfis importados têm chaves de API: só o super admin
  return true;
};
const podeEscrever = (u: UsuarioSessao, col: string): boolean => {
  const seg = col.split("/");
  if (seg[0] === "tenants" || seg[0] === "system_snapshots" || seg[0] === "perfis_importados") return u.superAdmin;
  if (seg[0] === "settings") return u.superAdmin;
  return podeLer(u, col);
};

// ---------- valores especiais (increment, arrayUnion...) e caminhos com ponto ----------
const ehFv = (v: any) => v && typeof v === "object" && typeof v.__fv === "string";
const resolverFv = (v: any, atual: any): any => {
  if (!ehFv(v)) {
    if (Array.isArray(v)) return v.map((x) => resolverFv(x, undefined));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolverFv(x, atual?.[k])]));
    return v;
  }
  if (v.__fv === "increment") return (typeof atual === "number" ? atual : 0) + Number(v.n || 0);
  if (v.__fv === "arrayUnion") { const a = Array.isArray(atual) ? [...atual] : []; for (const x of v.v || []) if (!a.some((y) => JSON.stringify(y) === JSON.stringify(x))) a.push(x); return a; }
  if (v.__fv === "serverTimestamp") return Date.now();
  if (v.__fv === "deleteField") return undefined;
  return undefined;
};
const mesclar = (atual: any, novo: any): any => {
  if (ehFv(novo)) return resolverFv(novo, atual);
  if (novo && typeof novo === "object" && !Array.isArray(novo)) {
    const base = atual && typeof atual === "object" && !Array.isArray(atual) ? { ...atual } : {};
    for (const [k, v] of Object.entries(novo)) { const r = mesclar(base[k], v); if (r === undefined) delete base[k]; else base[k] = r; }
    return base;
  }
  return resolverFv(novo, atual);
};
const definirCaminho = (obj: any, caminho: string, valor: any) => {
  const p = caminho.split("."); let o = obj;
  for (let i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== "object") o[p[i]] = {}; o = o[p[i]]; }
  const ult = p[p.length - 1], novo = resolverFv(valor, o[ult]);
  if (novo === undefined) delete o[ult]; else o[ult] = novo;
};
const valorEm = (obj: any, campo: string) => campo.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ---------- consulta ----------
const comparar = (a: any, b: any) => (a === b ? 0 : a === undefined || a === null ? -1 : b === undefined || b === null ? 1 : a < b ? -1 : 1);
const iguais = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const passa = (doc: { id: string; data: any }, [campo, op, alvo]: any[]): boolean => {
  const v = campo === "__name__" ? doc.id : valorEm(doc.data, campo);
  switch (op) {
    case "==": return iguais(v, alvo);
    case "!=": return v !== undefined && !iguais(v, alvo);
    case "<": return v !== undefined && v !== null && v < alvo;
    case "<=": return v !== undefined && v !== null && v <= alvo;
    case ">": return v !== undefined && v !== null && v > alvo;
    case ">=": return v !== undefined && v !== null && v >= alvo;
    case "in": return Array.isArray(alvo) && alvo.some((x) => iguais(v, x));
    case "not-in": return v !== undefined && Array.isArray(alvo) && !alvo.some((x) => iguais(v, x));
    case "array-contains": return Array.isArray(v) && v.some((x) => iguais(x, alvo));
    case "array-contains-any": return Array.isArray(v) && Array.isArray(alvo) && v.some((x) => alvo.some((y) => iguais(x, y)));
    default: throw erro(400, "operador de consulta desconhecido");
  }
};

// ---------- a coleção "users" é a tabela de usuários ----------
const CAMPOS_PRIVILEGIADOS = new Set(["role", "tenantId", "isActive", "isJudge", "judgeTitle", "canUseNativeKey", "allowedUnits", "isUnauthorized"]);
const CAMPOS_SECRETOS = ["customApiKey", "customApiKeys", "claudeApiKey"];
const linhaParaDoc = (r: any, quem: UsuarioSessao) => {
  const d: any = perfilPublico(r);
  if (!quem.superAdmin && quem.uid !== r.id && !(quem.role === "admin" && tenantCanonico(quem.row.tenant_id) === tenantCanonico(r.tenant_id))) for (const k of CAMPOS_SECRETOS) delete d[k];      // chave de API é de cada um
  return d;
};
const todosUsuarios = async (quem: UsuarioSessao) => {
  const [rows] = await banco().query<any[]>("SELECT * FROM users LIMIT 2000");
  return rows.map((r) => ({ id: r.id, data: linhaParaDoc(r, quem) }));
};
async function escreverUsuario(quem: UsuarioSessao, id: string, tipo: string, dados: any) {
  const [rows] = await banco().query<any[]>("SELECT * FROM users WHERE id=?", [id]);
  const r = rows[0];
  if (tipo === "delete") {
    if (!r) return;
    if (r.role === "super_admin" || r.id === quem.uid) throw erro(403, "este usuário não pode ser excluído");
    if (!quem.superAdmin && !(quem.role === "admin" && tenantCanonico(quem.row.tenant_id) === tenantCanonico(r.tenant_id))) throw erro(403, "sem permissão");
    await banco().query("DELETE FROM users WHERE id=?", [id]);
    return;
  }
  if (!r) throw erro(404, "usuário não encontrado (usuários se cadastram pelo formulário de entrada)");
  const ehEu = r.id === quem.uid, mesmoGab = tenantCanonico(quem.row.tenant_id) === tenantCanonico(r.tenant_id);
  const admDoGabinete = quem.role === "admin" && mesmoGab;
  if (!ehEu && !quem.superAdmin && !admDoGabinete) throw erro(403, "sem permissão");
  if (r.role === "super_admin" && !ehEu) throw erro(403, "o super administrador não pode ser alterado");
  const atual: any = linhaParaDoc(r, quem);
  let novo: any = { ...atual };
  if (tipo === "merge" || tipo === "set") novo = mesclar(atual, dados);      // o cadastro do usuário nunca é recriado por aqui: só os campos enviados mudam
  if (tipo === "update") for (const [k, v] of Object.entries(dados)) definirCaminho(novo, k, v);
  const mudouPriv = [...CAMPOS_PRIVILEGIADOS].some((k) => !iguais(novo[k], atual[k]));
  if (mudouPriv && !quem.superAdmin && !(admDoGabinete && !ehEu)) throw erro(403, "só o administrador altera papel, gabinete e permissões");
  if (mudouPriv && !quem.superAdmin && novo.tenantId !== atual.tenantId) throw erro(403, "só o super administrador muda o gabinete de um usuário");
  const campos: string[] = [], args: any[] = [];
  const col = (c: string, v: any) => { campos.push(`${c}=?`); args.push(v); };
  if (novo.name && novo.name !== atual.name) col("name", String(novo.name).slice(0, 190));
  if (novo.role !== atual.role && ["user", "admin"].includes(novo.role) && r.role !== "super_admin") col("role", novo.role);
  if (novo.isActive !== atual.isActive && r.role !== "super_admin") col("status", novo.isActive === false ? "desativado" : "aprovado");
  if (novo.isJudge !== atual.isJudge) col("is_judge", novo.isJudge ? 1 : 0);
  if (novo.judgeTitle !== atual.judgeTitle) col("judge_title", String(novo.judgeTitle || "").slice(0, 190));
  if (novo.canUseNativeKey !== atual.canUseNativeKey) col("can_use_native_key", novo.canUseNativeKey ? 1 : 0);
  if (!iguais(novo.allowedUnits, atual.allowedUnits)) col("allowed_units", JSON.stringify(novo.allowedUnits || []));
  if (!iguais(novo.completedTours, atual.completedTours)) col("completed_tours", JSON.stringify(novo.completedTours || []));
  if (novo.tenantId !== atual.tenantId && novo.tenantId && novo.tenantId !== "unassigned") col("tenant_id", tenantCanonico(novo.tenantId));
  // o que não tem coluna própria (chaves de API, telemetria...) fica em `extras`
  const proprios = new Set(["uid", "email", "name", "role", "superAdmin", "isActive", "isJudge", "judgeTitle", "tenantId", "canUseNativeKey", "allowedUnits", "completedTours", "createdAt", "id", "updatedAt"]);
  const extras = Object.fromEntries(Object.entries(novo).filter(([k]) => !proprios.has(k)));
  const extrasAntes = Object.fromEntries(Object.entries(atual).filter(([k]) => !proprios.has(k)));
  if (!iguais(extras, extrasAntes)) {
    // quem não é dono da conta nem administrador não pode ter apagado as chaves de API que nem enxergou
    for (const k of CAMPOS_SECRETOS) if (atual[k] === undefined && r.extras) { const guardado = JSON.parse(r.extras); if (guardado[k] !== undefined && extras[k] === undefined) extras[k] = guardado[k]; }
    col("extras", JSON.stringify(extras));
  }
  if (campos.length) { campos.push("updated_at=?"); args.push(Date.now()); await banco().query(`UPDATE users SET ${campos.join(", ")} WHERE id=?`, [...args, id]); }
}

// ---------- rotas ----------
const rota = (f: (req: express.Request, res: express.Response, u: UsuarioSessao) => Promise<any>): express.RequestHandler => async (req, res) => {
  try { const u = await autenticarSessao(req); await garantirDocs(); await f(req, res, u); }
  catch (e: any) { const s = e?.status || 500; if (s >= 500) console.error("[docs]", e?.message || e); res.status(s).json({ erro: mensagemDeErro(e) }); }
};
const carregarColecao = async (u: UsuarioSessao, col: string): Promise<{ id: string; data: any }[]> => {
  if (col === "users") return todosUsuarios(u);
  const gh = gabineteDoHistorico(col);
  if (gh) { const [h] = await banco().query<any[]>("SELECT id, data FROM history WHERE tenant=? LIMIT ?", [gh, LIMITE_COLECAO]); return h.map((r) => ({ id: r.id, data: JSON.parse(r.data) })); }
  const [rows] = await banco().query<any[]>("SELECT id, data FROM docs WHERE col=? LIMIT ?", [col, LIMITE_COLECAO]);
  return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
};

docsRouter.post("/get", rota(async (req, res, u) => {
  const seg = String(req.body?.path || "").split("/").filter(Boolean);
  if (seg.length < 2 || seg.length % 2) throw erro(400, "caminho de documento inválido");
  const id = seg.pop()!, col = normalizarCol(seg.join("/"));
  if (!podeLer(u, col)) throw erro(403, "sem permissão");
  if (col === "users") { const [r] = await banco().query<any[]>("SELECT * FROM users WHERE id=?", [id]); return void res.json(r.length ? { existe: true, data: linhaParaDoc(r[0], u) } : { existe: false }); }
  const gh = gabineteDoHistorico(col);
  const [rows] = gh ? await banco().query<any[]>("SELECT data FROM history WHERE tenant=? AND id=?", [gh, id]) : await banco().query<any[]>("SELECT data FROM docs WHERE col=? AND id=?", [col, id]);
  res.json(rows.length ? { existe: true, data: JSON.parse(rows[0].data) } : { existe: false });
}));

/** { col, where: [[campo, op, valor]], orderBy: [[campo, "asc"|"desc"]], limit, startAfterId, contar } */
docsRouter.post("/list", rota(async (req, res, u) => {
  const b = req.body || {}, col = normalizarCol(b.col);
  if (!podeLer(u, col)) throw erro(403, "sem permissão");
  let docs = await carregarColecao(u, col);
  for (const w of Array.isArray(b.where) ? b.where : []) docs = docs.filter((d) => passa(d, w));
  const ordem: [string, string][] = Array.isArray(b.orderBy) ? b.orderBy : [];
  if (ordem.length) {
    // documento sem o campo ordenado fica de fora (mesmo comportamento do Firestore)
    docs = docs.filter((d) => ordem.every(([c]) => c === "__name__" || valorEm(d.data, c) !== undefined));
    docs.sort((x, y) => { for (const [c, dir] of ordem) { const r = c === "__name__" ? comparar(x.id, y.id) : comparar(valorEm(x.data, c), valorEm(y.data, c)); if (r) return dir === "desc" ? -r : r; } return 0; });
  }
  if (b.startAfterId) { const i = docs.findIndex((d) => d.id === b.startAfterId); if (i >= 0) docs = docs.slice(i + 1); }
  if (b.contar) return void res.json({ count: docs.length });
  if (Number(b.limit) > 0) docs = docs.slice(0, Number(b.limit));
  res.json({ docs: docs.map((d) => ({ id: d.id, data: d.data })) });
}));

/** Assinatura barata da coleção (quantidade + última alteração): quem escuta só baixa de novo quando ela muda. */
docsRouter.post("/assinatura", rota(async (req, res, u) => {
  const col = normalizarCol(req.body?.col);
  if (!podeLer(u, col)) throw erro(403, "sem permissão");
  if (col === "users") { const [r] = await banco().query<any[]>("SELECT COUNT(*) n, COALESCE(MAX(updated_at),0) m FROM users"); return void res.json({ n: Number(r[0].n), m: Number(r[0].m) }); }
  const gh = gabineteDoHistorico(col);
  const [r] = gh ? await banco().query<any[]>("SELECT COUNT(*) n, COALESCE(MAX(atualizado_em),0) m FROM history WHERE tenant=?", [gh]) : await banco().query<any[]>("SELECT COUNT(*) n, COALESCE(MAX(updated_at),0) m FROM docs WHERE col=?", [col]);
  res.json({ n: Number(r[0].n), m: Number(r[0].m) });
}));

/** { ops: [{ tipo: "set" | "merge" | "update" | "delete", path, data }] } — tudo ou nada. */
docsRouter.post("/escrever", rota(async (req, res, u) => {
  const ops: any[] = Array.isArray(req.body?.ops) ? req.body.ops : [];
  if (!ops.length || ops.length > 500) throw erro(400, "lote inválido");
  const alvos = ops.map((o) => {
    const seg = String(o.path || "").split("/").filter(Boolean);
    if (seg.length < 2 || seg.length % 2) throw erro(400, "caminho de documento inválido");
    const id = seg.pop()!, col = normalizarCol(seg.join("/"));
    if (!["set", "merge", "update", "delete"].includes(o.tipo)) throw erro(400, "operação desconhecida");
    if (!podeEscrever(u, col)) throw erro(403, "sem permissão para gravar em " + col);
    return { col, id, tipo: o.tipo as string, data: o.data };
  });
  for (const a of alvos) {
    if (a.col === "users") { await escreverUsuario(u, a.id, a.tipo, a.data); continue; }
    const gh = gabineteDoHistorico(a.col);
    if (!gh) continue;
    const [h] = await banco().query<any[]>("SELECT data FROM history WHERE tenant=? AND id=?", [gh, a.id]);
    const atual = h.length ? JSON.parse(h[0].data) : undefined;
    if (a.tipo === "delete") {
      if (atual && !u.superAdmin && atual.createdBy && atual.createdBy !== "anonymous" && atual.createdBy !== u.uid) throw erro(403, "Só quem gerou a minuta pode excluí-la.");
      await apagarAtoDoTenant(gh, a.id); continue;
    }
    if (a.tipo === "update" && atual === undefined) throw erro(404, "documento não existe: " + a.col + "/" + a.id);
    let novo: any;
    if (a.tipo === "set") novo = mesclar({}, a.data ?? {});
    else if (a.tipo === "merge") novo = mesclar(atual ?? {}, a.data ?? {});
    else { novo = JSON.parse(JSON.stringify(atual)); for (const [k, v] of Object.entries(a.data || {})) definirCaminho(novo, k, v); }
    novo.id = a.id;
    await gravarAtoDoTenant(gh, novo);
  }
  const conn = await banco().getConnection();
  try {
    await conn.beginTransaction();
    for (const a of alvos) {
      if (a.col === "users" || gabineteDoHistorico(a.col)) continue;
      if (a.tipo === "delete") { await conn.query("DELETE FROM docs WHERE col=? AND id=?", [a.col, a.id]); continue; }
      const [rows] = await conn.query<any[]>("SELECT data FROM docs WHERE col=? AND id=? FOR UPDATE", [a.col, a.id]);
      const atual = rows.length ? JSON.parse(rows[0].data) : undefined;
      if (a.tipo === "update" && atual === undefined) throw erro(404, "documento não existe: " + a.col + "/" + a.id);
      let novo: any;
      if (a.tipo === "set") novo = mesclar({}, a.data ?? {});
      else if (a.tipo === "merge") novo = mesclar(atual ?? {}, a.data ?? {});
      else { novo = JSON.parse(JSON.stringify(atual)); for (const [k, v] of Object.entries(a.data || {})) definirCaminho(novo, k, v); }
      await conn.query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [a.col, a.id, JSON.stringify(novo), Date.now()]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ ok: true });
}));
