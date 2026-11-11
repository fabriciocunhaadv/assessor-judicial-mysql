// Banco de mentira que GUARDA as linhas das tabelas history e history_index (em memória) e o usuário super admin: para testar mover atos entre gabinetes.
const m = require("mysql2/promise");
const usuario = { id: "u-teste", email: "teste@tjgo.jus.br", name: "Usuário de Teste", password_hash: "x", role: "super_admin", status: "aprovado", tenant_id: "gabinete_default", must_change_password: 0, extras: "{}" };
const tabelas = { history: new Map(), history_index: new Map() };
global.__historia = tabelas;
const consulta = async (sql, args = []) => {
  if (/^\s*SELECT \* FROM users WHERE id=\?/i.test(sql)) return [[usuario], []];
  let r;
  if ((r = /INSERT INTO (history_index|history) \(tenant,id,unit_id,created_by,date,numero_limpo,atualizado_em,data\)/i.exec(sql))) {
    const [tenant, id, unit_id, created_by, date, numero_limpo, atualizado_em, data] = args;
    tabelas[r[1]].set(tenant + "|" + id, { tenant, id, unit_id, created_by, date, numero_limpo, atualizado_em, data }); return [{ affectedRows: 1 }, []];
  }
  if ((r = /^\s*DELETE FROM (history_index|history) WHERE tenant=\? AND id=\?/i.exec(sql))) { const ok = tabelas[r[1]].delete(args[0] + "|" + args[1]); return [{ affectedRows: ok ? 1 : 0 }, []]; }
  if (/^\s*SELECT data FROM history WHERE tenant=\? AND id=\?/i.test(sql)) { const x = tabelas.history.get(args[0] + "|" + args[1]); return [x ? [{ data: x.data }] : [], []]; }
  if (/^\s*SELECT data FROM history WHERE tenant=\? AND numero_limpo=\?/i.test(sql)) return [[...tabelas.history.values()].filter((x) => x.tenant === args[0] && x.numero_limpo === args[1]).map((x) => ({ data: x.data })), []];
  if (/^\s*SELECT/i.test(sql)) return [[], []];
  return [{ affectedRows: 0 }, []];
};
const conexao = { query: consulta, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
m.createPool = () => ({ query: consulta, getConnection: async () => conexao, end: async () => {} });
