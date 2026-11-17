// Comparações de minutas ponta a ponta (servidor real + banco de mentira): guarda, lista de QUALQUER gabinete escolhido no seletor, documento assinado, resumo, e a guarda de 30 dias. Rodar: node testes/servidor/rodar_comparacoes_dados.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { SignJWT } from "jose";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SEG = "x".repeat(40);
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: SEG, GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", PORTA_TESTE: "3099" };
const p = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_comparacoes.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3099/api/native-key-info")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SEG));
  const chama = async (rota, metodo = "GET", corpo, tenant) => { const r = await fetch(`http://localhost:3099${rota}`, { method: metodo, headers: { "content-type": "application/json", "x-assessor-sessao": token, ...(tenant ? { "x-tenant-id": tenant } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
  const base = { processo: "5574437-20.2026.8.09.0166", ato: "DESPACHO", promptTitulo: "Despacho padrão", motor: "turbo", aproveitamentoPct: 10, coberturaPct: 5, palavrasOriginal: 700, palavrasLancado: 250, mantidas: 20, removidas: 680, acrescentadas: 230, dispositivoMudou: true, porSecao: [{ secao: "Relatório", palavrasOriginais: 300, mantidas: 0, aproveitamentoPct: 0 }], mudancas: [{ tipo: "removido", secao: "Relatório", original: "Trata-se de ação longa de exoneração de alimentos movida por fulano" }], textoLancado: "Registra-se o acordo e arquive-se.", textoGerado: "Trata-se de ação longa." };
  // grava com o seletor num gabinete e lê com o seletor em OUTRO: a lista não pode “sumir”
  let r = await chama("/api/comparacoes-minuta", "POST", base, "gabinete_a"); ok(r.s === 200 && r.j.ok && r.j.id, `grava (${r.s})`);
  const id = r.j.id;
  r = await chama("/api/comparacoes-minuta", "GET", undefined, "gabinete_b");
  ok(r.s === 200 && r.j.comparacoes.length === 1 && r.j.comparacoes[0].id === id && !("textoLancado" in r.j.comparacoes[0]) && r.j.comparacoes[0].promptTitulo === "Despacho padrão" && r.j.comparacoes[0].coberturaPct === 5, "lista aparece mesmo com outro gabinete no seletor (sem o texto)");
  r = await chama(`/api/comparacoes-minuta/${id}/textos`, "GET", undefined, "gabinete_b"); ok(r.s === 200 && r.j.textoLancado.includes("arquive-se"), "textos guardados voltam");
  r = await chama(`/api/comparacoes-minuta/${id}/assinado`, "POST", { aproveitamentoLancadaPct: 90, aproveitamentoGeradaPct: 40, dispositivoMudouDaLancada: false, arquivo: "a.pdf", mudancas: [] }, "gabinete_b"); ok(r.s === 200, "documento assinado guardado");
  r = await chama("/api/comparacoes-minuta/padroes"); ok(r.s === 200 && r.j.padroes.total === 1 && r.j.padroes.coberturaMediaPct === 5 && r.j.padroes.assinados.n === 1 && r.j.padroes.porPrompt[0].nome === "Despacho padrão", "padrões contam prompt, cobertura e assinado");
  // guarda de 30 dias: uma comparação “velha” (40 dias) é apagada; a recente fica
  await chama("/api/comparacoes-minuta", "POST", { ...base, processo: "VELHO-1" }, "gabinete_a");
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 2, "2 comparações antes da limpeza");
  r = await chama("/api/comparacoes-minuta/limpar", "POST", { simular: true }); ok(r.s === 200 && r.j.vencidas === 1 && r.j.dias === 30, `simulação: 1 vencida (${JSON.stringify(r.j)})`);
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 2, "simulação não apaga");
  r = await chama("/api/comparacoes-minuta/limpar", "POST", {}); ok(r.s === 200 && r.j.vencidas === 1, "limpeza apaga 1");
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 1 && r.j.comparacoes[0].processo === base.processo, "só a recente ficou");
  r = await chama("/api/comparacoes-minuta/resumo", "POST", {}); ok([200, 400, 503].includes(r.s) || r.s === 500, `resumo responde sem derrubar (${r.s} ${JSON.stringify(r.j).slice(0, 90)})`);
  // apagar: escolhidas, e todas
  const a = (await chama("/api/comparacoes-minuta", "POST", { ...base, processo: "APAGA-1" }, "gabinete_a")).j.id, b = (await chama("/api/comparacoes-minuta", "POST", { ...base, processo: "APAGA-2" }, "gabinete_b")).j.id;
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 3, "3 comparações (de 2 gabinetes)");
  r = await chama("/api/comparacoes-minuta/apagar", "POST", { ids: [a] }); ok(r.s === 200 && r.j.apagadas === 1, "apaga uma");
  r = await chama("/api/comparacoes-minuta/apagar", "POST", { ids: [] }); ok(r.s === 400, "sem escolha: 400");
  r = await chama("/api/comparacoes-minuta/apagar", "POST", { ids: [b, "nao-existe"] }); ok(r.s === 200 && r.j.apagadas === 1, "várias (id inexistente é ignorado)");
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 1, "sobrou 1");
  r = await chama("/api/comparacoes-minuta/apagar", "POST", { todas: true }); ok(r.s === 200 && r.j.apagadas === 1, "apaga todas");
  r = await chama("/api/comparacoes-minuta"); ok(r.j.comparacoes.length === 0, "lista vazia");
} finally { try { process.kill(-p.pid); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
