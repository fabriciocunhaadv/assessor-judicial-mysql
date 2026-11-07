// Sobe o servidor com banco de mentira e chama as rotas do painel Saúde do sistema. Rodar: node testes/servidor/rodar_saude.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", PORTA_TESTE: "3057" };
const srv = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3057/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const h = { "Content-Type": "application/json", "X-Assessor-Sessao": token };
  let r = await fetch("http://localhost:3057/api/saude/evento", { method: "POST", headers: h, body: JSON.stringify({ eventos: [{ tipo: "retomada", modulo: "gigante", severidade: "info", mensagem: "retomou" }, { tipo: "servidor", modulo: "x", severidade: "erro", mensagem: "falso: o navegador não pode enviar este tipo" }] }) });
  ok(r.status === 200 && (await r.json()).ok, "POST /evento aceita (200)");
  r = await fetch("http://localhost:3057/api/saude/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  ok(r.status === 401, "POST /evento sem login recusa (401)");
  r = await fetch("http://localhost:3057/api/saude/resumo?horas=24", { headers: h }); const j = await r.json();
  ok(r.status === 200 && Array.isArray(j.tipos) && j.tipos.length === 8 && Array.isArray(j.serie) && j.serie.length === 24 && j.retencao?.dias === 30, "GET /resumo devolve a estrutura (200)");
  console.log("resumo:", JSON.stringify(j).slice(0, 300));
  r = await fetch("http://localhost:3057/api/saude/eventos?horas=24", { headers: h }); ok(r.status === 200 && Array.isArray((await r.json()).eventos), "GET /eventos (200)");
  r = await fetch("http://localhost:3057/api/saude/exportar", { headers: h }); ok(r.status === 200, "GET /exportar (200)");
  r = await fetch("http://localhost:3057/api/saude/limpar", { method: "POST", headers: h }); const lj = await r.json(); ok(r.status === 200 && typeof lj.eventos === "number", "POST /limpar (200): " + JSON.stringify(lj));
  r = await fetch("http://localhost:3057/api/saude/resumo"); ok(r.status === 401, "resumo sem login recusa (401)");
} finally { try { process.kill(-srv.pid, 9); } catch {} }
if (falhas) { console.log(log.slice(-1500)); process.exit(1); } console.log("TUDO OK");
