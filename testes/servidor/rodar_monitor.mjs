// Monitor só de leitura: token, desligado sem a variável, só GET, o resto de /api continua exigindo login. Rodar: node testes/servidor/rodar_monitor.mjs
import { spawn } from "node:child_process";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const TOKEN = "t".repeat(20) + "k".repeat(24);
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890" };
const filhos = []; const sobe = (porta, extra) => { const p = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], { cwd: raiz, env: { ...base, PORTA_TESTE: porta, ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("3096", { MONITOR_TOKEN: TOKEN }); sobe("3097", {});
  for (const porta of ["3096", "3097"]) for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${porta}/api/native-key-info`)).ok) break; } catch {} await espera(500); }
  const get = async (porta, rota, h = {}, metodo = "GET") => { const r = await fetch(`http://localhost:${porta}${rota}`, { method: metodo, headers: h }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
  let r = await get("3096", "/api/monitor/uso");
  ok(r.s === 401, `sem token: 401 (${r.s})`);
  r = await get("3096", "/api/monitor/uso", { "x-monitor-token": "errado".repeat(8) });
  ok(r.s === 401 && r.j.erro === "token inválido", "token errado: 401");
  r = await get("3096", `/api/monitor/uso?token=${TOKEN}`);
  ok(r.s === 401, "token na URL NÃO vale (só no cabeçalho)");
  r = await get("3096", "/api/monitor/uso?horas=24", { "x-monitor-token": TOKEN });
  ok(r.s === 200 && r.j.execucoes === 0 && Array.isArray(r.j.porModulo), `uso com token certo: 200 ${JSON.stringify(r.j).slice(0, 90)}`);
  r = await get("3096", "/api/monitor/saude", { authorization: `Bearer ${TOKEN}` });
  ok(r.s === 200 && Array.isArray(r.j.grupos), `saúde com Bearer: 200 (${r.s} ${JSON.stringify(r.j).slice(0, 80)})`);
  r = await get("3096", "/api/monitor/banco", { "x-monitor-token": TOKEN });
  ok(r.s === 200 && Array.isArray(r.j.tabelas), `banco: 200 (${r.s})`);
  r = await get("3096", "/api/monitor/uso", { "x-monitor-token": TOKEN }, "POST");
  ok(r.s === 405, "só leitura: POST recusado (405)");
  r = await get("3096", "/api/saude/resumo");
  ok(r.s === 401, "o resto de /api continua exigindo login (saude/resumo sem sessão: 401)");
  r = await get("3097", "/api/monitor/uso", { "x-monitor-token": TOKEN });
  ok(r.s === 404 && r.j.erro === "monitor desligado", "sem MONITOR_TOKEN no servidor a rota fica desligada (404)");
  r = await get("3097", "/api/monitor/uso");
  ok(r.s === 404, "desligado também sem credencial: 404");
} finally { for (const p of filhos) { try { process.kill(-p.pid); } catch {} } }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
