// Fila do Google travada no 1º modelo, com 2 chaves no pool: a minuta/ficha precisa SAIR e mede-se o tempo. Rodar: node testes/servidor/rodar_fila_travada.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const TO = 4000;
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8997", PORTA_GEMINI: "8997", PORTA_TESTE: "3058", TIMEOUT_MODELO_MS: String(TO), COTA_PAUSA_MS: "1", GEMINI_FALSO_TRAVA: process.env.TRAVA || "gemini-3.8-flash" };
const filhos = [];
const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3058/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const pool = JSON.stringify(["AIzaSyChaveReserva00000000000000000001"]);      // chave nativa (1ª) + 1 chave pessoal = 2 chaves
  const t0 = Date.now();
  const r = await fetch("http://localhost:3058/api/gigante-lote", { method: "POST", headers: { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true", "x-gemini-api-key-pool": pool }, body: JSON.stringify({ texto: "Trecho dos autos sobre cobrança. ".repeat(20), rotulo: "trecho 1" }) });
  const t = await r.text(), seg = (Date.now() - t0) / 1000; let j = null; try { j = JSON.parse(t.trim()); } catch {}
  console.log(`status ${r.status} em ${seg.toFixed(1)}s (limite por tentativa: ${TO / 1000}s)`, t.slice(0, 120));
  ok(r.status === 200 && j?.ficha, "a ficha foi ENTREGUE mesmo com a fila do 1º modelo travada");
  console.log(`TEMPO=${seg.toFixed(1)}`);
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
process.exit(falhas ? 1 : 0);
