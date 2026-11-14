// Mutirão: o rótulo da prova oral depende da origem (vídeos lidos pelo Studio x texto colado) e as regras da sentença após audiência chegam ao motor. Rodar: node testes/servidor/rodar_mutirao_origem.mjs
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import path from "node:path";
const aqui = path.dirname(new URL(import.meta.url).pathname), raiz = path.resolve(aqui, "../..");
const env = { ...process.env, MYSQL_USER: "t", MYSQL_DATABASE: "t", SESSION_SECRET: "x".repeat(40), GEMINI_API_KEY: "chave-falsa-de-teste-1234567890", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:8989", PORTA_GEMINI: "8989", PORTA_TESTE: "3065", COTA_PAUSA_MS: "1" };
const filhos = []; const sobe = (cmd, args) => { const p = spawn(cmd, args, { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"], detached: true }); filhos.push(p); return p; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
try {
  sobe("node", ["testes/servidor/gemini_falso.cjs"]); sobe("npx", ["tsx", "--require", "./testes/servidor/preload_mysql_docs.cjs", "server.ts"]);
  for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3065/api/native-key-info")).ok) break; } catch {} await espera(500); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u-teste").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
  const H = { "X-Assessor-Sessao": token, "x-use-native-key": "true" }, B = "http://localhost:3065";
  let vistas = 0;
  const chamar = async (extra) => { const fd = new FormData(); fd.append("degravacaoPronta", "[00:10] Autor: contratei a obra e recebi parte do valor combinado verbalmente. ".repeat(4)); fd.append("ataText", "ATA"); fd.append("pdfText", "Petição inicial. ".repeat(60)); fd.append("processNumber", "5129546-88.2025.8.09.0100"); for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const r = await fetch(B + "/api/mutirao-video", { method: "POST", headers: H, body: fd }); const j = JSON.parse((await r.text()).trim()); await espera(300); const todas = ((await (await fetch("http://127.0.0.1:8989/__mutirao")).json()).lista || []); const novas = todas.slice(vistas); vistas = todas.length; const alguma = (k) => novas.some((x) => x[k]); return { j, m: { usuario: alguma("usuario"), video: alguma("video"), regras: alguma("regras"), tempo: alguma("tempo"), n: novas.length } }; };
  let r = await chamar({ origemDegravacao: "texto", calibracaoMutirao: "1" });
  ok(r.j.success && r.j.motor === "principal", "texto colado: a sentença sai pelo motor principal");
  ok(r.m.n >= 1 && r.m.usuario === true && r.m.video === false && r.m.tempo === true, "texto colado: o motor recebe o rótulo 'fornecida pelo usuário' e a regra de não inventar minutos (não diz 'lida do vídeo')");
  ok(r.m.regras === true, "texto colado: as regras adicionais da sentença após audiência chegam ao motor");
  r = await chamar({ calibracaoMutirao: "1" });
  ok(r.j.success && r.m.video === true && r.m.usuario === false, "vídeos lidos pelo Studio: continua o rótulo de degravação 'lida do vídeo'");
  ok(r.m.regras === true, "vídeos (tela do Mutirão): as regras adicionais também chegam ao motor");
  r = await chamar({});
  ok(r.j.success && r.m.n >= 1 && r.m.regras === false && r.m.video === true, "pedido SEM a marca da tela do Mutirão (como a extensão): a instrução antiga, sem as regras novas");
} finally { for (const p of filhos) { try { process.kill(-p.pid, 9); } catch {} } }
if (falhas) process.exit(1); console.log("TUDO OK");
