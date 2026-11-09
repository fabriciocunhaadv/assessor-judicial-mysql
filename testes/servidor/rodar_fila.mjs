// Sobe o servidor com banco de mentira e chama as rotas do fila no celular. Rodar: node testes/servidor/rodar_fila.mjs
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
  const U = "http://localhost:3057/api/fila";
  const resumo = { total: 10, aguardando: 3, analisando: 1, concluidos: 6, erros: 0, pausados: 0, modo: "ia", ia: "Jusbrasil", versao: "1.0.96", ultimoErro: "falhou 5381285-41.2025.8.09.0166" };
  let r = await fetch(U + "/resumo", { method: "POST", headers: h, body: JSON.stringify({ resumo }) }); let j = await r.json();
  ok(r.status === 200 && j.ok === true && j.avisos === 0, "POST /resumo aceita (200): " + JSON.stringify(j));
  r = await fetch(U + "/resumo", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); ok(r.status === 401, "sem login recusa (401)");
  r = await fetch(U + "/minha", { headers: h }); j = await r.json(); ok(r.status === 200 && "resumo" in j && typeof j.online === "boolean" && j.prefs?.concluida === true && j.minutosSemSinal === 15, "GET /minha (200)");
  r = await fetch(U + "/minha"); ok(r.status === 401, "minha sem login recusa (401)");
  r = await fetch(U + "/push/chave", { headers: h }); j = await r.json(); ok(r.status === 200 && typeof j.chave === "string" && j.chave.length > 60, "chave pública VAPID (200)");
  r = await fetch(U + "/push/assinar", { method: "POST", headers: h, body: JSON.stringify({ assinatura: { endpoint: "http://inseguro", keys: {} } }) }); ok(r.status === 400, "assinatura inválida recusada (400)");
  r = await fetch(U + "/push/assinar", { method: "POST", headers: h, body: JSON.stringify({ assinatura: { endpoint: "https://push.exemplo.invalid/abc", keys: { p256dh: "BNc", auth: "xyz" } } }) }); ok(r.status === 200, "assinatura válida aceita (200)");
  r = await fetch(U + "/prefs", { method: "POST", headers: h, body: JSON.stringify({ prefs: { erro: false } }) }); j = await r.json(); ok(r.status === 200 && j.prefs.erro === false && j.prefs.concluida === true, "preferências (200)");
  r = await fetch(U + "/push/teste", { method: "POST", headers: h }); ok(r.status === 200, "aviso de teste responde (200) mesmo sem entrega");
  r = await fetch(U + "/push/remover", { method: "POST", headers: h, body: JSON.stringify({ endpoint: "https://push.exemplo.invalid/abc" }) }); ok(r.status === 200, "remover aparelho (200)");
  r = await fetch(U + "/comando", { method: "POST", headers: h, body: JSON.stringify({ tipo: "apagar_tudo" }) }); ok(r.status === 400, "comando fora dos 3 seguros recusado (400)");
  r = await fetch(U + "/comando", { method: "POST", headers: h, body: JSON.stringify({ tipo: "lancar_projudi" }) }); ok(r.status === 400, "lançar no Projudi não existe como comando (400)");
  r = await fetch(U + "/comando", { method: "POST", headers: h, body: JSON.stringify({ tipo: "pausar" }) }); ok(r.status === 409, "computador sem sinal: comando recusado com explicação (409; o banco de teste não guarda o resumo)");
  r = await fetch(U + "/comando", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "pausar" }) }); ok(r.status === 401, "comando sem login recusa (401)");
  r = await fetch(U + "/comandos/pendentes", { headers: h }); j = await r.json(); ok(r.status === 200 && Array.isArray(j.comandos), "GET /comandos/pendentes (200)");
  r = await fetch(U + "/comandos/pendentes"); ok(r.status === 401, "pendentes sem login recusa (401)");
  r = await fetch(U + "/comandos/resultado", { method: "POST", headers: h, body: JSON.stringify({ resultados: [{ id: "a".repeat(32), ok: true, mensagem: "Fila pausada." }, { id: "xyz", ok: true }] }) }); ok(r.status === 200, "POST /comandos/resultado (200)");
  r = await fetch(U + "/minha", { headers: h }); j = await r.json(); ok(Array.isArray(j.comandos), "minha traz a lista de comandos");
  r = await fetch("http://localhost:3057/api/saude/limpar", { method: "POST", headers: h }); j = await r.json(); ok(r.status === 200 && typeof j.extras === "number", "limpeza inclui a fila: " + JSON.stringify(j));
} finally { try { process.kill(-srv.pid, 9); } catch {} }
if (falhas) { console.log(log.slice(-1500)); process.exit(1); } console.log("TUDO OK");
