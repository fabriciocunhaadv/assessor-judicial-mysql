import { existsSync, readFileSync } from "node:fs";
import { limparRuidoDeOcr } from "../../src/utils/ruidoOcr";
import { cleanJudicialPdfText } from "../../src/utils/judicialTextCleaner";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const lixo = Array.from({ length: 60 }, (_, i) => ["a", "ES", "|", "RS", "o", "SSS", "Ne", "-"][i % 8]).join("\n");
const cab = "Processo: 5000001-00.2026.8.09.0100\nMovimentacao 23 : Juntada -> Petição\nArquivo 9: 09_fotografias.pdf - Pag.7/20\nUsuário: X - Data: 27/10/2026\nValor: R$ 300,00\nAssinado por FULANO\nLocalizar pelo código: 123, no endereço: https://projudi.tjgo.jus.br/p\n";
const pagLixo = `[Página 5 de 9]\n${cab}${lixo}\n`;
const pagTexto = `[Página 6 de 9]\n${cab}${"O requerente solicita a guarda do menor, em razão da mudança de domicílio da genitora para outra comarca.\n".repeat(30)}`;
const r = limparRuidoDeOcr(pagLixo + pagTexto);
ok(r.paginas.length === 1 && r.paginas[0].pagina === 5 && r.paginas[0].mov === 23 && r.paginas[0].arquivo === "09_fotografias.pdf", "só a página de rabiscos é trocada e o carimbo (movimentação/arquivo) é guardado");
ok(r.texto.includes("página de imagem sem texto legível") && r.texto.includes("Movimentacao 23") && r.texto.includes("guarda do menor"), "o aviso e o carimbo ficam; a página de texto de verdade fica intacta");
ok(limparRuidoDeOcr(r.texto).paginas.length === 0, "idempotente: rodar de novo não muda nada");
const tabela = `[Página 7 de 9]\n${cab}${Array.from({ length: 40 }, (_, i) => `${i + 1}\nR$\nSim\nNão\nValor total do contrato ${i}\n`).join("")}`;
ok(limparRuidoDeOcr(tabela).paginas.length === 0, "tabela com muitas linhas curtas, mas com palavras reais, não é apagada");
const f1 = process.env.PROC_REAL_1 || "/tmp/proc_real.txt", f2 = process.env.PROC_REAL_2 || "/tmp/proc2.txt";
if (existsSync(f2)) { const t = readFileSync(f2, "utf8"), x = limparRuidoDeOcr(t); ok(x.paginas.length >= 150 && x.paginas.length <= 175, `processo real 2: ${x.paginas.length} páginas de ruído (esperado ~161)`); ok(x.charsEconomizados > 200_000, `processo real 2: economiza ${Math.round(x.charsEconomizados / 1000)}k caracteres`);
  const limpo = cleanJudicialPdfText(t); ok(/Movimentacao 214 : Julgamento/.test(limpo) && /JULGO EXTINTO o processo/.test(limpo) && /Movimentacao 225 : Autos Conclusos/.test(limpo), "a sentença (Mov. 214) e os conclusos (Mov. 225) continuam no texto limpo"); }
if (existsSync(f1)) { const x = limparRuidoDeOcr(readFileSync(f1, "utf8")); ok(x.paginas.length <= 4, `processo real 1: só ${x.paginas.length} páginas de ruído`); }
process.exit(falhas ? 1 : 0);
