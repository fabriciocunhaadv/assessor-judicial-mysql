// Argumento × Resposta nos motores (regras A, B, C e D): a regra chega às etapas 1 e 2, ao Turbo e à Lupa; a etapa 2 devolve a matriz e o servidor a confere; ARGUMENTOS_RESPOSTA=off volta ao anterior.
// Rodar: node testes/servidor/rodar_argumentos.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8988", PORTA_GEMINI: "8988", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000" };
const filhos = []; const sobe = (cmd, args, env) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const autos = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos do processo com petição inicial e contestação. ".repeat(30);
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"], { ...base, PORTA_TESTE: "3081" });
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], { ...base, PORTA_TESTE: "3081" });
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], { ...base, PORTA_TESTE: "3082", ARGUMENTOS_RESPOSTA: "off" });
  for (const porta of ["3081", "3082"]) for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${porta}/api/native-key-info`)).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const post = async (porta, rota, corpo) => { const r = await fetch(`http://localhost:${porta}${rota}`, { method: "POST", headers: H, body: JSON.stringify(corpo) }); const t = (await r.text()).trim(); let j = {}; try { j = JSON.parse(t); } catch {} return { status: r.status, j }; };
  const lista = async () => ((await (await fetch("http://127.0.0.1:8988/__arg")).json()).lista || []);
  const novas = async (antes) => (await lista()).slice(antes);
  const stage1 = { processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 1 };
  const stage2 = { processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 2, stage1Snapshot: { processNumber: "5129546-88.2025.8.09.0100", relatorio: "Relatório. ".repeat(30), fundamentacao: "F. ".repeat(60), dispositivo: "Julgo procedente o pedido." } };
  let n = (await lista()).length;
  // ---- motor principal, etapa 1
  let r = await post("3081", "/api/generate-minute", stage1); let nv = await novas(n); n += nv.length;
  ok(r.status === 200 && nv.some((x) => x.tipo === "principal" && x.regra && x.sentenca), "etapa 1: a regra Argumento × Resposta chega ao motor, com a cláusula da sentença");
  ok(!nv.some((x) => x.matriz), "etapa 1: não pede a matriz (só a etapa 2 devolve)");
  // ---- etapa 2
  r = await post("3081", "/api/generate-minute", stage2); nv = await novas(n); n += nv.length;
  ok(r.status === 200 && nv.some((x) => x.regra && x.matriz), "etapa 2: a regra e a instrução da matriz chegam ao motor");
  const ca = r.j.conferenciaArgumentos;
  ok(ca && ca.total === 3 && ca.respondidos === 1, `etapa 2: o servidor conferiu a matriz (3 argumentos, 1 respondido) ${JSON.stringify(ca || {}).slice(0, 160)}`);
  ok(ca && ca.semResposta?.[0]?.argumento === "prescrição da pretensão", "aponta o argumento não enfrentado");
  ok(ca && ca.naoLocalizados?.[0]?.argumento === "inversão do ônus da prova", "aponta a resposta que não está na minuta");
  ok(Array.isArray(r.j.auditAnalysis?.argumentoVsResposta) && r.j.auditAnalysis.argumentoVsResposta.length === 3, "a matriz fica na análise da minuta (junto do Fato × Prova)");
  // ---- cláusulas por ato
  r = await post("3081", "/api/generate-minute", { ...stage1, actType: "decisao" }); nv = await novas(n); n += nv.length;
  ok(nv.some((x) => x.regra && !x.sentenca), "decisão: a cláusula da sentença não vai (a regra é por ato)");
  // ---- Turbo
  r = await post("3081", "/api/generate-minute-turbo", { processText: autos, actType: "sentenca" }); nv = await novas(n); n += nv.length;
  ok(nv.some((x) => x.tipo === "turbo" && x.regra && x.sentenca), "Turbo: a regra chega, com a cláusula do ato");
  // ---- Lupa
  r = await post("3081", "/api/audit-assessor-draft", { draftText: "Minuta de sentença julgando procedente o pedido.", processText: autos }); nv = await novas(n); n += nv.length;
  ok(nv.some((x) => x.tipo === "lupa" && x.lupa), "Lupa: as regras de Argumento × Resposta e de relação e meios de prova chegam à auditoria");
  // ---- chave desligada
  await post("3082", "/api/generate-minute", stage1); r = await post("3082", "/api/generate-minute", stage2); nv = await novas(n); n += nv.length;
  ok(r.status === 200 && nv.length >= 2 && !nv.some((x) => x.regra || x.matriz), "ARGUMENTOS_RESPOSTA=off: nenhuma regra nem matriz vai aos motores");
  ok(!r.j.conferenciaArgumentos, "ARGUMENTOS_RESPOSTA=off: sem conferência");
  await post("3082", "/api/audit-assessor-draft", { draftText: "Minuta.", processText: autos }); nv = await novas(n);
  ok(nv.some((x) => x.tipo === "lupa") && !nv.some((x) => x.lupa), "ARGUMENTOS_RESPOSTA=off: a Lupa volta ao que era");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
