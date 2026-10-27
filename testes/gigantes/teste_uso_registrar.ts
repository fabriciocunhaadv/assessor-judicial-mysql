// Confere a soma no documento do mês com um banco de mentira (sem MySQL)
const mem = new Map<string, any>(); const consultas: string[] = [];
const con: any = {
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  query: async (sql: string, a: any[] = []) => {
    consultas.push(sql.slice(0, 20));
    if (/^INSERT INTO docs/.test(sql)) { mem.set(a[0] + "|" + a[1], a[2]); return [{}]; }
    if (/^SELECT data/.test(sql)) { const v = mem.get(a[0] + "|" + a[1]); return [v ? [{ data: v }] : []]; }
    return [[]];
  },
};
const pool: any = { getConnection: async () => con, query: async () => [[]] };
(async () => {
  const { registrarUso } = await import("../../server/usoNoServidor");
  let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
  const base = { tenant: "gabinete_default", uid: "u1", email: "Ana.Silva@tjgo.jus.br", nome: "Ana", modulo: "turbo" as const, rotulo: "Minuta Turbo", uso: { prompt: 1000, saida: 500, total: 1500, modelo: "flash", processo: "5033370" }, nativa: true };
  await registrarUso(base, pool); await registrarUso({ ...base, modulo: "minuta", nativa: false }, pool);
  const mes = new Date().toISOString().slice(0, 7);
  const d = JSON.parse(mem.get(`gabinetes/gabinete_default/token_usage|${mes}`));
  const u = d.users["ana_silva_tjgo_jus_br"];
  ok(d.totalTokens === 3000 && d.requestCount === 2, "total do mês soma as duas execuções");
  ok(u.requestCount === 2 && u.dailyRequests === 2 && u.totalTokens === 3000, "usuário: 2 requisições, 2 no dia");
  ok(d.modules.turbo.totalTokens === 1500 && d.modules.minuta.requestCount === 1, "por módulo");
  ok(u.modules.turbo.requestCount === 1 && u.userEmail === "Ana.Silva@tjgo.jus.br", "módulo do usuário e e-mail");
  ok(d.costBrl > 0 && d.costBrl < 0.01 && u.costBrl === d.costBrl, "custo só da chave nativa");
  const logs = [...mem.entries()].filter(([k]) => k.includes("usageLogs")).map(([, v]) => JSON.parse(v));
  ok(logs.length === 2 && logs[0].keyType === "native" && logs[1].keyType === "byok" && logs[1].costBrl === 0 && logs[0].userEmail, "dois registros de execução");
  process.exit(falhas ? 1 : 0);
})();
