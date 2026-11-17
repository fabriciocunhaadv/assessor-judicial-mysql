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
  // chave geral: começa DESLIGADA; com ela desligada o envio dos usuários é recusado
  r = await chama("/api/comparacoes-minuta/config"); ok(r.s === 200 && r.j.ativo === false, "a chave começa DESLIGADA");
  const envDesl = { processo: "5888888-88.2026.8.09.0166", ato: "DESPACHO", analysisId: "ana-1", textoGerado: "Texto gerado pelo sistema com mais de cinquenta caracteres para passar na checagem.", textoLancado: "Texto lançado pelo assessor no Projudi. ".repeat(6) };
  r = await chama("/api/comparacoes-minuta/enviar", "POST", envDesl, "gabinete_a"); ok(r.s === 403 && /desativado/.test(r.j.erro), `desligada: enviar recusado (${r.s})`);
  r = await chama("/api/comparacoes-minuta"); ok(!r.j.comparacoes.some((x) => x.processo === envDesl.processo), "desligada: nada foi gravado");
  r = await chama("/api/comparacoes-minuta/config", "POST", { ativo: true }); ok(r.s === 200 && r.j.ativo === true, "Super Admin liga a chave");
  r = await chama("/api/comparacoes-minuta/config"); ok(r.j.ativo === true, "leitura mostra ligada");
  // envio pelo usuário (marcar como lançado / excluir)
  const env = { processo: "5999999-99.2026.8.09.0166", ato: "DESPACHO", promptTitulo: "Despacho padrão", motor: "gigante", analysisId: "ana-777", motivo: "excluir", aproveitamentoPct: 40, coberturaPct: 30, palavrasOriginal: 100, palavrasLancado: 80, mantidas: 40, removidas: 60, acrescentadas: 40, dispositivoMudou: false, mudancas: [], textoGerado: "Texto gerado pelo sistema com mais de cinquenta caracteres para passar na checagem mínima.", textoLancado: "Texto lançado pelo assessor no Projudi. ".repeat(6) };
  r = await chama("/api/comparacoes-minuta/enviar", "POST", { ...env, textoLancado: "curto" }, "gabinete_a"); ok(r.s === 400, "enviar: lançada curta é recusada");
  r = await chama("/api/comparacoes-minuta/enviar", "POST", { ...env, textoGerado: "x" }, "gabinete_a"); ok(r.s === 400, "enviar: gerada ausente é recusada");
  r = await chama("/api/comparacoes-minuta/enviar", "POST", { ...env, processo: "" }, "gabinete_a"); ok(r.s === 400, "enviar: sem processo é recusado");
  r = await chama("/api/comparacoes-minuta/enviar", "POST", env, "gabinete_a"); ok(r.s === 200 && r.j.id === "u-ana-777", `enviar: grava com id do ato (${r.j.id})`);
  r = await chama("/api/comparacoes-minuta/enviar", "POST", { ...env, aproveitamentoPct: 55 }, "gabinete_b"); ok(r.s === 200 && r.j.id === "u-ana-777", "enviar de novo o mesmo ato: mesmo id (substitui)");
  r = await chama("/api/comparacoes-minuta"); const e1 = r.j.comparacoes.filter((x) => x.id === "u-ana-777");
  ok(e1.length === 1 && e1[0].origem === "usuario" && e1[0].motivo === "excluir" && e1[0].por === "teste@tjgo.jus.br" && e1[0].motor === "gigante" && !("textoLancado" in e1[0]), "lista mostra origem, motivo, quem enviou e o motor (sem o texto)");
  r = await chama("/api/comparacoes-minuta/u-ana-777/textos"); ok(r.s === 200 && r.j.textoLancado.includes("assessor no Projudi") && r.j.textoGerado.includes("sistema"), "textos do envio ficam guardados para a calibragem");
  await chama("/api/comparacoes-minuta/apagar", "POST", { ids: ["u-ana-777"] });
  r = await chama("/api/comparacoes-minuta/config", "POST", { ativo: false }); ok(r.s === 200 && r.j.ativo === false, "Super Admin desliga a chave");
  r = await chama("/api/comparacoes-minuta/enviar", "POST", env, "gabinete_a"); ok(r.s === 403, "desligada de novo: enviar recusado");
  r = await chama("/api/comparacoes-minuta/config", "POST", { ativo: true });
  // pacote do laboratório: devolve os textos inteiros (gerado e lançado)
  r = await chama("/api/comparacoes-minuta/exportar", "POST", {}); ok(r.s === 200 && r.j.comparacoes.length === 1 && r.j.comparacoes[0].textoLancado.includes("arquive-se") && r.j.comparacoes[0].textoGerado.includes("Trata-se"), "exportar: todas, com os textos inteiros");
  r = await chama("/api/comparacoes-minuta/exportar", "POST", { ids: ["nao-existe"] }); ok(r.s === 200 && r.j.comparacoes.length === 0, "exportar: id inexistente não devolve nada");
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
