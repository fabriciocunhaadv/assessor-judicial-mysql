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
  const fd = new FormData(); fd.append("motorPrincipal", "false"); fd.append("midiaId", env1.midiaId); fd.append("partes", String(env1.partes)); fd.append("tamanho", String(env1.tamanho)); fd.append("nomeMidia", "audiencia.webm"); fd.append("mimeMidia", "video/webm");
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
  // dois vídeos (um por testemunha): cada um é enviado, degravado à parte e identificado; a sentença recebe as duas degravações
  const v1 = new Blob([new Uint8Array(3_000_000).fill(1)], { type: "video/mp4" }); v1.name = "testemunha1.mp4";
  const v2 = new Blob([new Uint8Array(5_000_000).fill(2)], { type: "video/webm" }); v2.name = "testemunha2.webm";
  const e1 = await enviarMidiaEmPartes(v1, () => {}, fetchComSessao), e2 = await enviarMidiaEmPartes(v2, () => {}, fetchComSessao);
  const antes = await (await fetch("http://127.0.0.1:8994/__midia")).json();
  const fd4 = new FormData(); fd4.append("motorPrincipal", "false"); fd4.append("midias", JSON.stringify([{ ...e1, nomeMidia: "testemunha1.mp4", mimeMidia: "video/mp4" }, { ...e2, nomeMidia: "testemunha2.webm", mimeMidia: "video/webm" }])); fd4.append("ataText", "ATA"); fd4.append("pdfText", "AUTOS");
  const r4 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd4 }); const j4 = JSON.parse(await r4.text());
  await espera(1500);
  const dep = await (await fetch("http://127.0.0.1:8994/__midia")).json();
  ok(j4.success === true, "duas mídias: rota responde com sucesso");
  ok(dep.arquivos - antes.arquivos === 2 && dep.degravacoes - antes.degravacoes === 2 && dep.sentencas - antes.sentencas === 1, "duas mídias: 2 envios, 2 degravações e 1 sentença");
  ok(/VÍDEO\/ÁUDIO 1 DE 2 \("testemunha1.mp4"\)/.test(j4.data.transcription) && /VÍDEO\/ÁUDIO 2 DE 2 \("testemunha2.webm"\)/.test(j4.data.transcription), "a degravação identifica cada vídeo pelo nome");
  ok(dep.apagados - antes.apagados === 2, "duas mídias: os dois arquivos são apagados na IA");
  // mesma base do estúdio principal na sentença: teses do gabinete e base de conhecimento chegam à IA
  const fd5 = new FormData(); fd5.append("motorPrincipal", "false"); fd5.append("ataText", "ATA"); fd5.append("pdfText", "AUTOS"); fd5.append("cabinetTesesText", "TESE: auxílio-doença exige incapacidade temporária comprovada por perícia."); fd5.append("isTesesEnabled", "true");
  fd5.append("knowledgePdfs", JSON.stringify([{ name: "modelo.pdf", extractedText: "Modelo de sentença previdenciária do gabinete." }])); fd5.append("promptTitle", "Previdenciário");
  const r5 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd5 }); const j5 = JSON.parse(await r5.text());
  const bs = (await (await fetch("http://127.0.0.1:8994/__midia")).json()).baseSentenca;
  ok(j5.success && bs?.teses && bs?.conhecimento, "a sentença do Mutirão recebe as teses e a base de conhecimento do gabinete");
  ok(j5.fontesConsultadas?.consultado === true, "devolve o que foi consultado (legislação/precedentes)");
  // Mesa de Audiência (pauta normal): as teses do gabinete passam a chegar à IA nos atos de decisão (mesma base do estúdio)
  const antesT = (await (await fetch("http://127.0.0.1:8994/__midia")).json()).comTesesTotal;
  const rm = await fetchComSessao("/api/hearing-copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "instant_sentence", processNumber: "5128-88", author: "A", defendant: "INSS", caseText: "Petição inicial de auxílio por incapacidade. ".repeat(40), sentenceParams: {}, pointsOfControversy: [], witnessesList: [], cabinetTesesText: "TESE: perícia judicial prevalece.", isTesesEnabled: true }) });
  await rm.text();
  const depoisT = (await (await fetch("http://127.0.0.1:8994/__midia")).json()).comTesesTotal;
  ok(depoisT > antesT, "Mesa: a sentença imediata recebe o caderno de teses do gabinete");
  // MOTOR PRINCIPAL: a degravação vira prova oral e a sentença sai pelas 2 etapas do estúdio (mesmo formato das demais minutas)
  const fd6 = new FormData(); fd6.append("midias", JSON.stringify([{ ...(await enviarMidiaEmPartes(v1, () => {}, fetchComSessao)), nomeMidia: "testemunha1.mp4", mimeMidia: "video/mp4" }]));
  fd6.append("ataText", "ATA"); fd6.append("pdfText", "Petição inicial de auxílio por incapacidade. Movimentacao 1 : Petição Arquivo 1: inicial.pdf - Pag.1/1. ".repeat(30)); fd6.append("processNumber", "5129546-88.2025.8.09.0100"); fd6.append("promptTitle", "Previdenciário"); fd6.append("unidadeNome", "Montes Claros de Goiás - Vara das Fazendas Públicas - GO");
  const r6 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd6 }); const j6 = JSON.parse(await r6.text());
  ok(j6.success && j6.motor === "principal" && j6.resultado?.minute, "a sentença sai pelo motor principal (resultado completo no formato das demais minutas)");
  ok(/roça desde os doze anos/.test(j6.data.transcription) && !/roça desde os doze anos/.test(j6.data.sentenceText || ""), "a degravação vai à parte; não é copiada para a sentença");
  const bm = (await (await fetch("http://127.0.0.1:8994/__midia")).json());
  ok(bm.sentencas >= 1 && j6.data.sentenceText.length > 100, "sentença com texto próprio do motor");
  // motor principal falha: NÃO entrega a minuta preliminar como se fosse a sentença; devolve erro claro + a degravação (para reaproveitar na nova tentativa)
  const fd7 = new FormData(); fd7.append("midias", JSON.stringify([{ ...(await enviarMidiaEmPartes(v1, () => {}, fetchComSessao)), nomeMidia: "t1.mp4", mimeMidia: "video/mp4" }]));
  fd7.append("ataText", "ATA"); fd7.append("pdfText", "Petição inicial de auxílio. ".repeat(60)); fd7.append("processNumber", "5129546-88.2025.8.09.0100"); fd7.append("customPromptTemplate", "FALHAR-MOTOR");
  const r7 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd7 }); const j7 = JSON.parse(await r7.text());
  ok(j7.success === false && /motor principal/.test(j7.error || "") && /roça desde os doze anos/.test(j7.data?.transcription || ""), "motor falhou: erro claro e a degravação volta para ser reaproveitada (não entrega a 1ª etapa como sentença)");
  // com a degravação pronta o servidor não precisa de mídia nenhuma
  const fd8 = new FormData(); fd8.append("degravacaoPronta", j7.data.transcription); fd8.append("ataText", "ATA"); fd8.append("pdfText", "Petição inicial. ".repeat(60)); fd8.append("processNumber", "5129546-88.2025.8.09.0100");
  const antesArq = (await (await fetch("http://127.0.0.1:8994/__midia")).json()).arquivos;
  const r8 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd8 }); const j8 = JSON.parse(await r8.text());
  const depoisArq = (await (await fetch("http://127.0.0.1:8994/__midia")).json()).arquivos;
  ok(j8.success && j8.motor === "principal" && depoisArq === antesArq, "degravação pronta: refaz só a sentença, sem enviar nem ouvir a mídia de novo");
  // mídia que não chegou
  const fd2 = new FormData(); fd2.append("midiaId", "naoexiste123"); fd2.append("partes", "2"); fd2.append("pdfText", "x");
  const r2 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd2 }); const j2 = JSON.parse(await r2.text());
  ok(j2.success === false && /não chegou|faltou/.test(j2.error || ""), "mídia ausente: erro claro em português");
  // sem mídia (só autos e ata)
  const fd3 = new FormData(); fd3.append("motorPrincipal", "false"); fd3.append("ataText", "ATA"); fd3.append("pdfText", "AUTOS");
  const r3 = await fetchComSessao("/api/mutirao-video", { method: "POST", body: fd3 }); const j3 = JSON.parse(await r3.text());
  ok(j3.success === true && /Julgo procedente/.test(j3.data.sentenceText), "sem mídia: ainda redige com autos e ata");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
