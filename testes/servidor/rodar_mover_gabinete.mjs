// Super Admin: mover minutas para a unidade de OUTRO gabinete (tenant). Rodar: node testes/servidor/rodar_mover_gabinete.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8994", PORTA_GEMINI: "8994", PORTA_TESTE: "3061", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_historia.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3061/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const B = "http://localhost:3061/api/db/history";
  const chamar = async (tenant, metodo, caminho, corpo) => { const r = await fetch(B + caminho, { method: metodo, headers: { "X-Assessor-Sessao": token, "x-tenant-id": tenant, "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const ato = (id, num) => ({ id, processNumber: num, promptTitle: "x", date: 1790000000000, unitId: "crixas", createdBy: "u-teste", tenant: "gab_crixas", result: { minute: { title: "DECISÃO", processNumber: num, judicialUnit: "Crixás / Vara Única", relatorio: "r" } } });
  const NUM = "5533538-77.2026.8.09.0166";
  // grava dois atos do processo e um de outro processo no gabinete de origem
  for (const a of [ato("a1", NUM), ato("a2", NUM), ato("a3", "5000001-00.2026.8.09.0166")]) { const r = await chamar("gab_crixas", "PUT", "/" + a.id, a); if (r.status >= 300) { const r2 = await chamar("gab_crixas", "POST", "", a); if (r2.status >= 300) console.log("gravação falhou", r.status, r.j, r2.status, r2.j); } }
  const r = await chamar("gab_crixas", "POST", "/lote/mover-gabinete", { tenantDestino: "gab_montes", processos: [NUM], unitId: "montes_claros", judicialUnit: "Montes Claros de Goiás / Vara Única" });
  ok(r.status === 200 && r.j.movidos === 2, `move os 2 atos do processo (${r.status} ${JSON.stringify(r.j)})`);
  const naOrigem = await chamar("gab_crixas", "GET", "/a1"), noDestino = await chamar("gab_montes", "GET", "/a1");
  ok(naOrigem.status === 404, "o ato saiu do gabinete de origem");
  ok(noDestino.status === 200 && noDestino.j.unitId === "montes_claros" && noDestino.j.tenant === "gab_montes" && noDestino.j.result.minute.judicialUnit === "Montes Claros de Goiás / Vara Única", "o ato está no gabinete de destino, com a unidade nova (unitId, tenant e nome na minuta)");
  const outro = await chamar("gab_crixas", "GET", "/a3");
  ok(outro.status === 200 && outro.j.unitId === "crixas", "o ato de OUTRO processo não foi mexido");
  const h = await chamar("gab_crixas", "POST", "/lote/mover-gabinete", { tenantDestino: "gab_crixas", processos: [NUM], unitId: "u", judicialUnit: "U" });
  ok(h.status === 400, "mesmo gabinete de origem e destino: erro claro (use a mudança de unidade comum)");
  const v = await chamar("gab_crixas", "POST", "/lote/mover-gabinete", { tenantDestino: "gab_montes", unitId: "m", judicialUnit: "M" });
  ok(v.status === 400, "sem nada selecionado: erro claro");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
