// Sobe o servidor com banco de mentira e chama as rotas do painel Saúde do sistema. Rodar: node testes/servidor/rodar_anexos.mjs
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
  const U = "http://localhost:3057/api/chamados/anexos";
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), exe = Buffer.from("MZ\x90\x00 programa");
  let r = await fetch(U, { method: "POST", headers: { ...h, "Content-Type": "image/png", "X-Nome": encodeURIComponent("print do erro.png") }, body: png }); let j = await r.json();
  ok(r.status === 200 && /^[0-9a-f]{32}$/.test(j.id) && j.tipo === "image/png" && j.nome === "print do erro.png", "POST anexo PNG aceito (200): " + JSON.stringify(j));
  r = await fetch(U, { method: "POST", headers: { ...h, "Content-Type": "image/png" }, body: exe }); ok(r.status === 400, "programa disfarçado de imagem recusado (400)");
  r = await fetch(U, { method: "POST", headers: { ...h, "Content-Type": "application/pdf" }, body: png }); ok(r.status === 400, "tipo que não confere recusado (400)");
  r = await fetch(U, { method: "POST", headers: { ...h, "Content-Type": "image/png" }, body: Buffer.concat([png, Buffer.alloc(4.5 * 1024 * 1024)]) }); ok(r.status === 413 || r.status === 400, "arquivo grande demais recusado (" + r.status + ")");
  r = await fetch(U, { method: "POST", headers: { "Content-Type": "image/png" }, body: png }); ok(r.status === 401, "sem login recusa (401)");
  r = await fetch(U + "/" + j.id, { headers: h }); ok(r.status === 200 || r.status === 404, "GET anexo responde (" + r.status + "; o banco de mentira não guarda o conteúdo)");
  r = await fetch(U + "/xyz", { headers: h }); ok(r.status === 400, "id inválido (400)");
  r = await fetch(U + "/" + j.id); ok(r.status === 401, "GET sem login recusa (401)");
  r = await fetch(U + "/" + j.id, { method: "DELETE", headers: h }); ok(r.status === 200, "DELETE (200)");
  r = await fetch("http://localhost:3057/api/saude/limpar", { method: "POST", headers: h }); j = await r.json(); ok(r.status === 200, "limpeza inclui os anexos: " + JSON.stringify(j));
} finally { try { process.kill(-srv.pid, 9); } catch {} }
if (falhas) { console.log(log.slice(-1500)); process.exit(1); } console.log("TUDO OK");
