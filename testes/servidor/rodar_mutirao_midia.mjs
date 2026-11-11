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
  const { enviarMidiaEmPartes, TAMANHO_PARTE } = await import("../../src/utils/enviarMidia.ts");
  const midia = new Blob([new Uint8Array(TAMANHO_PARTE * 2 + 12345).fill(7)], { type: "video/webm" }); midia.name = "audiencia.webm";
  const fetchComSessao = (u, o = {}) => fetch(B + u, { ...o, headers: { ...(o.headers || {}), ...H } });
  const prog = []; const env1 = await enviarMidiaEmPartes(midia, (f, t) => prog.push(`${f}/${t}`), fetchComSessao);
  ok(env1.partes === 3 && prog.join() === "1/3,2/3,3/3", "arquivo de 16 MB + um pouco vai em 3 partes, com andamento");
  const fd = new FormData(); fd.append("midiaId", env1.midiaId); fd.append("partes", String(env1.partes)); fd.append("tamanho", String(env1.tamanho)); fd.append("nomeMidia", "audiencia.webm"); fd.append("mimeMidia", "video/webm");
  fd.append("ataText", "ATA prévia"); fd.append("pdfText", "AUTOS ".repeat(150000)); fd.append("processNumber", "5129546-88.2025.8.09.0100");
  const r = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd });
  const j = JSON.parse(await r.text());
  ok(r.status === 200 && j.success === true, "rota responde com sucesso");
  ok(/roça desde os doze anos/.test(j.data.transcription) && /Julgo procedente/.test(j.data.sentenceText), "devolve a degravação e a sentença");
  ok(/usou a degravação/.test(j.data.sentenceText), "a sentença é redigida a partir da degravação (e não da mídia direta)");
  await espera(1500);
  const m = await (await fetch("http://127.0.0.1:8994/__midia")).json(); console.log("mídia:", JSON.stringify(m));
  ok(m.arquivos === 1 && m.bytes === env1.tamanho, "a mídia chegou inteira à IA pela API de arquivos (bytes conferem)");
  ok(m.degravacoes === 1 && m.sentencas === 1 && !m.semAutosNaDegravacao, "duas chamadas: degravação (com o arquivo) e sentença");
  ok(m.apagados === 1, "o arquivo é apagado na IA depois do uso");
  ok(j.usage?.totalTokenCount > 0, "consumo de tokens devolvido (entra no painel Utilização)");
  // mídia que não chegou
  const fd2 = new FormData(); fd2.append("midiaId", "naoexiste123"); fd2.append("partes", "2"); fd2.append("pdfText", "x");
  const r2 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd2 }); const j2 = JSON.parse(await r2.text());
  ok(j2.success === false && /não chegou|faltou/.test(j2.error || ""), "mídia ausente: erro claro em português");
  // sem mídia (só autos e ata)
  const fd3 = new FormData(); fd3.append("ataText", "ATA"); fd3.append("pdfText", "AUTOS");
  const r3 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd3 }); const j3 = JSON.parse(await r3.text());
  ok(j3.success === true && /Julgo procedente/.test(j3.data.sentenceText), "sem mídia: ainda redige com autos e ata");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
