// Banco de mentira que GUARDA os documentos da tabela docs (em memória): para testar o que grava e lê (Fontes pendentes, Outras leis).
const m = require("mysql2/promise");
const usuario = { id: "u-teste", email: "teste@tjgo.jus.br", name: "Usuário de Teste", password_hash: "x", role: "super_admin", status: "aprovado", tenant_id: "gabinete_default", is_judge: 0, judge_titles: null, can_use_native_key: 1, must_change_password: 0, extras: "{}" };
const docs = new Map();
const consulta = async (sql, args = []) => {
  if (/^\s*SELECT \* FROM users WHERE id=\?/i.test(sql)) return [[usuario], []];
  if (/INSERT INTO docs \(col,id,data,updated_at\) VALUES \(\?,\?,\?,\?\)/i.test(sql)) { docs.set(args[0] + "|" + args[1], { col: args[0], id: args[1], data: args[2], updated_at: args[3] }); return [{ affectedRows: 1 }, []]; }
  if (/^\s*DELETE FROM docs WHERE col=\? AND id=\?/i.test(sql)) { const ok = docs.delete(args[0] + "|" + args[1]); return [{ affectedRows: ok ? 1 : 0 }, []]; }
  if (/^\s*SELECT (data|id, data) FROM docs WHERE col=\?( AND id=\?)?/i.test(sql)) {
    const col = args[0], id = /AND id=\?/i.test(sql) ? args[1] : null;
    return [[...docs.values()].filter((d) => d.col === col && (id === null || d.id === id)).map((d) => ({ id: d.id, data: d.data })), []];
  }
  if (/^\s*SELECT/i.test(sql)) return [[], []];
  return [{ affectedRows: 0 }, []];
};
const conexao = { query: consulta, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
m.createPool = () => ({ query: consulta, getConnection: async () => conexao, end: async () => {} });
