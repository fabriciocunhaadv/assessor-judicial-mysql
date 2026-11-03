// "Art. 85 - A gratificação..." é travessão + texto (e não o artigo 85-A): o artigo tem de ser localizado; "Art. 52-A." continua sendo o artigo 52-A.
import { trechoDoArtigo } from "../../src/utils/legislacaoPlanalto";
import { extrairArtigos } from "../../server/fontesOficiais";
const L = ["Art. 56 - A cada dois anos o servidor terá licença.", "Art. 57 - Os servidores terão férias.", "Art. 85- A gratificação de insalubridade não poderá ser superior a 20%.", "Art. 52-A. As emendas serão obrigatórias.", "§ 1º - Texto.", "Art. 52-B. Outro.", "Art. 81 - Os servidores que trabalham."];
let falhas = 0; const ok = (c: boolean, m: string) => { console.log((c ? "ok: " : "FALHOU: ") + m); if (!c) falhas++; };
for (const a of ["56", "57", "85", "81", "52-A", "52-B"]) ok(!!trechoDoArtigo(L, a), `acha o art. ${a}`);
ok(trechoDoArtigo(L, "52") === null, "não confunde 52 com 52-A");
const k = Object.keys(extrairArtigos(L).artigos);
ok(["56", "57", "85", "81", "52-A", "52-B"].every((x) => k.includes(x)) && !k.includes("85-A") && !k.includes("56-A"), "contagem sem artigos fantasmas 85-A/56-A: " + k.join(","));
process.exit(falhas ? 1 : 0);
