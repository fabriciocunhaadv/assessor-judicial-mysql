// Banco de mentira (memória) que entende as consultas das comparações de minutas: REGEXP na coleção, UPDATE por (col,id) e DELETE por prazo.
const m = require("mysql2/promise");
const usuario = { id: "u-teste", email: "teste@tjgo.jus.br", name: "Usuário de Teste", password_hash: "x", role: "super_admin", status: "aprovado", tenant_id: "gabinete_default", is_judge: 0, judge_titles: null, can_use_native_key: 1, must_change_password: 0, extras: "{}" };
const docs = new Map(); const k = (c, i) => c + "|" + i;
const rx = (r) => new RegExp(r);
const consulta = async (sql, args = []) => {
  if (/^\s*SELECT \* FROM users WHERE id=\?/i.test(sql)) return [[usuario], []];
  if (/INSERT INTO docs \(col,id,data,updated_at\) VALUES \(\?,\?,\?,\?\)/i.test(sql)) { docs.set(k(args[0], args[1]), { col: args[0], id: args[1], data: args[2], updated_at: args[3] - (/^VELHO/.test(args[1]) ? 40 * 86400000 : 0) }); return [{ affectedRows: 1 }, []]; }
  if (/^\s*UPDATE docs SET data=\? WHERE col=\? AND id=\?/i.test(sql)) { const d = docs.get(k(args[1], args[2])); if (d) d.data = args[0]; return [{ affectedRows: d ? 1 : 0 }, []]; }
  if (/^\s*DELETE FROM docs WHERE col REGEXP \? AND updated_at < \?/i.test(sql)) { let n = 0; for (const [kk, d] of [...docs]) if (rx(args[0]).test(d.col) && d.updated_at < args[1]) { docs.delete(kk); n++; } return [{ affectedRows: n }, []]; }
  if (/^\s*SELECT COUNT\(\*\) AS n FROM docs WHERE col REGEXP \? AND updated_at < \?/i.test(sql)) return [[{ n: [...docs.values()].filter((d) => rx(args[0]).test(d.col) && d.updated_at < args[1]).length }], []];
  if (/^\s*DELETE FROM docs WHERE col REGEXP \? AND id IN \(/i.test(sql)) { let n = 0; const ids = args.slice(1); for (const [kk, d] of [...docs]) if (rx(args[0]).test(d.col) && ids.includes(d.id)) { docs.delete(kk); n++; } return [{ affectedRows: n }, []]; }
  if (/^\s*DELETE FROM docs WHERE col REGEXP \?\s*$/i.test(sql)) { let n = 0; for (const [kk, d] of [...docs]) if (rx(args[0]).test(d.col)) { docs.delete(kk); n++; } return [{ affectedRows: n }, []]; }
  let g;
  if ((g = /^\s*SELECT ((?:col, )?(?:id, )?data) FROM docs WHERE col REGEXP \?( AND id=\?)?(?: ORDER BY updated_at DESC LIMIT (\?|\d+))?/i.exec(sql))) {
    let l = [...docs.values()].filter((d) => rx(args[0]).test(d.col) && (!g[2] || d.id === args[1])).sort((a, b) => b.updated_at - a.updated_at);
    const lim = g[3] ? (g[3] === "?" ? args[args.length - 1] : Number(g[3])) : null; if (lim) l = l.slice(0, lim);
    return [l.map((d) => ({ col: d.col, id: d.id, data: d.data })), []];
  }
  if (/^\s*SELECT/i.test(sql)) return [[], []];
  return [{ affectedRows: 0 }, []];
};
const conexao = { query: consulta, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
m.createPool = () => ({ query: consulta, getConnection: async () => conexao, end: async () => {} });
