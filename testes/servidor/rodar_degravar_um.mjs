// Mutirão vídeo a vídeo: /api/mutirao-degravar degrava UMA mídia por chamada. Rodar: node testes/servidor/rodar_degravar_um.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8990", PORTA_GEMINI: "8990", PORTA_TESTE: "3064", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3064/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true" }, B = "http://localhost:3064";
  const { enviarMidiaEmPartes } = await import("../../src/utils/enviarMidia.ts");
  const fetchComSessao = (u, o = {}) => fetch(B + u, { ...o, headers: { ...(o.headers || {}), ...H } });
  const estado = async () => (await fetch("http://127.0.0.1:8990/__midia")).json();
  const v1 = new Blob([new Uint8Array(3_000_000).fill(1)], { type: "video/mp4" }); v1.name = "testemunha1.mp4";
  const e1 = await enviarMidiaEmPartes(v1, () => {}, fetchComSessao);
  const antes = await estado();
  const chamar = (corpo, progId) => fetchComSessao("/api/mutirao-degravar", { method: "POST", headers: { "Content-Type": "application/json", "x-progresso-id": progId }, body: JSON.stringify(corpo) });
  const r = await chamar({ midia: { ...e1, nomeMidia: "testemunha1.mp4", mimeMidia: "video/mp4" }, idx: 0, total: 3, processNumber: "5129546-88.2025.8.09.0100", ataText: "ATA" }, "degr-teste-1");
  const j = JSON.parse((await r.text()).trim());
  ok(r.status === 200 && j.success === true, "responde com sucesso");
  ok(/roça desde os doze anos/.test(j.texto || ""), "devolve a degravação desse vídeo");
  ok(j.idx === 0 && j.nomeMidia === "testemunha1.mp4", "diz de qual vídeo é");
  ok(j.usage?.totalTokenCount > 0, "devolve o consumo de tokens (entra no painel Utilização)");
  await espera(1200);
  const dep = await estado();
  ok(dep.arquivos === antes.arquivos + 1 && dep.degravacoes === antes.degravacoes + 1, "enviou o arquivo à IA e fez UMA degravação");
  ok(dep.sentencas === antes.sentencas, "não redigiu sentença nenhuma (só degravou)");
  ok(dep.apagados === antes.apagados + 1, "o arquivo é apagado na IA depois do uso");
  // o resultado fica guardado no servidor: se a conexão cair, a tela busca por aqui
  const rec = await (await fetchComSessao("/api/resultado/degr-teste-1")).json();
  ok(rec.pronto === true && /roça desde os doze anos/.test(rec.body || ""), "o resultado fica guardado para a tela recuperar depois de queda");
  // mídia que não chegou: erro claro, sem derrubar
  const r2 = await chamar({ midia: { midiaId: "naoexiste123", partes: 2, nomeMidia: "x.mp4", mimeMidia: "video/mp4" }, idx: 1, total: 3 }, "degr-teste-2");
  const j2 = JSON.parse((await r2.text()).trim());
  ok(j2.success === false && /m[ií]dia|parte/i.test(j2.error || ""), "mídia ausente: erro claro em português");
  // sem mídia informada
  const r3 = await chamar({ idx: 0, total: 1 }, "degr-teste-3"); const j3 = JSON.parse((await r3.text()).trim());
  ok(r3.status === 400 && j3.success === false, "sem mídia: pedido recusado");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
