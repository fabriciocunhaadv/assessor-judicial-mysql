// Rotas de calibragem das minutas: o servidor sobe com elas e todas exigem login. Rodar: node testes/servidor/rodar_comparacoes.mjs
import { spawn } from "node:child_process";
import path from "node:path";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", PORTA_TESTE: "3098" };
const p = spawn("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"], { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch("http://localhost:3098/api/native-key-info")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  const chama = async (rota, metodo = "GET") => (await fetch(`http://localhost:3098${rota}`, { method: metodo, headers: { "content-type": "application/json" }, body: metodo === "POST" ? "{}" : undefined })).status;
  for (const [m, r] of [["GET", "/api/comparacoes-minuta"], ["GET", "/api/comparacoes-minuta/padroes"], ["GET", "/api/comparacoes-minuta/abc/textos"], ["POST", "/api/comparacoes-minuta"], ["POST", "/api/comparacoes-minuta/abc/assinado"], ["POST", "/api/comparacoes-minuta/resumo"], ["POST", "/api/comparacoes-minuta/apagar"], ["POST", "/api/comparacoes-minuta/enviar"], ["GET", "/api/comparacoes-minuta/config"], ["POST", "/api/comparacoes-minuta/config"], ["POST", "/api/comparacoes-minuta/exportar"], ["POST", "/api/comparacoes-minuta/limpar"]])
    ok(await chama(r, m) === 401, `${m} ${r} sem login: 401`);
} finally { try { process.kill(-p.pid); } catch {} }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
