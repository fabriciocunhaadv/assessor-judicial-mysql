// Contingência por seções ponta a ponta: os modelos FORTES ficam fora do ar o tempo todo; só o leve responde. A minuta curta do leve é aprofundada em uma chamada (que falha em render mais) e,
// então, montada POR SEÇÕES (roteiro, tópicos, relatório, dispositivo). A resposta traz aviso de contingência. Rodar: node testes/servidor/rodar_contingencia_secoes.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8986", PORTA_GEMINI: "8986", PORTA_TESTE: "3078", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000", GEMINI_FALSO_503_FORTES_SEG: "100000", ESPERA_PROFUNDO_ESCALA: "0.02" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env: base, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const autos = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos do processo com petição inicial e contestação. ".repeat(40);
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]);
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3078/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const t0 = Date.now();
  const r = await fetch("http://localhost:3078/api/generate-minute", { method: "POST", headers: H, body: JSON.stringify({ processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 1 }) });
  const t = (await r.text()).trim(); let j = {}; try { j = JSON.parse(t); } catch {}
  const seg = (Date.now() - t0) / 1000;
  const g = await (await fetch("http://127.0.0.1:8986/__geracao")).json();
  const por = (e) => g.lista.filter((x) => x.etapa === e).length;
  console.log(`status ${r.status} em ${seg.toFixed(1)}s; erros 503: ${g.erros503}; roteiro ${por("roteiro")}, tópicos ${por("topico")}, relatório ${por("relatorio")}, dispositivo ${por("dispositivo")}; modelos: ${[...new Set(g.lista.map((x) => x.modelo))].join(", ")}`);
  const m = j.minute || {};
  ok(r.status === 200 && !j.error && m.fundamentacao, "a minuta foi entregue");
  ok(g.erros503 >= 2, `os modelos fortes ficaram fora do ar (${g.erros503} 503)`);
  ok(por("roteiro") === 1 && por("topico") === 3 && por("relatorio") === 1 && por("dispositivo") === 1, "montou por seções: 1 roteiro, 3 tópicos, 1 relatório, 1 dispositivo");
  ok(g.lista.filter((x) => x.etapa).every((x) => !/^gemini-3\.(6|8)-flash$/.test(x.modelo)), "as seções saíram pelo modelo leve (os fortes seguiam fora do ar)");
  ok(String(m.fundamentacao).length > 3000 && m.fundamentacao.split("\n\n").length >= 3, `fundamentação grande (${String(m.fundamentacao).length} caracteres, 3 partes)`);
  ok(/É o relatório\. DECIDO\./.test(m.relatorio || "") && /P\.R\.I\.C\./.test(m.dispositivo || ""), "relatório e dispositivo vieram das chamadas próprias");
  ok(Array.isArray(j.avisoProfundidade) && /por seções/.test(j.avisoProfundidade[0]) && /menos refinada/.test(j.avisoProfundidade[0]), "a resposta traz o aviso de contingência por seções");
  // ETAPA 2 (juiz revisor): mesmo caminho
  const r2 = await fetch("http://localhost:3078/api/generate-minute", { method: "POST", headers: H, body: JSON.stringify({ processText: autos, customPromptText: "prompt", actType: "sentenca", executionStage: 2, stage1Snapshot: { processNumber: "5129546-88.2025.8.09.0100", relatorio: "Relatório. ".repeat(30), fundamentacao: "F. ".repeat(60), dispositivo: "Julgo procedente o pedido." } }) });
  const j2 = JSON.parse((await r2.text()).trim() || "{}");
  const g2 = await (await fetch("http://127.0.0.1:8986/__geracao")).json();
  const por2 = (e) => g2.lista.filter((x) => x.etapa === e).length;
  console.log(`etapa 2: status ${r2.status}; roteiros ${por2("roteiro")}, tópicos ${por2("topico")}`);
  ok(r2.status === 200 && !j2.error && por2("roteiro") === 2 && por2("topico") === 6, "etapa 2: também monta por seções (2º roteiro e 6 tópicos no total)");
  ok(Array.isArray(j2.avisoProfundidade) && /por seções/.test(j2.avisoProfundidade[0]) && String(j2.minute?.fundamentacao || "").length > 3000, "etapa 2: aviso de contingência e fundamentação grande");
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
