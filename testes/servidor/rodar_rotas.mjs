// Sobe o servidor com banco e Gemini de mentira e chama as rotas de IA de verdade (Lupa, análise em 2 etapas, Turbo), para pegar erro de execução que os testes de função não pegam.
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GEMINI_FALSO_GRATUITO: "1", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8999", PORTA_GEMINI: "8999", AUTOS_GRANDES_PAUSA_MS: "1", COTA_PAUSA_MS: "1" };
const filhos = [];
const sobe = (cmd, args, rotulo) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"] }); p.stdout.on("data", (d) => process.env.VER_LOG && process.stdout.write(`[${rotulo}] ${d}`)); p.stderr.on("data", (d) => (p.erros = (p.erros || "") + d)); filhos.push(p); return p; };
sobe("node", ["testes/servidor/gemini_falso.cjs"], "gemini");
const srv = sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_falso.cjs", "server.ts"], "servidor");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch("http://localhost:3000/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const chamar = async (rota, corpo) => { const r = await fetch("http://localhost:3000" + rota, { method: "POST", headers: { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true", "X-Uso-No-Servidor": "1" }, body: JSON.stringify(corpo) }); const t = await r.text(); let j = null; try { j = JSON.parse(t.trim()); } catch {} return { status: r.status, j, t }; };
  const pag = (n, tot, mov, txt, tipo = "Petição") => `[Página ${n} de ${tot}]\n${txt}\nMovimentacao ${mov} : ${tipo}\nArquivo 1: x.pdf - Pag.1/1\n`;
  const autos = (n) => Array.from({ length: n }, (_, i) => pag(i + 1, n, i + 1, `Texto da página ${i + 1} do processo sobre cobrança, com bastante conteúdo. `.repeat(60) + ` unico${i}x${(i * 7919) % 9973} `.repeat(50))).join("");
  const minuta = "SENTENÇA\n\nI - RELATÓRIO\nTrata-se de ação de cobrança (Mov. 1, Arq. 1, Pág. 1).\n\nII - FUNDAMENTAÇÃO\nA parte autora comprovou o contrato (Mov. 2, Arq. 1, Pág. 1).\n\nIII - DISPOSITIVO\nJulgo procedente. Determino o pagamento da quantia devida.";

  let r = await chamar("/api/audit-assessor-draft", { draftText: minuta, processText: autos(40) });
  console.log("lupa pequena:", r.status, r.t.slice(0, 200));
  ok(r.status === 200 && r.j && typeof r.j.score === "number", "Lupa (autos pequenos): responde 200 com nota");
  ok(Array.isArray(r.j?.conformidadeNormativa), "Lupa: campo conformidadeNormativa presente");
  // autos acima de 400 mil caracteres: classificação por relevância
  const grande = autos(100); console.log("tamanho dos autos grandes:", grande.length);
  r = await chamar("/api/audit-assessor-draft", { draftText: minuta, processText: grande });
  console.log("lupa grande:", r.status, r.t.slice(0, 200));
  ok(r.status === 200 && r.j && typeof r.j.score === "number", "Lupa (autos > 400 mil caracteres): responde 200");
  ok(!r.j?.autosReduzidos, "Lupa grande: não omite páginas (sem redução por relevância)");

  // análise normal: etapa 1 e etapa 2
  const base = { processText: autos(30), customPromptText: "Prompt de teste", actType: "auto", processInfo: { processNumber: "5129546-88.2025.8.09.0100", comarca: "Montes Claros" } };
  r = await chamar("/api/generate-minute", { ...base, executionStage: 1 });
  console.log("análise etapa 1:", r.status, r.t.slice(0, 160));
  ok(r.status === 200 && r.j && (r.j.minute || r.j.stage), "Análise normal (1ª etapa): responde 200 com minuta");
  r = await chamar("/api/generate-minute", { ...base });
  console.log("análise completa:", r.status, r.t.slice(0, 160));
  ok(r.status === 200 && r.j && r.j.minute, "Análise normal (2 etapas): responde 200 com minuta");
  // descumprimento de determinação nos autos
  const txtDesc = pag(1, 6, 1, "Petição inicial de inventário. ".repeat(40)) + pag(2, 6, 5, "Despacho: intime-se a parte autora para, no prazo de 5 dias, juntar os documentos, sob pena expressa de indeferimento da inicial. ".repeat(3), "Despacho") + pag(3, 6, 21, "Intimação expedida. ".repeat(30), "Intimação") + pag(4, 6, 23, "Certifico que o prazo assinalado decorreu sem qualquer manifestação. ".repeat(10), "Certidão") + pag(5, 6, 24, "Conclusos para sentença. ".repeat(20), "Conclusos para Sentença");
  r = await chamar("/api/generate-minute", { processText: txtDesc, customPromptText: "p", actType: "auto", executionStage: 1 });
  console.log("descumprimento:", r.status, JSON.stringify(r.j?.avisoDescumprimento || null).slice(0, 200));
  ok(r.status === 200 && r.j?.avisoDescumprimento?.decide === true, "Etapa 1 detecta descumprimento e devolve o aviso");
  // Turbo
  // mapa do processo (processos com 130 movimentações ou mais)
  const processoLongo = (n) => Array.from({ length: n }, (_, i) => `[Página ${i + 1} de ${n}]\n[Mov. ${i + 1} · Arq. 1 · Pág. 1/1]\nTexto do ato ${i + 1}. ` + "conteúdo ".repeat(40) + `\nMovimentacao ${i + 1} : ${i + 1 === 148 ? "Decisão" : "Intimação"}\nArquivo 1: a${i + 1}.pdf - Pag.1/1\n`).join("");
  const longo = processoLongo(157);
  r = await chamar("/api/mapa-processo", { processText: longo });
  console.log("mapa:", r.status, r.t.slice(0, 160));
  ok(r.status === 200 && r.j?.mapa?.estadoAtual?.questaoAtual?.includes("avaliação dos imóveis"), "Mapa do processo: devolve o estado atual");
  ok(Array.isArray(r.j?.mapa?.eventos) && r.j.mapa.eventos.some((e) => e.mov === 148) && r.j.mapa.eventos.find((e) => e.mov === 37)?.situacao === "cumprido", "Mapa: eventos por movimentação e situação ajustada pela consolidação");
  ok(typeof r.j?.bloco === "string" && r.j.bloco.startsWith("[MAPA DO PROCESSO") && r.j.mapa.movimentacoes.ultima === 157, "Mapa: bloco de texto para a IA e última movimentação 157");
  const blocoMapa = r.j?.bloco || "";
  // mapa em modos (segundo plano: o navegador grava cada parte e retoma de onde parou)
  r = await chamar("/api/mapa-processo", { modo: "plano", processText: longo });
  ok(r.status === 200 && r.j?.total >= 1 && r.j?.movs === 157 && r.j?.ultima === 157, `Mapa (modo plano): divide sem usar IA (${r.j?.total} parte(s))`);
  const totalPartes = r.j?.total || 1;
  r = await chamar("/api/mapa-processo", { modo: "parte", indice: 0, processText: longo });
  ok(r.status === 200 && Array.isArray(r.j?.eventos) && r.j.total === totalPartes, "Mapa (modo parte): lê uma parte e devolve os eventos");
  const evParte = r.j?.eventos || [];
  r = await chamar("/api/mapa-processo", { modo: "parte", indice: 99, processText: longo });
  ok(r.status === 400, "Mapa (modo parte): parte inexistente vira erro 400");
  r = await chamar("/api/mapa-processo", { modo: "consolidar", processText: longo, eventos: evParte });
  ok(r.status === 200 && r.j?.mapa?.movimentacoes?.ultima === 157 && String(r.j?.bloco || "").startsWith("[MAPA DO PROCESSO"), "Mapa (modo consolidar): amarra a linha do tempo e devolve o bloco");
  // chave gratuita (Gemini de mentira recusa acima de 250 mil tokens): nada de omitir páginas
  let sem = 123456789; const aleatorio = (n) => { let s = ""; while (s.length < n) { sem = (sem + 0x6D2B79F5) | 0; let t = Math.imul(sem ^ (sem >>> 15), 1 | sem); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; s += (((t ^ (t >>> 14)) >>> 0).toString(36)) + (s.length % 90 < 6 ? "\n" : " "); } return s.slice(0, n); };
  const enorme = Array.from({ length: 300 }, (_, i) => `[Página ${i + 1} de 300]\nMovimentacao ${i + 1} : Petição\nArquivo 1: p${i + 1}.pdf - Pag.1/1\n` + aleatorio(4000)).join("");
  r = await chamar("/api/generate-minute-turbo", { processText: enorme, actType: "auto", promptTitle: "teste" });
  ok(!r.j?.minute && (r.j?.codigo === "AUTOS_GRANDES_SEGUNDO_PLANO" || /segundo plano|gratuita|entrada/i.test(String(r.j?.error || ""))), "Turbo com autos acima do limite da chave gratuita: NÃO reduz (devolve o pedido de segundo plano)");
  r = await chamar("/api/generate-minute", { processText: enorme, executionStage: 1, aceitaSegundoPlano: true, customPromptText: "p", activePromptTitle: "t", promptCategory: "civel" });
  ok(r.j?.codigo === "AUTOS_GRANDES_SEGUNDO_PLANO" || r.j?.codigo === "ENTRADA_GRANDE_GRATUITA", `Etapa 1 com autos acima do limite gratuito vai para os lotes (código ${r.j?.codigo})`);
  r = await chamar("/api/generate-minute-turbo", { processText: longo, actType: "auto", promptTitle: "teste", mapaProcesso: blocoMapa });
  ok(r.status === 200 && /COM-MAPA/.test(r.t), "Turbo: o mapa do processo chega às instruções da IA");
  r = await chamar("/api/generate-minute-turbo", { processText: longo, actType: "auto", promptTitle: "teste", mapaProcesso: "texto qualquer que não veio do sistema" });
  ok(r.status === 200 && !/COM-MAPA/.test(r.t), "Turbo: texto de mapa que não veio do sistema é ignorado");
  r = await chamar("/api/generate-minute", { processText: longo, executionStage: 1, mapaProcesso: blocoMapa, customPromptText: "p", activePromptTitle: "t", promptCategory: "civel" });
  ok(r.status === 200 && /COM-MAPA/.test(r.t), "Etapa 1: o mapa do processo chega às instruções da IA");
  r = await chamar("/api/mapa-processo", { processText: "curto" });
  ok(r.status === 400, "Mapa: autos curtos demais viram erro 400");
  r = await chamar("/api/generate-minute-turbo", { processText: autos(25), actType: "auto", promptTitle: "teste" });
  console.log("turbo:", r.status, r.t.slice(0, 160));
  ok(r.status === 200 && r.j && r.j.minute, "Turbo: responde 200 com minuta");
  // Petição 360 (extração) com texto
  r = await chamar("/api/advogado-peticao/auto-extract-evidence", { processFiles: [{ name: "a.pdf", base64: "", mimeType: "application/pdf", size: 1, extractedText: autos(5) }], pieceType: "contestacao", clientRole: "reu" });
  console.log("peticao:", r.status, r.t.slice(0, 160));
  ok(r.status === 200 || r.status === 403, "Petição 360° (extração): não quebra (200, ou 403 se o usuário de teste não for liberado)");
} catch (e) { falhas++; console.log("ERRO NO TESTE:", e); }
finally {
  if (srv.erros && /Error|TypeError|ReferenceError/.test(srv.erros)) console.log("--- stderr do servidor ---\n" + srv.erros.slice(-1500));
  filhos.forEach((p) => p.kill("SIGKILL"));
  process.exit(falhas ? 1 : 0);
}
