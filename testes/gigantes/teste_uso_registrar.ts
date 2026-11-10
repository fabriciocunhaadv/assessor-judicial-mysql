// Confere a soma no documento do mês com um banco de mentira (sem MySQL)
const mem = new Map<string, any>(); const consultas: string[] = [];
const con: any = {
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  query: async (sql: string, a: any[] = []) => {
    consultas.push(sql.slice(0, 20));
    if (/^INSERT INTO docs/.test(sql)) { mem.set(a[0] + "|" + a[1], a[2]); return [{}]; }
    if (/^SELECT 1 FROM docs/.test(sql)) return [mem.has(a[0] + "|" + a[1]) ? [{ 1: 1 }] : []];
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
  // minuta feita em IA externa (ChatGPT/Gemini/Claude/Agaia) e entregue ao Studio: conta 1 execução, sem tokens; a mesma minuta avisada de novo não conta outra vez
  const ext = { tenant: "gabinete_default", uid: "u2", email: "fabia@tjgo.jus.br", nome: "Fábia", modulo: "ia_externa" as const, rotulo: "Minuta feita em Gemini", uso: { prompt: 0, saida: 0, total: 0, modelo: "Gemini", processo: "5153655-70.2026.8.09.0097" }, nativa: false, idLog: "ext-u2-5153655-100-abc" };
  await registrarUso(ext, pool); await registrarUso(ext, pool); await registrarUso({ ...ext, idLog: "ext-u2-outra" }, pool);
  const d2 = JSON.parse(mem.get(`gabinetes/gabinete_default/token_usage|${mes}`));
  ok(d2.users["fabia_tjgo_jus_br"].modules.ia_externa.requestCount === 2, "IA externa: duas minutas diferentes contadas, a repetida não");
  ok(d2.totalTokens === 3000 && d2.requestCount === 4, "IA externa não soma tokens, só execuções");
  const lx = [...mem.entries()].filter(([k]) => k.includes("usageLogs")).map(([, v]) => JSON.parse(v)).filter((l) => l.module === "ia_externa");
  ok(lx.length === 2 && lx[0].userEmail === "fabia@tjgo.jus.br" && lx[0].costBrl === 0, "registro de execução da IA externa");
  process.exit(falhas ? 1 : 0);
})();
