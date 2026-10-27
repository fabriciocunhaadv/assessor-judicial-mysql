import { extrairUso, contarUsoNoServidor } from "../../server/usoNoServidor";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const a = extrairUso({ usage: { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 }, modelUsed: "gemini-flash", minute: { processNumber: "123" } });
ok(a && a.total === 1200 && a.prompt === 1000 && a.saida === 200 && a.processo === "123", "generate-minute/audit/hearing: usage");
const b = extrairUso({ stats: { tokensUsed: 5000, promptTokens: 4000, candidatesTokens: 1000, modelUsed: "lite" } });
ok(b && b.total === 5000 && b.modelo === "lite", "turbo: stats");
ok(extrairUso({ minute: {} }) === null && extrairUso(null) === null, "sem consumo: nada a contar");
// middleware: sem cabeçalho não conta; com cabeçalho e rota errada não conta
let chamou = 0; const res: any = { statusCode: 200, write() { return true; }, end() { return true; } };
const mw = contarUsoNoServidor(() => false);
mw({ method: "POST", headers: {}, baseUrl: "/api/generate-minute", usuarioSessao: {} } as any, res, () => chamou++);
const fim0 = res.end; ok(chamou === 1 && res.end === fim0, "sem o cabeçalho X-Uso-No-Servidor não interfere");
mw({ method: "POST", headers: { "x-uso-no-servidor": "1" }, baseUrl: "/api/outra", usuarioSessao: {} } as any, res, () => chamou++);
ok(chamou === 2 && res.end === fim0, "rota fora da lista não interfere");
mw({ method: "POST", headers: { "x-uso-no-servidor": "1" }, baseUrl: "/api/generate-minute", usuarioSessao: {} } as any, res, () => chamou++);
ok(chamou === 3 && res.end !== fim0, "rota de IA com o cabeçalho passa a ser observada");
res.end("{ \"erro\": 1"); // JSON inválido não pode quebrar
process.exit(falhas ? 1 : 0);
