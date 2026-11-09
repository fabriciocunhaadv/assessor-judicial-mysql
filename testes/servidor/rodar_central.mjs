// Sobe o servidor com banco de mentira e chama as rotas do Central de decisões. Rodar: node testes/servidor/rodar_central.mjs
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
  const U = "http://localhost:3057/api/central";
  let r = await fetch(U + "/resumo", { headers: h }); let j = await r.json();
  ok(r.status === 200 && Array.isArray(j.grupos) && Array.isArray(j.decisoes) && j.retencaoDias === 30, "GET /resumo devolve a estrutura (200): " + JSON.stringify(j).slice(0, 200));
  r = await fetch(U + "/resumo"); ok(r.status === 401, "sem login recusa (401)");
  r = await fetch(U + "/grupo", { method: "POST", headers: h, body: JSON.stringify({ assinatura: "a".repeat(40), status: "resolvido", nota: "causa: banco; falei com a@b.com" }) }); ok(r.status === 200, "POST /grupo grava status e nota (200)");
  r = await fetch(U + "/grupo", { method: "POST", headers: h, body: JSON.stringify({ assinatura: "xyz", status: "resolvido" }) }); ok(r.status === 400, "assinatura inválida recusada (400)");
  r = await fetch(U + "/grupo", { method: "POST", headers: h, body: JSON.stringify({ assinatura: "a".repeat(40), status: "qualquer" }) }); ok(r.status === 400, "status inválido recusado (400)");
  r = await fetch(U + "/dispensar", { method: "POST", headers: h, body: JSON.stringify({ chave: "f:pendentes", dias: 7 }) }); ok(r.status === 200, "POST /dispensar (200)");
  r = await fetch(U + "/dispensar", { method: "POST", headers: h, body: JSON.stringify({ chave: "../x" }) }); ok(r.status === 400, "chave inválida recusada (400)");
  r = await fetch(U + "/motores?dias=7", { headers: h }); j = await r.json();
  ok(r.status === 200 && Array.isArray(j.motores) && j.motores.length === 6 && j.motores.every((m) => typeof m.n === "number" && Array.isArray(j.motores[0].porDia)), "GET /motores devolve 6 motores (200)");
  r = await fetch(U + "/gabinetes", { headers: h }); j = await r.json(); ok(r.status === 200 && Array.isArray(j.gabinetes), "GET /gabinetes (200)");
  r = await fetch(U + "/extensao?dias=30", { headers: h }); j = await r.json(); ok(r.status === 200 && Array.isArray(j.iaExterna) && Array.isArray(j.versoes?.usuarios) && Array.isArray(j.erros), "GET /extensao (200)");
  for (const rota of ["motores", "gabinetes", "extensao"]) { r = await fetch(U + "/" + rota); ok(r.status === 401, rota + " sem login recusa (401)"); }
  r = await fetch("http://localhost:3057/api/saude/limpar", { method: "POST", headers: h }); const lj = await r.json(); ok(r.status === 200 && typeof lj.extras === "number", "limpeza inclui a Central (extras): " + JSON.stringify(lj));
} finally { try { process.kill(-srv.pid, 9); } catch {} }
if (falhas) { console.log(log.slice(-1500)); process.exit(1); } console.log("TUDO OK");
