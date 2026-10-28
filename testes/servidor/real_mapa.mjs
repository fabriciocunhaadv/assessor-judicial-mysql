// TESTE COM IA REAL (não roda sozinho): sobe o servidor com banco de mentira e chama o Gemini de verdade, com as chaves em CHAVES_TESTE (separadas por vírgula, só no ambiente; nunca no arquivo).
// Uso: CHAVES_TESTE="k1,k2" PROC=/caminho/autos.txt node testes/servidor/real_mapa.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import path from "node:path";
const PORTA = process.env.PORTA_TESTE || "3100";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const chaves = String(process.env.CHAVES_TESTE || "").split(",").map((x) => x.trim()).filter(Boolean);
if (!chaves.length || !process.env.PROC) { console.log("faltam CHAVES_TESTE e PROC"); process.exit(2); }
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), COTA_PAUSA_MS: "20000", AUTOS_GRANDES_PAUSA_MS: "20000", PORTA_TESTE: PORTA }; delete env.GOOGLE_GEMINI_BASE_URL; delete env.CHAVES_TESTE;
const srv = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"] });
srv.stdout.on("data", (d) => process.env.VER_LOG && process.stdout.write(`[srv] ${d}`)); srv.stderr.on("data", () => {});
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://localhost:${PORTA}/api/native-key-info`)).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const cab = { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-gemini-api-key": chaves[0], "x-gemini-api-key-pool": JSON.stringify(chaves) };
  const texto = readFileSync(process.env.PROC, "utf8"); const t0 = Date.now();
  const r = await fetch(`http://localhost:${PORTA}/api/mapa-processo`, { method: "POST", headers: cab, body: JSON.stringify({ processText: texto }) });
  const bruto = await r.text(); let j = {}; try { j = JSON.parse(bruto.trim()); } catch { /* */ }
  console.log("HTTP", r.status, `${Math.round((Date.now() - t0) / 1000)}s`, "partes", j.partesLidas, "/", j.partesTotal, "tokens", JSON.stringify(j.usage));
  if (!j.mapa) { console.log("ERRO:", (j.error || bruto).slice(0, 400)); process.exit(1); }
  console.log("\n" + j.bloco);
} finally { srv.kill(); }
