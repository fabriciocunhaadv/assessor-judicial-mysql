// Fontes pendentes de ponta a ponta: cada motor alimenta a lista; CRUD; inclusão de arquivo vira "Outras leis". Rodar: node testes/servidor/rodar_prontidao.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8995", PORTA_GEMINI: "8995", PORTA_TESTE: "3060", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3060/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true" }, B = "http://localhost:3060";
  const disparar = (rota, corpo) => { const c = new AbortController(); setTimeout(() => c.abort(), 4000); return fetch(B + rota, { method: "POST", headers: H, body: JSON.stringify(corpo), signal: c.signal }).catch(() => null); };
  const autos = "Petição inicial de guarda. Movimentacao 1 : Petição Arquivo 1: inicial.pdf - Pag.1/1. ".repeat(30);
  const post = async (rota, corpo) => { const r = await fetch(B + rota, { method: "POST", headers: H, body: JSON.stringify(corpo) }); return r.status; };
  const contagem = async () => (await (await fetch("http://127.0.0.1:" + (env.PORTA_GEMINI) + "/__prontidao")).json());
  await post("/api/generate-minute", { processText: autos, customPromptText: "prompt", actType: "auto", executionStage: 1 });
  await post("/api/generate-minute", { processText: autos, customPromptText: "prompt", actType: "auto", executionStage: 2, stage1Snapshot: { processNumber: "5129546-88.2025.8.09.0100", relatorio: "R", fundamentacao: "F", dispositivo: "D" } });
  await post("/api/generate-minute-turbo", { processText: autos });
  await post("/api/audit-assessor-draft", { draftText: "Minuta de sentença julgando procedente o pedido.", processText: autos });
  const c = await contagem(); console.log("contagem:", JSON.stringify(c));
  ok(c.etapa1 >= 1, "1ª etapa leva a conferência de prontidão do ato");
  ok(c.etapa2 >= 1, "2ª etapa leva a conferência de prontidão do ato");
  ok(c.turbo >= 1, "Módulo Turbo leva a conferência de prontidão do ato");
  ok(c.lupa >= 1, "Lupa do Magistrado confere a prontidão do ato (ato prematuro / pendência não enfrentada)");
  ok(!c.outro, "nenhuma chamada de minuta sem identificação da etapa");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
