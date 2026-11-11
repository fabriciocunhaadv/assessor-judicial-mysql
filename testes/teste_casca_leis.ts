import { readFileSync } from "fs";
import { paginaSoComCasca } from "../src/utils/paginaCasca";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const casca = '<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/js/app.js"></script></head><body><noscript><strong>legisla_publico_vue doesn\'t work properly without JavaScript enabled.</strong></noscript><div id="app"></div></body></html>';
ok(/casca/.test(paginaSoComCasca(casca)), "página vazia do site da Casa Civil (SPA) é reconhecida com orientação");
const lei = "<html><body><h1>Lei nº 17.034</h1>" + "<p>Art. 1º Fica instituído o programa de teste da legislação estadual para conferência das minutas. </p>".repeat(30) + "</body></html>";
ok(paginaSoComCasca(lei) === "", "lei com texto de verdade passa");
ok(paginaSoComCasca("<html><body>" + "<p>texto curto</p>" + "</body></html>") === "" , "página curta sem sinal de SPA não é barrada (o servidor decide)");
process.exit(falhas ? 1 : 0);
