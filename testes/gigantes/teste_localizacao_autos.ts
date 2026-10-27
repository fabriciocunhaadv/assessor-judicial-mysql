import { anotarLocalizacao, mapaDeLocalizacao, corrigirCitacoes, corrigirCitacoesDaMinuta } from "../../src/utils/localizacaoAutos";
import { cleanJudicialPdfText } from "../../src/utils/judicialTextCleaner";
const pg = (g: number, mov: number, tipo: string, arq: number, k: number, T: number) => `[Página ${g} de 30]\nTexto da página ${g}\nProcesso: 1\nMovimentacao ${mov} : ${tipo}\nArquivo ${arq}: d${arq}.pdf - Pag.${k}/${T}\nUsuário: Fulano - Data: 01/01/2026 10:00:00\n`;
const autos = pg(1, 1, "Peticão Enviada", 1, 1, 2) + pg(2, 1, "Peticão Enviada", 1, 2, 2) + pg(3, 8, "Juntada -> Petição", 1, 1, 1) + pg(4, 8, "Juntada -> Petição", 2, 1, 1) + pg(5, 8, "Juntada -> Petição", 3, 1, 2)
  + pg(6, 8, "Juntada -> Petição", 3, 2, 2) + pg(7, 103, "Juntada -> Petição", 20, 1, 3) + pg(8, 103, "Juntada -> Petição", 20, 2, 3) + pg(9, 120, "Juntada de Documento", 1, 1, 2) + pg(10, 120, "Juntada de Documento", 1, 2, 2);
// 1) anotação: linha com a localização real, idempotente, sem tocar nas páginas sem carimbo
const a1 = anotarLocalizacao(autos), a2 = anotarLocalizacao(a1);
if (!a1.includes("[Página 7 de 30]\n[Mov. 103 · Arq. 20 · Pág. 1/3]\n") || a1 !== a2) { console.error("FALHOU anotação"); process.exit(1); }
const limpo = cleanJudicialPdfText(autos);
if (!limpo.includes("[Mov. 103 · Arq. 20 · Pág. 2/3]")) { console.error("FALHOU limpeza leva a anotação"); process.exit(1); }
// 2) correção das citações
const mapa = mapaDeLocalizacao(autos);
const casos: [string, string][] = [
  ["Mov. 103, Arq. 1, Pág. 7", "Mov. 103, Arq. 20, Pág. 1"],              // arquivo errado e página global
  ["Mov. 120, Arq. 1, Págs. 9 a 10", "Mov. 120, Arq. 1, Págs. 1 a 2"],    // faixa global
  ["Mov. 8, Arq. 1, Págs. 3-6", "Mov. 8, Arqs. 1 a 3"],                   // faixa que passa por vários arquivos
  ["Mov. 1, Arq. 1, Pág. 2", "Mov. 1, Arq. 1, Pág. 2"],                   // já certa
  ["Mov. 103, Arq. 20, Pág. 2", "Mov. 103, Arq. 20, Pág. 2"],             // já certa
  ["Mov. 120, Arq. 1, Págs. 9 e 10", "Mov. 120, Arq. 1, Págs. 9 e 10"],   // lista: não mexe
  ["Mov. 5, Arq. 1, Pág. 7", "Mov. 5, Arq. 1, Pág. 7"],                   // a página 7 é de outra movimentação: não prova, não mexe
  ["Mov. 103, Arq. 1, Pág. 25", "Mov. 103, Arq. 1, Pág. 25"],             // página sem carimbo no mapa: não mexe
];
const erros = casos.filter(([i, esperado]) => corrigirCitacoes(i, mapa).texto !== esperado).map(([i, e]) => `${i} => ${corrigirCitacoes(i, mapa).texto} (esperado ${e})`);
const m: any = { relatorio: "Cf. (Mov. 103, Arq. 1, Pág. 8).", n: 3 }; const n = corrigirCitacoesDaMinuta(m, autos);
if (n !== 1 || m.relatorio !== "Cf. (Mov. 103, Arq. 20, Pág. 2).") erros.push("minuta: " + m.relatorio);
if (erros.length) { console.error(erros.join("\n")); process.exit(1); }
console.log("OK", casos.length + 3, "casos");
// a limpeza junta a linha da localização com o texto seguinte: anotar de novo (cliente e servidor limpam o mesmo texto) não pode duplicar
const dupla = cleanJudicialPdfText(cleanJudicialPdfText(autos));
if ((dupla.match(/\[Mov\. 103 · Arq\. 20 · Pág\. 1\/3\]/g) || []).length !== 1) { console.error("FALHOU duplicidade após limpar duas vezes"); process.exit(1); }
console.log("OK sem duplicar");
