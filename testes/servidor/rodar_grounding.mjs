// Pesquisa ao vivo (Grounding): feita na 1ª etapa e reaproveitada na 2ª (uma busca só); o status volta na resposta; a 2ª etapa recebe a opção do app. Rodar: node testes/servidor/rodar_grounding.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8996", PORTA_GEMINI: "8996", PORTA_TESTE: "3059", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3059/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const chamar = async (corpo) => { const r = await fetch("http://localhost:3059/api/generate-minute", { method: "POST", headers: { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true" }, body: JSON.stringify(corpo) }); const t = await r.text(); let j = null; try { j = JSON.parse(t.trim()); } catch {} return { status: r.status, j, t }; };
  const buscas = async () => (await (await fetch("http://127.0.0.1:8996/__grounding")).json()).n;
  const pag = (n, tot, mov, txt) => `[Página ${n} de ${tot}]\n${txt}\nMovimentacao ${mov} : Petição\nArquivo 1: x.pdf - Pag.1/1\n`;
  const autos = Array.from({ length: 30 }, (_, i) => pag(i + 1, 30, i + 1, `Texto da página ${i + 1} do processo sobre cobrança bancária. `.repeat(60))).join("");
  const base = { processText: autos, customPromptText: "Prompt de teste", actType: "auto", processInfo: { processNumber: "5129546-88.2025.8.09.0100", comarca: "Montes Claros" } };

  let antes = await buscas(), r = await chamar({ ...base, executionStage: 1, isGroundingEnabled: true });
  ok(r.status === 200, "1ª etapa responde 200");
  ok((await buscas()) === antes + 1, "1ª etapa FAZ a pesquisa ao vivo (uma busca)");
  ok(r.j?.groundingStatus === "ok" && r.j?.groundingSources?.length === 1 && String(r.j?.groundingTexto || "").includes("Súmula 297"), `1ª etapa devolve status ok, a fonte e o texto (veio ${r.j?.groundingStatus})`);
  const g1 = { texto: r.j?.groundingTexto, fontes: r.j?.groundingSources };
  const snap = r.j?.minute ? { processNumber: r.j.minute.processNumber, relatorio: r.j.minute.relatorio || "Relatório.", fundamentacao: r.j.minute.fundamentacao || "Fundamentação.", dispositivo: r.j.minute.dispositivo || "Dispositivo." } : { relatorio: "Relatório.", fundamentacao: "Fundamentação." };

  antes = await buscas(); r = await chamar({ ...base, executionStage: 2, stage1Snapshot: snap, isGroundingEnabled: true, groundingReuso: g1 });
  ok(r.status === 200, "2ª etapa responde 200");
  ok((await buscas()) === antes, "2ª etapa REAPROVEITA o resultado da 1ª: nenhuma busca nova (uma busca só por análise)");
  ok(r.j?.groundingStatus === "ok" && r.j?.groundingSources?.length === 1, `2ª etapa mantém status ok e a fonte (veio ${r.j?.groundingStatus})`);

  antes = await buscas(); r = await chamar({ ...base, executionStage: 2, stage1Snapshot: snap, isGroundingEnabled: true });
  ok((await buscas()) === antes + 1 && r.j?.groundingStatus === "ok", "2ª etapa sem o resultado da 1ª (ex.: recarregou a página): pesquisa por conta própria");

  antes = await buscas(); r = await chamar({ ...base, executionStage: 2, stage1Snapshot: snap });
  ok((await buscas()) === antes && r.j?.groundingStatus === "desligado", "sem a opção ligada: nenhuma pesquisa e status desligado");

  antes = await buscas(); r = await chamar({ ...base, isGroundingEnabled: true });
  ok(r.status === 200 && (await buscas()) === antes + 1 && r.j?.groundingStatus === "ok", "análise completa (sem separar etapas): uma pesquisa e status ok");

  // o app precisa enviar a opção também na 2ª etapa (antes só a 1ª enviava)
  const app = fs.readFileSync(path.join(raiz, "src/App.tsx"), "utf8"), i2 = app.indexOf("executionStage: 2,");
  ok(i2 > 0 && app.slice(i2, i2 + 2500).includes("isGroundingEnabled: getIsGroundingEnabled()") && app.slice(i2, i2 + 2500).includes("groundingReuso"), "App: o pedido da 2ª etapa leva isGroundingEnabled e o resultado da 1ª");
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
process.exit(falhas ? 1 : 0);
