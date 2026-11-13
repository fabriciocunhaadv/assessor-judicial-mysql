// Banco de mentira que GUARDA as linhas das tabelas history e history_index (em memória) e o usuário super admin: para testar mover atos entre gabinetes.
const m = require("mysql2/promise");
const usuario = { id: "u-teste", email: "teste@tjgo.jus.br", name: "Usuário de Teste", password_hash: "x", role: "super_admin", status: "aprovado", tenant_id: "gabinete_default", must_change_password: 0, extras: "{}" };
const tabelas = { history: new Map(), history_index: new Map(), exclusoes: [], eventos: [] };
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
  if (/^\s*SELECT unit_id, created_by, date, data FROM history WHERE tenant=\? AND id=\?/i.test(sql)) { const x = tabelas.history.get(args[0] + "|" + args[1]); return [x ? [x] : [], []]; }
  if (/^\s*INSERT INTO history_exclusoes/i.test(sql)) { const [tenant, ato_id, unit_id, created_by, criador_email, processo, titulo, gerado_em, apagado_em, motivo, apagado_por] = args; tabelas.exclusoes.push({ tenant, ato_id, unit_id, created_by, email: criador_email, processo, titulo, gerado_em, apagado_em, motivo, apagado_por }); return [{ affectedRows: 1 }, []]; }
  if (/^\s*SELECT created_by, criador_email AS email, motivo, gerado_em, apagado_em FROM history_exclusoes/i.test(sql)) return [tabelas.exclusoes.filter((x) => x.apagado_em >= args[0] && x.apagado_em <= args[1]), []];
  if (/^\s*SELECT MIN\(apagado_em\) AS primeira FROM history_exclusoes/i.test(sql)) return [[{ primeira: tabelas.exclusoes.length ? Math.min(...tabelas.exclusoes.map((x) => x.apagado_em)) : null }], []];
  if (/^\s*SELECT id, email, name, role, status, tenant_id, can_use_native_key, extras FROM users/i.test(sql)) return [[{ ...usuario, extras: "{}", can_use_native_key: 0 }], []];
  if (/^\s*INSERT INTO history_eventos/i.test(sql)) { const [tenant, tipo, ato_id, processo, ator_email, dono_email, de_valor, para_valor, em] = args; tabelas.eventos.push({ tenant, tipo, ato_id, processo, ator_email, dono_email, de_valor, para_valor, em }); return [{ affectedRows: 1 }, []]; }
  if (/^\s*SELECT tipo, dono_email AS email, COUNT\(\*\) AS n, MAX\(em\) AS ultimo FROM history_eventos/i.test(sql)) { const m = new Map(); for (const e of tabelas.eventos.filter((x) => x.em >= args[0] && x.em <= args[1])) { const k = e.tipo + "|" + e.dono_email; const v = m.get(k) || { tipo: e.tipo, email: e.dono_email, n: 0, ultimo: 0 }; v.n++; v.ultimo = Math.max(v.ultimo, e.em); m.set(k, v); } return [[...m.values()], []]; }
  if (/^\s*SELECT tenant, processo, dono_email, ator_email, de_valor, para_valor, em FROM history_eventos WHERE tipo=\?/i.test(sql)) return [tabelas.eventos.filter((x) => x.tipo === args[0] && x.em >= args[1] && x.em <= args[2]).reverse(), []];
  if (/^\s*SELECT tenant, processo, titulo, criador_email, apagado_por, motivo, gerado_em, apagado_em FROM history_exclusoes/i.test(sql)) return [tabelas.exclusoes.filter((x) => x.apagado_em >= args[0] && x.apagado_em <= args[1]).map((x) => ({ tenant: x.tenant, processo: x.processo, titulo: x.titulo, criador_email: x.email, apagado_por: x.apagado_por, motivo: x.motivo, gerado_em: x.gerado_em, apagado_em: x.apagado_em })).reverse(), []];
  if (/^\s*SELECT/i.test(sql)) return [[], []];
  return [{ affectedRows: 0 }, []];
};
const conexao = { query: consulta, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
m.createPool = () => ({ query: consulta, getConnection: async () => conexao, end: async () => {} });
