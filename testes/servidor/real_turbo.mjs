// TESTE COM IA REAL: compara a minuta do Turbo COM e SEM o mapa do processo. Chaves só no ambiente (CHAVES_TESTE, separadas por vírgula).
// Uso: CHAVES_TESTE="k1,k2" PROC=/caminho/autos.txt [PROC_MAPA=/caminho/completo.txt] [ATO=auto] node testes/servidor/real_turbo.mjs
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { SignJWT } from "jose";
import path from "node:path";
const PORTA = process.env.PORTA_TESTE || "3101";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const chaves = String(process.env.CHAVES_TESTE || "").split(",").map((x) => x.trim()).filter(Boolean);
if (!chaves.length || !process.env.PROC) { console.log("faltam CHAVES_TESTE e PROC"); process.exit(2); }
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), COTA_PAUSA_MS: "30000", AUTOS_GRANDES_PAUSA_MS: "30000", PORTA_TESTE: PORTA }; delete env.GOOGLE_GEMINI_BASE_URL; delete env.CHAVES_TESTE;
const srv = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"] });
srv.stdout.on("data", (d) => process.env.VER_LOG && process.stdout.write(`[srv] ${d}`)); srv.stderr.on("data", () => {});
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const chamar = async (rota, cab, corpo) => { const r = await fetch(`http://localhost:${PORTA}${rota}`, { method: "POST", headers: cab, body: JSON.stringify(corpo) }); const t = await r.text(); let j = {}; try { j = JSON.parse(t.trim()); } catch { /* */ } return { status: r.status, j, t }; };
const resumo = (rot, r) => { console.log(`\n===== ${rot}: HTTP ${r.status} =====`); const m = r.j?.minute?.minute || r.j?.minute || {}; if (!r.j?.minute) { console.log("sem minuta:", String(r.j?.error || r.t).slice(0, 300), r.j?.codigo || ""); return; }
  console.log("TÍTULO:", m.title, "| ATO:", m.actType || m.decisionType); console.log("RELATÓRIO:\n" + String(m.relatorio || "").slice(0, 2200)); console.log("\nFUNDAMENTAÇÃO (início):\n" + String(m.fundamentacao || "").slice(0, 1500)); console.log("\nDISPOSITIVO:\n" + String(m.dispositivo || "").slice(0, 1800));
  writeFileSync(`/tmp/minuta_${rot.replace(/\W+/g, "_")}.json`, JSON.stringify(r.j.minute, null, 1)); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://localhost:${PORTA}/api/native-key-info`)).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("3h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const cab = { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-gemini-api-key": chaves[0], "x-gemini-api-key-pool": JSON.stringify(chaves) };
  const texto = readFileSync(process.env.PROC, "utf8"); const ato = process.env.ATO || "auto";
  const base = { processText: texto, actType: ato, promptTitle: "Teste", promptText: "Redija o ato judicial adequado à fase atual do processo.", comarcaVara: "Vara de Família e Sucessões - Montes Claros de Goiás/GO" };
  if (process.env.SO_SEM !== "1") {
    const t0 = Date.now(); const m = await chamar("/api/mapa-processo", cab, { processText: process.env.PROC_MAPA ? readFileSync(process.env.PROC_MAPA, "utf8") : texto });      // PROC_MAPA: autos completos para o mapa, enquanto PROC é o que vai ao Turbo (simula o dossiê dos lotes)
    console.log(`MAPA: HTTP ${m.status} ${Math.round((Date.now() - t0) / 1000)}s`, m.j?.bloco ? "" : (m.j?.error || ""));
    if (m.j?.bloco) { writeFileSync("/tmp/mapa_bloco.txt", m.j.bloco); await espera(20000); resumo("COM O MAPA", await chamar("/api/generate-minute-turbo", cab, { ...base, mapaProcesso: m.j.bloco })); await espera(30000); }
  }
  resumo("SEM O MAPA", await chamar("/api/generate-minute-turbo", cab, base));
} finally { srv.kill(); }
