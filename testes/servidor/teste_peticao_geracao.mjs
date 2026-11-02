// Petição & Defesa 360°: rota que REDIGE a peça (generate-full-petition), com banco e Gemini de mentira. O Gemini de mentira se auto-aprova e inventa precedente; o servidor tem de corrigir.
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8999", NODE_ENV: "production", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost", PORTA_GEMINI: "8999" };
const filhos = [];
const sobe = (cmd, args, rotulo) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); p.stdout.on("data", (d) => process.env.VER_LOG && process.stdout.write(`[${rotulo}] ${d}`)); p.stderr.on("data", (d) => process.env.VER_LOG && process.stdout.write(`[${rotulo}!] ${d}`)); filhos.push(p); return p; };
sobe("node", ["testes/servidor/gemini_falso.cjs"], "gemini");
sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"], "servidor");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch("http://localhost:3000/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const gerar = async (corpo) => { const r = await fetch("http://localhost:3000/api/advogado-peticao/generate-full-petition", { method: "POST", headers: { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true" }, body: JSON.stringify(corpo) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, j, t }; };
  const base = { pieceType: "contestacao", clientRole: "reu", processNumber: "5129546-88.2025.8.09.0100", varaJuizo: "Vara Cível", clientName: "Cliente", defendantName: "Autor", lawArea: "Consumidor", targetCourt: "TJGO", caseDescription: "O cliente foi citado em 10/10/2026 e nega a dívida cobrada. " .repeat(8), tempestividadeInfo: "Citação juntada em 10/10/2026; prazo de 15 dias úteis." };

  // 1) entrada vazia: erro claro, não falha de execução
  let r = await gerar({ pieceType: "inicial" });
  ok(r.status === 400 && /Descreva os fatos/.test(r.j?.error || ""), "sem fatos e sem arquivos: 400 com mensagem clara (antes dava erro de execução)");

  // 2) caso completo: responde 200 com a peça, o aviso de revisão e a auditoria CORRIGIDA
  r = await gerar(base);
  console.log("geração:", r.status, r.t.slice(0, 160));
  const d = r.j?.data;
  ok(r.status === 200 && r.j?.success && typeof d?.fullPetitionMarkdown === "string" && d.fullPetitionMarkdown.length > 1500, "contestação: responde 200 com o texto integral da peça");
  ok(/revise/i.test(r.j?.avisoRevisao || "") && /advogado/i.test(r.j?.avisoRevisao || ""), "a resposta traz o aviso de revisão pelo advogado");
  ok(d?.auditCpc?.score === 98 || d?.auditCpc?.score <= 98, "auditoria presente");
  ok(Array.isArray(d?.pontosParaConferir), "a resposta traz a lista pontosParaConferir");
  // 3) jurisprudência inventada: número de autos sem link vira sugestão de tese; súmula oficial continua verificada
  const j0 = d?.favorableJurisprudence?.[0], j1 = d?.favorableJurisprudence?.[1];
  ok(j0 && j0.tipo === "sugestao_tese" && j0.isRealVerificado === false && !/5123456/.test(j0.precedentNumber), "acórdão com número inventado e sem link vira “sugestão de tese” (o número não aparece)");
  ok(j1 && j1.tipo === "real_verificado" && /Súmula 297/.test(j1.precedentNumber), "súmula oficial continua como verificada");

  // 4) a IA se auto-aprova com nota 98, mas faltam dados: contestação sem data de citação/prazo -> o servidor derruba o “seguro para protocolar”
  r = await gerar({ ...base, tempestividadeInfo: "" });
  const a = r.j?.data?.auditCpc;
  ok(r.status === 200 && a && a.safeForProtocol === false && a.score <= 89 && a.status !== "aprovado", "sem data de citação/prazo: NÃO fica “seguro para protocolar” e a nota é limitada, mesmo com a IA dando 98");
  ok((a?.criticalAlerts || []).some((x) => /tempestividade|citação|intimação/i.test(x)) && a.items.find((x) => /Tempestiv/i.test(x.label))?.isCompliant === false, "o alerta explica a falta e o item Tempestividade fica não conforme");
  ok((r.j?.data?.pontosParaConferir || []).some((x) => /tempestividade|citação|intimação/i.test(x)), "o alerta também entra na lista “pontos para conferir”");

  // 5) campos [PREENCHER] deixados pela IA viram alerta e impedem o “seguro”
  r = await gerar({ ...base, caseDescription: base.caseDescription + " [[FALSO-PREENCHER]]" });
  const b = r.j?.data?.auditCpc;
  ok(b && b.safeForProtocol === false && (b.criticalAlerts || []).some((x) => /preencher|conferir/i.test(x)), "texto com [PREENCHER: …] gera alerta e não fica “seguro para protocolar”");

  // 6) resposta da IA dentro de cerca ```json é aceita
  r = await gerar({ ...base, caseDescription: base.caseDescription + " [[FALSO-CERCA]]" });
  ok(r.status === 200 && typeof r.j?.data?.fullPetitionMarkdown === "string" && r.j.data.fullPetitionMarkdown.length > 1500, "resposta em bloco ```json é lida normalmente");

  // 7) tudo informado e sem pendências: pode ficar “seguro” (a conferência não bloqueia sempre)
  r = await gerar({ ...base, processFiles: [{ name: "a.pdf", base64: "", mimeType: "application/pdf", size: 1, extractedText: "Texto dos autos. ".repeat(30) }] });
  const c = r.j?.data?.auditCpc;
  ok(r.status === 200 && c && Array.isArray(c.criticalAlerts), "caso completo com autos anexados: auditoria devolvida");
  console.log("auditoria do caso completo:", JSON.stringify({ score: c?.score, status: c?.status, seguro: c?.safeForProtocol, alertas: c?.criticalAlerts }));
  // 8) inicial (sem processo e sem prazo) não exige prazo
  r = await gerar({ pieceType: "inicial", clientRole: "autor", clientName: "Maria", defendantName: "Banco", lawArea: "Consumidor", targetCourt: "TJGO", caseDescription: "A cliente teve o nome negativado indevidamente. ".repeat(10) });
  ok(r.status === 200 && !(r.j?.data?.auditCpc?.criticalAlerts || []).some((x) => /número dos autos|citação ou intimação/i.test(x)), "petição inicial não exige número de autos nem data de citação");
} catch (e) { console.log("ERRO NO TESTE:", e); falhas++; }
finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); process.exit(falhas ? 1 : 0);
