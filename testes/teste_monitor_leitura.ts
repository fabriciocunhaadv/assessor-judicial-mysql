import { agregarUso, tokenConfere } from "../server/monitorLeitura";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const T = "a".repeat(40);
ok(tokenConfere(T, T), "token certo passa");
ok(!tokenConfere("b".repeat(40), T) && !tokenConfere("", T) && !tokenConfere(T, undefined) && !tokenConfere(T, "curto"), "token errado, vazio, ausente ou fraco (< 32) não passa");
const agora = Date.now(), h = (n: number) => agora - n * 3_600_000;
const linhas = [
  JSON.stringify({ timeMs: h(1), totalTokens: 1000, costBrl: 0.5, module: "lupa_magistrado", model: "gemini-3.6-flash", userEmail: "a@x.com", label: "Lupa (5001)" }),
  JSON.stringify({ timeMs: h(1), totalTokens: 3000, costBrl: 1.5, module: "gigante", model: "gemini-3.1-flash-lite", userEmail: "b@x.com", label: "Gigante lote" }),
  JSON.stringify({ timeMs: h(2), totalTokens: 500, costBrl: 0.1, module: "gigante", model: "gemini-3.1-flash-lite", userEmail: "b@x.com", label: "Gigante lote 2" }),
  JSON.stringify({ timeMs: h(99), totalTokens: 9999, module: "minuta", userEmail: "velho@x.com" }),      // fora da janela
  "{lixo", JSON.stringify(null), JSON.stringify({ timeMs: h(1) }),
];
const r = agregarUso(linhas, h(24));
ok(r.execucoes === 4 && r.tokens === 4500, `soma só o que está na janela: ${r.execucoes} execuções, ${r.tokens} tokens`);
ok(r.porModulo[0].modulo === "gigante" && r.porModulo[0].tokens === 3500 && r.porModulo[0].chamadas === 2, "módulo que mais gastou vem primeiro");
ok(r.porUsuario[0].usuario === "b@x.com" && r.porUsuario[0].modulos.gigante === 2, "usuário que mais gastou e em quais módulos");
ok(r.maiores[0].tokens === 3000 && r.porHora.length === 2 && r.porModelo[0].modelo === "gemini-3.1-flash-lite", "maiores execuções, por hora e por modelo");
ok(!JSON.stringify(r).includes("velho@x.com"), "execução antiga fica de fora");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
