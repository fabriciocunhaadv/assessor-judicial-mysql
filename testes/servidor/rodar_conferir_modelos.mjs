// Conferir a minuta com os modelos do Projudi (servidor, Gemini falso). Rodar: node testes/servidor/rodar_conferir_modelos.mjs
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
  const post = async (corpo) => { const x = await fetch(B + "/api/conferir-modelos", { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); return { status: x.status, j: await x.json().catch(() => ({})) }; };
  const minuta = { title: "DECISÃO", relatorio: "Trata-se de cumprimento de sentença. ".repeat(4), fundamentacao: "Fundamentação suficiente para a conferência. ".repeat(3), dispositivo: "Cite-se a parte executada no prazo de 5 dias.", closing: "Intimem-se." };
  const modelo = { id: "m1", nome: "Citação por WhatsApp", tipo: "Citação", texto: "MODELO: cite-se por WhatsApp; o escrivão certifica o envio; prazo de 15 dias. ".repeat(3) };
  let a = await post({ minute: minuta, modelos: [modelo] });
  const r = a.j.resultados?.[0];
  ok(a.status === 200 && a.j.success && a.j.resultados.length === 1 && r.modeloId === "m1", "devolve só resultado de modelo que foi enviado (ignora id forasteiro)");
  ok(r.itens.length === 3 && r.itens[0].aplicavel && r.itens[0].sugestao.acao === "acrescentar", "item de acrescentar é aplicável");
  ok(r.itens[1].aplicavel && r.itens[1].sugestao.de === "prazo de 5 dias", "troca de trecho que existe uma vez na seção é aplicável");
  ok(!r.itens[2].aplicavel, "troca de trecho que NÃO existe é marcada como ajuste manual");
  a = await post({ minute: { ...minuta, relatorio: minuta.relatorio + " [[NAO-SE-APLICA]]" }, modelos: [modelo] });
  ok(a.j.resultados[0].aplica === false && a.j.resultados[0].itens.length === 0, "modelo de outro ato: não se aplica, sem itens");
  a = await post({ minute: minuta, modelos: [] });
  ok(a.status === 400 && /Nenhum modelo/.test(a.j.error), "sem modelos: erro claro");
  a = await post({ minute: { title: "x" }, modelos: [modelo] });
  ok(a.status === 400 && /minuta está vazia/.test(a.j.error), "minuta vazia: erro claro");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
