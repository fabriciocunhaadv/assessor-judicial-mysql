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
  const post = async (corpo) => { const x = await fetch(B + "/api/reestruturar-minuta", { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); return { status: x.status, j: await x.json() }; };
  const minuta = { title: "SENTENÇA", header: "PODER JUDICIÁRIO", processNumber: "5656408-27.2026.8.09.0166", parties: { author: "A", defendant: "B" }, relatorio: "Houve sentença em 17/09/2026 (Mov. 28, Arq. 1, Págs. 1-4), com condenação de R$ 4.000,00. " + "texto ".repeat(40), fundamentacao: "Fundamentação " + "z".repeat(300), dispositivo: "Dispositivo " + "w".repeat(300), closing: "Intimem-se." };
  const modelo = "MODELO DO JUIZ: ".padEnd(300, "m");
  let a = await post({ minute: minuta, paradigmText: modelo, paradigmTitle: "Cumprimento JEC" });
  ok(a.status === 200 && a.j.success && /Reorganizada/.test(a.j.minute.relatorio) && a.j.minute.fullFormattedText.length > 50, "devolve a minuta reorganizada com o texto completo");
  ok(a.j.avisos.length === 0, "valores, datas e citações preservados: sem avisos");
  a = await post({ minute: { ...minuta, relatorio: minuta.relatorio + " [[PERDE]]" }, paradigmText: modelo, paradigmTitle: "x" });
  ok(a.j.avisos.some((x) => /R\$4\.000,00/.test(x)), "valor que sumiu na reorganização gera aviso");
  a = await post({ minute: { ...minuta, relatorio: minuta.relatorio + " [[VAZA]]" }, paradigmText: modelo + " valor do modelo R$ 7.777,00", paradigmTitle: "x" });
  ok(a.j.avisos.some((x) => /MODELO/.test(x) && /7\.777,00/.test(x)), "dado do modelo que vazou para a minuta gera aviso");
  const modeloLongo = ["Determino a citação da parte requerida por aplicativo de mensagem instantânea, no número informado pela parte autora.", "O servidor certificará nos autos o envio da mensagem e a confirmação de recebimento pelo destinatário citado.", "Decorrido o prazo sem manifestação, intime-se a parte autora para impulsionar o feito em quinze dias úteis.", "Ausente a confirmação de recebimento, fica a citação por oficial de justiça no endereço indicado na petição inicial."].join("\n");
  a = await post({ minute: minuta, paradigmText: modeloLongo, paradigmTitle: "Citação por WhatsApp" });
  ok(a.j.avisos.some((x) => /não ter sido aplicado por inteiro/.test(x)), "modelo cujos parágrafos não aparecem no resultado gera aviso de que não foi aplicado por inteiro");
  a = await post({ minute: minuta, paradigmText: "curto", paradigmTitle: "x" });
  ok(a.status === 400 && /vazio ou é curto/.test(a.j.error), "modelo vazio: erro claro em português");
  a = await post({ minute: { title: "x" }, paradigmText: modelo });
  ok(a.status === 400 && /minuta está vazia/.test(a.j.error), "minuta vazia: erro claro");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
