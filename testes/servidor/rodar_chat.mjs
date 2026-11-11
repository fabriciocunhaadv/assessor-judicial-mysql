// Chat "Editar com o chat": recebe o relatório, as teses e o prompt SEM cortes, as regras comuns e o perfil de Juizado, e corrige citações. Rodar: node testes/servidor/rodar_chat.mjs
// Mutirão Expresso de ponta a ponta: mídia em partes -> servidor junta -> envia à IA pela API de arquivos -> degravação -> sentença. Rodar: node testes/servidor/rodar_mutirao_midia.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8994", PORTA_GEMINI: "8994", PORTA_TESTE: "3061", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3061/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true" }, B = "http://localhost:3061";
  const post = async (corpo) => { const x = await fetch(B + "/api/chat-agaia", { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); return { status: x.status, j: await x.json() }; };
  const longo = (m) => "texto ".repeat(900) + m;
  const carimbo = (g, arq, nome, k, t) => `[Página ${g} de 4]\nMovimentacao 24 : Contestação / \nArquivo ${arq}: ${nome} - Pag.${k}/${t}\n`;
  const autos = carimbo(1, 1, "00_contestacao.pdf", 1, 1) + "contestação\n" + carimbo(2, 10, "09_ficha_cadastral_sign.pdf", 1, 2) + "ficha cadastral do cartão\n" + carimbo(3, 10, "09_ficha_cadastral_sign.pdf", 2, 2) + "ficha\n";
  const r = await post({ message: "refaça a fundamentação", currentMinute: { title: "DECISÃO", header: "JUIZADO ESPECIAL CÍVEL", judicialUnit: "Juizado Especial Cível", processNumber: "1", parties: { author: "A", defendant: "B" }, relatorio: longo("FIM-DO-RELATORIO-LONGO"), fundamentacao: "fund", dispositivo: "disp" }, customPromptText: longo("FIM-DO-PROMPT-LONGO"), cabinetTesesText: longo("FIM-DAS-TESES-LONGAS"), isTesesEnabled: true, promptTitle: "Outros Área Judicial - Juizado Especial Cível", originalProcessText: autos });
  ok(r.status === 200 && r.j.hasMinuteUpdate, "o chat responde com a minuta atualizada");
  const c = await (await fetch("http://127.0.0.1:8994/__chat")).json(); console.log(JSON.stringify(c));
  ok(c.relCompleto, "o relatório chega inteiro à IA (sem corte de 1.500 caracteres)");
  ok(c.tesesCompletas && c.promptCompleto, "teses do caderno e prompt do gabinete chegam inteiros");
  ok(c.dispositivo && c.estrutura, "recebe a regra de dispositivo operacional e a de estrutura (sem títulos de roteiro)");
  ok(c.juizado, "numa decisão de Juizado recebe a regra de gratuidade e honorários");
  ok(c.indice, "recebe o índice oficial de arquivos por movimentação");
  ok(/Mov\. 24, Arq\. 10, Pág\. 1/.test(r.j.updatedMinute.relatorio), "citação com arquivo inexistente é corrigida pelo nome do documento (Ficha Cadastral = Arq. 10)");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
