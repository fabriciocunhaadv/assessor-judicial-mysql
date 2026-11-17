// Barra de espera: com os modelos FORTES em 503, a leitura de trecho do gigante informa em /api/progresso/:id quanto falta da espera (espera.restanteSeg/totalSeg), e a barra some quando acaba.
// Rodar: node testes/servidor/rodar_espera_barra.mjs   (demora ~1 min)
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const base = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8985", PORTA_GEMINI: "8985", PORTA_TESTE: "3077", COTA_PAUSA_MS: "1000", AUTOS_GRANDES_PAUSA_MS: "1000", GEMINI_FALSO_503_FORTES_SEG: "60" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env: base, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const autos = "[QUADRO DE MOVIMENTAÇÕES DO PROJUDI — processo x]\nMov. 1 · 01/01/2025 · Distribuído\nMov. 2 · 02/01/2025 · Juntada de contestação\n[FIM DO QUADRO DE MOVIMENTAÇÕES]\n\nClasse: Procedimento Comum\n" + "Texto dos autos do processo com petição inicial e contestação. ".repeat(40);
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]);
  sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3077/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(base.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true", "Content-Type": "application/json" };
  const progId = "gig-teste-barra";
  const pedido = fetch("http://localhost:3077/api/gigante-lote", { method: "POST", headers: H, body: JSON.stringify({ texto: autos, rotulo: "págs. 1-150 (lote 1/3)", contexto: "teste", progId }) }).then(async (r) => r.status + " " + (await r.text())).catch((e) => "erro: " + e);
  const leituras = []; let visto = null;
  for (let k = 0; k < 90; k++) {
    await espera(1000);
    const p = await (await fetch("http://localhost:3077/api/progresso/" + progId, { headers: H })).json();
    leituras.push(p);
    if (p.espera && !visto) visto = { ...p.espera, texto: p.texto };
    if (visto && k > 6 && !p.espera) break;
  }
  console.log("primeira leitura com espera:", JSON.stringify(visto));
  ok(!!visto, "o servidor informou a espera (restanteSeg/totalSeg) enquanto os modelos fortes descansavam");
  ok(visto && visto.totalSeg > 0 && visto.restanteSeg > 0 && visto.restanteSeg <= visto.totalSeg, `restante (${visto?.restanteSeg}s) entre 0 e o total (${visto?.totalSeg}s)`);
  ok(visto && /Aguardando o Google liberar um modelo completo/.test(visto.texto), "o texto do andamento explica a espera");
  const comEspera = leituras.filter((x) => x.espera).map((x) => x.espera.restanteSeg);
  const desceu = comEspera.length >= 3 && comEspera[0] > comEspera[comEspera.length - 1];
  ok(desceu, `o tempo restante vai diminuindo: ${comEspera.slice(0, 12).join(", ")}…`);
  ok(leituras[leituras.length - 1] && !leituras[leituras.length - 1].espera, "quando a espera acaba, a informação some");
  const resp = await Promise.race([pedido, espera(2000).then(() => "(ainda rodando)")]); console.log("resposta do pedido:", String(resp).slice(0, 300));
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
