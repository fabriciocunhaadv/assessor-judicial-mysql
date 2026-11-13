// Livro de exclusões do Histórico e contagem no painel Utilização (Super Admin). Rodar: node testes/servidor/rodar_exclusoes.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8994", PORTA_GEMINI: "8994", PORTA_TESTE: "3061", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_exclusoes.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3061/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "Content-Type": "application/json" }, B = "http://localhost:3061/api";
  const hist = async (metodo, caminho, corpo, tenant = "gab_a") => { const r = await fetch(B + "/db/history" + caminho, { method: metodo, headers: { ...H, "x-tenant-id": tenant }, body: corpo ? JSON.stringify(corpo) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const ato = (id, num) => ({ id, processNumber: num, promptTitle: "x", date: Date.now() - 1000, unitId: "montes_claros", createdBy: "u-teste", creatorEmail: "teste@tjgo.jus.br", tenant: "gab_a", result: { minute: { title: "DECISÃO", processNumber: num, judicialUnit: "Montes Claros" } } });
  for (const a of [ato("e1", "5533538-77.2026.8.09.0166"), ato("e2", "5000001-00.2026.8.09.0166"), ato("e3", "5000002-00.2026.8.09.0166"), ato("e4", "5000003-00.2026.8.09.0166")]) await hist("PUT", "/" + a.id, a);
  const util = async () => (await (await fetch(B + "/utilizacao", { headers: H })).json());
  let u = await util(); let linha = (u.usuarios || []).find((l) => l.email === "teste@tjgo.jus.br");
  ok(u.totais && (u.totais.excluidasManual || 0) === 0 && (u.totais.excluidasRetencao || 0) === 0, "antes de excluir: nenhuma exclusão registrada");
  const d1 = await hist("DELETE", "/e1");
  ok(d1.status === 200, `exclui uma minuta (${d1.status})`);
  const d2 = await hist("DELETE", "/processo/5000001-00.2026.8.09.0166");
  ok(d2.status === 200 && d2.j.apagados === 1, `exclui um dossiê (${JSON.stringify(d2.j)})`);
  const mv = await hist("POST", "/lote/mover-gabinete", { tenantDestino: "gab_b", processos: ["5000002-00.2026.8.09.0166"], unitId: "montes_claros", judicialUnit: "Montes Claros" });
  ok(mv.status === 200 && mv.j.movidos === 1, `move uma minuta para outro gabinete (${JSON.stringify(mv.j)})`);
  u = await util(); linha = (u.usuarios || []).find((l) => l.email === "teste@tjgo.jus.br");
  ok(linha && linha.excluidasManual === 2, `a pessoa tem 2 minutas excluídas registradas (veio ${linha && linha.excluidasManual})`);
  ok(u.totais.excluidasManual === 2 && u.totais.excluidasRetencao === 0, "totais: 2 excluídas manualmente, 0 por prazo");
  ok(u.totais.exclusoesDesde > 0, "informa desde quando as exclusões são registradas");
  // lançadas no Projudi e mudança de unidade (ato e3 foi movido de gabinete acima; e4 continua no gabinete)
  const l1 = await hist("PATCH", "/e4", { op: "lancado", quando: Date.now() });
  const l2 = await hist("PATCH", "/e4", { op: "lancado", quando: Date.now() });      // marcar de novo o mesmo valor não é novo evento? (muda o instante: conta)
  const un = await hist("PATCH", "/e4", { op: "unidade", unitId: "crixas", judicialUnit: "Crixás / Vara Única" });
  ok(l1.status === 200 && un.status === 200, `marca lançado e muda a unidade (${l1.status}/${un.status})`);
  u = await util(); linha = (u.usuarios || []).find((l) => l.email === "teste@tjgo.jus.br");
  ok(linha.lancadas >= 1 && linha.mudancasUnidade === 1 && linha.mudancasGabinete === 1, `contadores por pessoa: lançadas=${linha.lancadas} unidade=${linha.mudancasUnidade} gabinete=${linha.mudancasGabinete}`);
  ok(u.totais.lancadas >= 1 && u.totais.mudancasUnidade === 1 && u.totais.mudancasGabinete === 1, "totais de lançadas e mudanças");
  const det = async (tipo) => (await (await fetch(B + "/utilizacao/detalhe?tipo=" + tipo, { headers: H })).json());
  const dx = await det("excluidas"), dl = await det("lancada"), du = await det("unidade"), dg = await det("gabinete");
  ok(dx.linhas.length === 2 && dx.linhas.every((x) => x.quemFez === "teste@tjgo.jus.br" && x.dono === "teste@tjgo.jus.br" && x.processo), `lista das excluídas com quem apagou (${dx.linhas.length})`);
  ok(dl.linhas.length >= 1 && du.linhas.length === 1 && du.linhas[0].detalhe.includes("crixas") && dg.linhas.length === 1 && dg.linhas[0].detalhe.includes("gab_b"), "listas de lançadas, mudança de unidade (de → para) e de gabinete");
  // cópia e exportação
  const ua = async (acao, processo = "5533538-77.2026.8.09.0166") => (await fetch(B + "/uso-acao", { method: "POST", headers: H, body: JSON.stringify({ acao, processo }) })).json();
  await ua("copiar"); const rep = await ua("copiar"); await ua("docx"); await ua("pdf"); await ua("pdf", "5000001-00.2026.8.09.0166");
  ok(rep.repetido === true, "o mesmo gesto repetido em 5 s não conta de novo");
  const inval = await fetch(B + "/uso-acao", { method: "POST", headers: H, body: JSON.stringify({ acao: "apagar-tudo" }) });
  ok(inval.status === 400, "ação inválida: recusada");
  u = await util(); linha = (u.usuarios || []).find((l) => l.email === "teste@tjgo.jus.br");
  ok(linha.copias === 1 && linha.docx === 1 && linha.pdfs === 2, `cópias=${linha.copias} docx=${linha.docx} pdf=${linha.pdfs} por pessoa`);
  ok(u.totais.copias === 1 && u.totais.docx === 1 && u.totais.pdfs === 2, "totais de cópias, DOCX e PDF");
  const dpdf = await det("pdf"); ok(dpdf.linhas.length === 2 && dpdf.linhas[0].quemFez === "teste@tjgo.jus.br", "lista das exportações em PDF com quem fez");
  const ruim = await fetch(B + "/utilizacao/detalhe?tipo=xyz", { headers: H });
  ok(ruim.status === 400, "tipo inválido: erro claro");
  ok(!(u.avisos || []).some((x) => /excluídas/.test(x)), `sem aviso de falha na fonte de exclusões (${JSON.stringify(u.avisos)})`);
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
