// Coletor de súmulas e teses: rota só do Super Admin, grava no banco (de mentira), não repete na 2ª vez. Rodar: node testes/servidor/rodar_coletor.mjs
import { spawn } from "node:child_process";
import http from "node:http";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const ids = ["stf-sumulas", "stj-sumulas", "tnu-sumulas", "stf-teses", "stj-teses", "tnu-teses"];
const rota = { "/sumulas/stf": "stf-sumulas", "/sumulas/stj": "stj-sumulas", "/sumulas/tnu": "tnu-sumulas", "/teses/stf": "stf-teses", "/teses/stj": "stj-teses", "/teses/tnu": "tnu-teses" };
let acessos = 0;
const site = http.createServer((req, res) => { const id = rota[req.url]; if (!id) { res.writeHead(404); return res.end(); } acessos++; res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(readFileSync(path.join(raiz, `testes/fixtures/coletor/${id}.html`))); }).listen(8977);
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", PORTA_TESTE: "3091", COLETOR_SITE_BASE: "http://127.0.0.1:8977" };
const srv = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3091/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "Content-Type": "application/json" };
  const chamar = async (corpo) => { const r = await (await fetch("http://localhost:3091/api/coletar-precedentes", { method: "POST", headers: H, body: JSON.stringify(corpo) })).json(); for (let i = 0; i < 60; i++) { await espera(500); const st = await (await fetch(`http://localhost:3091/api/coletar-precedentes/${r.jobId}`, { headers: H })).json(); if (st.status !== "rodando") return st; } return { status: "demorou" }; };
  const lista = async () => (await (await fetch("http://localhost:3091/api/custom-precedents", { headers: H })).json()).precedents;
  const sem = await fetch("http://localhost:3091/api/coletar-precedentes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  ok(sem.status === 401 || sem.status === 403, `sem sessão não coleta (${sem.status})`);
  const antes = (await lista()).length;
  const sim = await chamar({ simular: true });
  ok(sim.status === "concluido" && sim.resultado.simulado && sim.resultado.totalNovos > 20, `simulação: entrariam ${sim.resultado?.totalNovos}`);
  ok((await lista()).length === antes, "simulação não gravou nada");
  const r1 = await chamar({});
  ok(r1.status === "concluido" && r1.resultado.totalNovos > 20 && r1.resultado.fontes.length === 6 && r1.resultado.fontes.every((f) => f.ok), `coleta: ${r1.mensagem}`);
  const depois = await lista();
  ok(depois.length === antes + r1.resultado.totalNovos, `o banco ganhou ${depois.length - antes} itens`);
  const col = depois.filter((p) => p.origem === "coletor_site_apoio");
  ok(col.length === r1.resultado.totalNovos && col.every((p) => p.avisoOrigem === "coletado do site de apoio, confira no tribunal" && p.anexadoPor), "itens marcados como coletados do site de apoio, com quem coletou");
  const r2 = await chamar({});
  ok(r2.status === "concluido" && r2.resultado.totalNovos === 0 && r2.resultado.totalJaExistiam >= r1.resultado.totalNovos, `2ª coleta: 0 novos, ${r2.resultado?.totalJaExistiam} já existiam`);
  ok((await lista()).length === depois.length, "2ª coleta não duplicou nada");
  ok(acessos === 18, `o servidor foi ao site 18 vezes (3 coletas × 6 fontes): ${acessos}`);
} finally { try { process.kill(-srv.pid); } catch {} site.close(); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
