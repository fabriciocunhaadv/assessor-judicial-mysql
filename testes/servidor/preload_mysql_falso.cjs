// Banco de mentira só para testes: responde ao cadastro do usuário de teste e devolve vazio para o resto (sem MySQL de verdade).
const m = require("mysql2/promise");
const usuario = { id: "u-teste", email: "teste@tjgo.jus.br", name: "Usuário de Teste", password_hash: "x", role: "super_admin", status: "aprovado", tenant_id: "gabinete_default", is_judge: 0, judge_title: "", can_use_native_key: 1, allowed_units: null, completed_tours: null, extras: null, must_change_password: 0, created_at: 1, updated_at: 1 };
const consulta = async (sql, args) => {
  if (/^\s*SELECT \* FROM users WHERE id=\?/i.test(sql)) return [[usuario], []];
  if (/^\s*SELECT/i.test(sql)) return [[], []];
  return [{ affectedRows: 0 }, []];
};
const conexao = { query: consulta, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
m.createPool = () => ({ query: consulta, getConnection: async () => conexao, end: async () => {} });
