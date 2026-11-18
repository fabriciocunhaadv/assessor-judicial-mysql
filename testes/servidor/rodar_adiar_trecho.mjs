// Adiar em vez de esperar: com os modelos FORTES ocupados, o trecho do gigante espera só o tempo curto pedido e devolve o sinal FORTE_OCUPADO (o painel segue para o próximo trecho e volta depois).
// Rodar: node testes/servidor/rodar_adiar_trecho.mjs   (demora ~1 min)
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
  const post = async (corpo) => { const t0 = Date.now(); const r = await fetch("http://localhost:3077/api/gigante-lote", { method: "POST", headers: H, body: JSON.stringify({ texto: autos, rotulo: "págs. 1-150 (lote 1/3)", contexto: "teste", ...corpo }) }); const txt = await r.text(); let j = {}; try { j = JSON.parse(txt.trim()); } catch {} return { status: r.status, j, seg: (Date.now() - t0) / 1000 }; };
  // 1) modelos fortes em 503: deixa a esteira marcar os fortes como ocupados (1ª chamada sem adiamento, para ela falhar do jeito antigo) e depois pede COM adiamento
  const aquece = await post({ progId: "gig-aq", esperaMs: 0 }); console.log("aquecimento:", aquece.status, aquece.seg + "s");
  const a = await post({ progId: "gig-adiar", podeAdiar: true, esperaMs: 4000 });
  console.log("com adiamento:", a.status, a.seg + "s", JSON.stringify(a.j).slice(0, 160));
  ok(a.j.codigo === "FORTE_OCUPADO", "modelos fortes ocupados: o servidor devolve FORTE_OCUPADO (o trecho é adiado)");
  ok(a.seg < 20, `sem esperar minutos: respondeu em ${a.seg.toFixed(1)}s (espera curta pedida: 4 s)`);
  // 2) o mesmo pedido sem adiamento continua usando a esteira antiga (aceita o modelo leve no fim)
  await espera(1500);
} finally { for (const p of filhos) try { process.kill(-p.pid, 9); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
