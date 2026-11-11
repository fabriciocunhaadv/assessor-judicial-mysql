// Turbo: detector de descumprimento de determinação (igual à análise principal). Rodar: node testes/servidor/rodar_turbo_descumprimento.mjs
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
  const pg = (g, mov, tipo, txt) => `[Página ${g} de 30]\n${txt}\nMovimentacao ${mov} : ${tipo}\nArquivo 1: x.pdf - Pag.1/1\n`;
  const inicial = pg(1, 1, "Petição Inicial", "Trata-se de ação de inventário e partilha movida por GISLENE. ".repeat(10));
  const mayk = inicial + pg(2, 5, "Despacho", "Emende a inicial no prazo de 15 dias, sob pena de indeferimento.") + pg(6, 20, "Despacho", "Intime-se a parte autora para, no prazo improrrogável de 5 dias, juntar os documentos faltantes, sob pena expressa de indeferimento da inicial e extinção do processo sem resolução do mérito.") + pg(7, 21, "Intimação", "Intimação expedida.") + pg(9, 23, "Certidão", "Certifico que o prazo assinalado decorreu sem qualquer manifestação ou juntada documental pela promovente.") + pg(10, 24, "Conclusos para sentença", "Conclusos.");
  const chamar = async (processText) => { const x = await fetch(B + "/api/generate-minute-turbo", { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ processText, actType: "auto", promptTitle: "Outros Área Judicial - Cível", promptText: "prompt" }) }); await x.text(); return await (await fetch("http://127.0.0.1:8994/__turbo")).json(); };
  let t = await chamar(mayk); console.log(JSON.stringify(t));
  ok(t.regra, "o Turbo recebe a regra de descumprimento de determinação com advertência");
  ok(t.detectado, "autos com determinação, advertência e certidão de decurso: a detecção automática entra no pedido");
  ok(t.atoSentenca, "ato em 'auto' + descumprimento provado: o ato fixado é SENTENÇA");
  t = await chamar(inicial + pg(2, 5, "Despacho", "Emende a inicial no prazo de 15 dias, sob pena de indeferimento da inicial.") + pg(3, 6, "Intimação", "Intimação expedida para a parte autora."));
  ok(t.regra && !t.detectado && !t.atoSentenca, "prazo em curso (sem certidão): a regra segue no pedido, mas nada é detectado nem fixado como sentença");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
