// Fase do processo no motor: dica de fase, teses por fase, conferência + UMA refeita, etiqueta do motor. Rodar: node testes/servidor/rodar_fase_motor.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8993", PORTA_GEMINI: "8993", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000" };
const filhos = []; const sobe = (cmd, args, env) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const quadroCump = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo 5129546-88.2025.8.09.0100 (lido da tela)]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 5 · 01/03/2025 · Julgada procedente a ação · com arquivo(s)\nMov. 8 · 01/05/2025 · Trânsito em julgado\nMov. 9 · 02/05/2025 · Início do cumprimento de sentença\nÚLTIMA MOVIMENTAÇÃO: Mov. 9 (Início do cumprimento de sentença, 02/05/2025).\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\n";
const autos = (extra = "") => quadroCump + "Processo Nº: 5129546-88.2025.8.09.0100\nClasse: Cumprimento de Sentença\n" + "Banco réu intimado a pagar. ".repeat(40) + extra;
const teses = "TESE 1 — Nulidade do contrato bancário e restituição em dobro\nSe o contrato for nulo, declarar a nulidade.\n\nTESE 2 — Impugnação ao cumprimento: excesso de execução\nAnalisar o excesso.";
try {
  for (const porta of ["3071", "3072"]) {
    const env = { ...base, PORTA_TESTE: porta, ...(porta === "3072" ? { MOTORES_FASE: "off" } : {}) };
    if (porta === "3071") sobe("node", ["testes/servidor/gemini_falso.cjs"], env);
    sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], env);
  }
  for (const porta of ["3071", "3072"]) for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${porta}/api/native-key-info`)).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const chamar = async (porta, rota, corpo) => { const x = await fetch(`http://localhost:${porta}${rota}`, { method: "POST", headers: H, body: JSON.stringify({ actType: "auto", promptTitle: "Cível", promptText: "Redija o ato.", ...corpo }) }); const t = (await x.text()).trim(); let j = {}; try { j = JSON.parse(t); } catch {} return { status: x.status, j }; };
  const estado = async () => (await fetch("http://localhost:8993/__fase")).json();

  // 1) Turbo em cumprimento, IA sentenciou o mérito -> refeita UMA vez e resolvida
  let r = await chamar("3071", "/api/generate-minute-turbo", { processText: autos("[[MERITO]]"), cabinetTesesText: teses, isTesesEnabled: true });
  let e = await estado(); console.log(JSON.stringify(e), r.status);
  ok(r.status === 200 && r.j.motor === "turbo", "etiqueta do motor: turbo");
  ok(e.dica && e.fraseCumprimento, "o pedido ao motor leva a dica de fase (cumprimento: não reabre o mérito)");
  ok(e.teseNulidade === false && e.teseImpugnacao && e.notaTeses, "tese de mérito (nulidade) não vai; a da fase (impugnação) vai; nota do sistema avisa");
  ok(e.correcoes === 1, "a conferência achou o erro e refez UMA vez");
  ok(r.j.conferenciaFase?.refeita && r.j.conferenciaFase?.resolvido && r.j.conferenciaFase.fase === "cumprimento", "conferenciaFase: refeita e resolvida");
  ok(/impugna/.test(r.j.minute?.dispositivo || "") && !/nulidade do contrato/i.test(r.j.minute?.dispositivo || ""), "a minuta entregue é a corrigida");
  ok(r.j.conferenciaFase?.tesesOmitidas === 1, "informa quantas teses de mérito deixaram de ir");
  // 2) se a refeita persiste no erro: entrega a ORIGINAL com aviso, sem refazer duas vezes
  r = await chamar("3071", "/api/generate-minute-turbo", { processText: autos("[[MERITO]] [[PERSISTE]]") });
  e = await estado();
  ok(e.correcoes === 2 && r.j.conferenciaFase?.refeita && r.j.conferenciaFase?.resolvido === false && r.j.conferenciaFase.avisos.length >= 1, "persistindo, refaz só uma vez e entrega com aviso");
  // 3) processo em conhecimento: nada muda (sem aviso, sem refeita)
  r = await chamar("3071", "/api/generate-minute-turbo", { processText: "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos. ".repeat(50) + "[[MERITO]]" });
  e = await estado();
  ok(e.correcoes === 2 && !r.j.conferenciaFase?.avisos?.length, "em conhecimento não confere nem refaz");
  // 4) motor principal (duas etapas) em cumprimento
  r = await chamar("3071", "/api/generate-minute", { processText: autos("[[MERITO]]"), cabinetTesesText: teses, isTesesEnabled: true });
  console.log("principal:", r.status, JSON.stringify(r.j.conferenciaFase || {}), r.j.motor);
  ok(r.status === 200 && r.j.motor === "principal", "etiqueta do motor: principal");
  ok(r.j.conferenciaFase && r.j.conferenciaFase.fase === "cumprimento", "o motor principal também confere a fase");
  // 5) gigante (coberturaLeitura.escolha = gigante)
  r = await chamar("3071", "/api/generate-minute", { processText: autos(), coberturaLeitura: { escolha: "gigante", arquivos: [] } });
  ok(r.j.motor === "gigante", "etiqueta do motor: gigante");
  // 6) chave geral desligada (MOTORES_FASE=off): comportamento anterior
  r = await chamar("3072", "/api/generate-minute-turbo", { processText: autos("[[MERITO]]"), cabinetTesesText: teses, isTesesEnabled: true });
  ok(r.status === 200 && !r.j.conferenciaFase, "MOTORES_FASE=off: sem conferência (volta ao comportamento anterior)");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
