// Fontes pendentes de ponta a ponta: cada motor alimenta a lista; CRUD; inclusão de arquivo vira "Outras leis". Rodar: node testes/servidor/rodar_fontes_pendentes.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8995", PORTA_GEMINI: "8995", PORTA_TESTE: "3060", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3060/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "Content-Type": "application/json", "X-Assessor-Sessao": token, "x-use-native-key": "true" }, B = "http://localhost:3060";
  const disparar = (rota, corpo) => { const c = new AbortController(); setTimeout(() => c.abort(), 4000); return fetch(B + rota, { method: "POST", headers: H, body: JSON.stringify(corpo), signal: c.signal }).catch(() => null); };
  const lista = async () => (await (await fetch(B + "/api/fontes/pendentes", { headers: H })).json());
  const achar = async (rotulo) => (await lista()).itens.find((i) => i.rotulo === rotulo);

  const autos = "Petição inicial. A parte autora invoca a Lei Municipal nº 1.234/2015 do Município de Montes Claros de Goiás, a Lei nº 14.905/2024 e a Súmula 999 do STJ. Cita ainda a Lei Estadual nº 77.777/2020 e a Convenção sobre os Direitos da Criança. ".repeat(3);
  await Promise.all([
    disparar("/api/generate-minute", { processText: autos, customPromptText: "p", actType: "auto", executionStage: 1 }),
    disparar("/api/generate-minute-turbo", { processText: autos + " Lei Estadual nº 66.666/2019." }),
    disparar("/api/audit-assessor-draft", { draftText: "minuta citando a Lei Estadual nº 55.555/2018", processText: autos }),
    disparar("/api/gigante-lote", { texto: autos + " Decreto Municipal nº 9/2021 do Município de Montes Claros de Goiás.", rotulo: "t" }),
    disparar("/api/hearing-copilot", { caseText: autos + " Lei Estadual nº 44.444/2017", notes: "x" }),
  ]);
  await espera(1500);
  const l = await lista(); console.log("itens:", l.itens.map((i) => `${i.rotulo} [${Object.keys(i.motores).join(",")}]`).join(" | "));
  const mun = await achar("Lei Municipal 1234/2015 (Montes Claros de Goiás)");
  ok(!!mun && mun.status === "pendente" && mun.esfera === "municipal", "lei municipal citada e ausente da base entra na lista");
  ok(!l.itens.some((i) => i.rotulo.startsWith("Lei 14905")), "Lei 14.905/2024 (já está no catálogo do Planalto) NÃO entra");
  ok(!!(await achar("Súmula 999 do STJ")), "súmula ausente da base entra na lista");
  ok(!!(await achar("Convenção sobre os Direitos da Criança")), "tratado entra na lista");
  const motores = (r) => Object.keys(l.itens.find((i) => i.rotulo === r)?.motores || {});
  ok(motores("Lei Estadual 66666/2019").includes("turbo") && motores("Lei Estadual 55555/2018").includes("lupa") && motores("Lei Estadual 44444/2017").includes("mesa"), "Turbo, Lupa e Mesa alimentam a lista");
  ok(motores("Decreto Municipal 9/2021 (Montes Claros de Goiás)").includes("gigante") || l.itens.some((i) => i.motores.gigante), "Gigantes alimenta a lista");
  ok(Object.keys(mun?.motores || {}).includes("normal") && (mun.motores.normal || 0) >= 1, "análise normal (1ª etapa) alimenta a lista");
  const pedido = JSON.stringify(l.itens).includes("Montes Claros"); ok(!JSON.stringify(l).includes("Petição inicial"), "nenhum trecho do processo é guardado");
  // 2ª etapa não conta de novo
  const antes = (await achar("Lei Municipal 1234/2015 (Montes Claros de Goiás)")).ocorrencias;
  await disparar("/api/generate-minute", { processText: autos, customPromptText: "p", actType: "auto", executionStage: 2, stage1Snapshot: { relatorio: "r", fundamentacao: "f" } }); await espera(1000);
  ok((await achar("Lei Municipal 1234/2015 (Montes Claros de Goiás)")).ocorrencias === antes, "a 2ª etapa não conta de novo");
  // CRUD
  let r = await fetch(B + "/api/fontes/pendentes", { method: "POST", headers: H, body: JSON.stringify({ tipo: "lei", esfera: "municipal", ente: "Montes Claros de Goiás", numero: "500", ano: 2010 }) }); let j = await r.json();
  ok(r.status === 200 && j.item?.rotulo.includes("500/2010"), "cadastro manual (criar)");
  r = await fetch(B + "/api/fontes/pendentes", { method: "POST", headers: H, body: JSON.stringify({ tipo: "invento", numero: "1" }) }); ok(r.status === 400, "tipo inválido é recusado");
  const id500 = j.item.id;
  r = await fetch(B + `/api/fontes/pendentes/${id500}`, { method: "PUT", headers: H, body: JSON.stringify({ status: "ignorada", nota: "erro de digitação", link: "https://exemplo" }) }); j = await r.json();
  ok(r.status === 200 && j.item.status === "ignorada" && j.item.nota === "erro de digitação", "editar / ignorar");
  r = await fetch(B + `/api/fontes/pendentes/${id500}`, { method: "DELETE", headers: H }); ok(r.status === 200 && !(await lista()).itens.some((i) => i.id === id500), "excluir");
  // incluir arquivo: a lei municipal vira "Outras leis" e a fonte sai de "pendente"
  const leiTxt = "LEI Nº 1.234, DE 10 DE MARÇO DE 2015\n" + Array.from({ length: 6 }, (_, i) => `Art. ${i + 1}º Texto do artigo ${i + 1} da lei municipal.`).join("\n");
  r = await fetch(B + `/api/fontes/pendentes/${mun.id}/incluir`, { method: "POST", headers: { "X-Assessor-Sessao": token, "x-formato": "texto", "x-via": "extensao", "x-nome-arquivo": "lei1234.txt" }, body: leiTxt }); j = await r.json();
  ok(r.status === 200 && j.item?.status === "incluida" && j.lei?.artigos === 6, `incluir o arquivo grava em Outras leis e marca como incluída (${r.status} ${JSON.stringify(j).slice(0, 120)})`);
  r = await fetch(B + `/api/fontes/outras`, { headers: H }); j = await r.json(); ok((j.leis || []).some((x) => x.numero === "1234" && x.ano === 2015 && x.esfera === "municipal"), "a lei aparece em Outras leis");
  r = await fetch(B + `/api/fontes/pendentes/${mun.id}/incluir`, { method: "POST", headers: { "X-Assessor-Sessao": token, "x-formato": "texto" }, body: "texto sem artigo nenhum ".repeat(20) }); ok(r.status === 400, "arquivo sem artigos é recusado e fica registrado como tentativa");
  // fontes de busca (config) só aceita sites que a extensão pode abrir
  r = await fetch(B + "/api/fontes/pendentes/config-busca", { method: "PUT", headers: H, body: JSON.stringify({ fontes: [{ nome: "x", esfera: "municipal", ente: "X", url: "https://evil.com/leis" }] }) }); ok(r.status === 400, "fonte de busca fora da lista de sites permitidos é recusada");
  r = await fetch(B + "/api/fontes/pendentes/config-busca", { method: "PUT", headers: H, body: JSON.stringify({ fontes: [{ nome: "Câmara", esfera: "municipal", ente: "Montes Claros de Goiás", url: "https://acessoainformacao.montesclarosdegoias.go.leg.br/cidadao/legislacao/leis" }] }) }); ok(r.status === 200, "fonte de busca permitida é aceita");
  j = await lista(); ok(j.fontesBusca.length === 1 && j.fontesBusca[0].url.includes("montesclarosdegoias"), "a configuração gravada volta na listagem");
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
process.exit(falhas ? 1 : 0);
