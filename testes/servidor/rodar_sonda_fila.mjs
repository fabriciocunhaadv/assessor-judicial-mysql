// Fila do Google RETIDA (os modelos fortes nunca respondem): o 1º teste de cada modelo forte usa o limite cheio; depois, com o modelo em resfriamento, ele só é TESTADO com limite curto ("sonda"); fila retida não repete com a 2ª chave.
// Rodar: node testes/servidor/rodar_sonda_fila.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8984", PORTA_GEMINI: "8984", PORTA_TESTE: "3076", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000", GEMINI_FALSO_TRAVA: "gemini-3.8-flash,gemini-3.6-flash", TIMEOUT_MODELO_MS: "6000", TIMEOUT_SONDA_MS: "2000", GEMINI_FALSO_LOG: "0" };
const filhos = []; const logs = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env: base, stdio: ["ignore", "pipe", "pipe"], detached: true }); p.stdout.on("data", (d) => logs.push(String(d))); p.stderr.on("data", (d) => logs.push(String(d))); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const autos = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos do processo com petição inicial e contestação. ".repeat(40);
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]);
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3076/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const t0 = Date.now();
  const r = await fetch("http://localhost:3076/api/generate-minute", { method: "POST", headers: H, body: JSON.stringify({ processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 1 }) });
  const t = (await r.text()).trim(); let j = {}; try { j = JSON.parse(t); } catch {}
  const seg = (Date.now() - t0) / 1000, log = logs.join("");
  const limites = [...log.matchAll(/Modelo (gemini-3\.[68]-flash) \| Chave \d+\/\d+ \([^)]*\) \[Limite Fila: ([\d.]+)s(, sonda)?\]/g)].map((m) => ({ modelo: m[1], limite: Number(m[2]), sonda: !!m[3] }));
  console.log(`status ${r.status} em ${seg.toFixed(1)}s; tentativas nos modelos fortes:`, JSON.stringify(limites));
  ok(r.status === 200 && !j.error, "a minuta foi entregue mesmo com os modelos fortes travados");
  ok(limites.some((x) => !x.sonda && x.limite === 6), "a 1ª tentativa de cada modelo forte usa o limite cheio (6 s no teste)");
  ok(limites.some((x) => x.sonda && x.limite === 2), "depois, com o modelo em resfriamento, ele só é testado com a sonda curta (2 s no teste)");
  ok(!limites.some((x) => !x.sonda && x.limite === 2), "a sonda só vale com o modelo em resfriamento (nunca no 1º teste)");
  const lite = (log.match(/Modelo gemini-3\.1-flash-lite/g) || []).length;
  ok(lite >= 1, `no fim, sem modelo forte disponível, o modelo leve responde (${lite} tentativa(s))`);
  // fila retida (timeout) não repete com a 2ª chave do mesmo modelo: aqui há 1 só chave, então conferimos que NÃO houve mensagem de "mais uma chave" após timeout
  ok(!/Fila do Google retida[^\n]*\n[^\n]*503\/Fila Failover/.test(log), "fila retida não aciona o failover para a 2ª chave");
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
