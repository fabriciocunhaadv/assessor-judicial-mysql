// Google sobrecarregado (503) nos modelos FORTES nos primeiros 12 s: a minuta NÃO pode ser entregue pelo modelo leve (resumida); a esteira espera o modelo forte voltar.
// Rodar: node testes/servidor/rodar_espera_profundo.mjs   (demora ~1 min: o resfriamento do modelo é de 45 s)
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8987", PORTA_GEMINI: "8987", PORTA_TESTE: "3079", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000", GEMINI_FALSO_503_FORTES_SEG: "12" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env: base, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const autos = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos do processo com petição inicial e contestação. ".repeat(40);
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]);
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3079/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const t0 = Date.now();
  const r = await fetch("http://localhost:3079/api/generate-minute", { method: "POST", headers: H, body: JSON.stringify({ processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 1 }) });
  const t = (await r.text()).trim(); let j = {}; try { j = JSON.parse(t); } catch {}
  const seg = (Date.now() - t0) / 1000;
  const g = await (await fetch("http://127.0.0.1:8987/__geracao")).json();
  console.log(`status ${r.status} em ${seg.toFixed(1)}s; geração por modelo: ${g.lista.map((x) => x.modelo + "@" + Math.round(x.t / 1000) + "s").join(", ")}; erros 503 injetados: ${g.erros503}`);
  ok(r.status === 200 && !j.error, "a minuta foi entregue");
  ok(g.erros503 >= 2, `o Google simulado deu 503 nos modelos fortes (${g.erros503} vezes)`);
  ok(g.lista.length >= 1 && g.lista.every((x) => /^gemini-3\.(6|8)-flash$/.test(x.modelo)), "a minuta foi gerada SÓ por modelo forte (nenhuma pelo modelo leve)");
  ok(g.lista.every((x) => x.t >= 12000), "ela só saiu depois de o modelo forte voltar (esperou, em vez de aceitar o leve)");
  ok(!j.avisoProfundidade, "sem aviso de contingência (a minuta veio do modelo forte)");
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
