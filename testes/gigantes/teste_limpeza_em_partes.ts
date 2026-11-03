// A limpeza do texto em partes (autos grandes) tem de dar EXATAMENTE o mesmo resultado que limpar tudo de uma vez.
import { cleanJudicialPdfText, limparEmPartes } from "../../src/utils/judicialTextCleaner";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const palavras = "O autor relata que contratou os serviços da ré e que houve falha na prestação com cobranças indevi- \ndas requerendo restituição dos valores pagos e indenização por danos morais conforme documentos juntados".split(" ");
function pagina(i: number, total: number): string {
  let corpo = ""; for (let k = 0; k < 140; k++) corpo += palavras[(i + k) % palavras.length] + (k % 12 === 11 ? "\n" : " ");
  const extra = i % 7 === 0 ? "\nCERTIDÃO DE INTIMAÇÃO ELETRÔNICA cumprida em 10/10/2026\nOutra linha\n" : i % 11 === 0 ? "\nI - RELATÓRIO\nTrata-se de pedido.\nDecido.\n" : i % 13 === 0 ? "\nAssinado eletronicamente por: Fulano de Tal\nValide em: https://projudi.tjgo.jus.br/x\n" : "";
  return `[Página ${i} de ${total}]\nProcesso: 5530114-61.2025.8.09.0166\nMovimentacao ${Math.ceil(i / 3)} : Juntada -> Petição\nArquivo ${(i % 3) + 1}: peca.pdf - Pag.${(i % 3) + 1}/3\nUsuário: Fulano - Data: 19/10/2026 08:39:07\n${corpo}${extra}\nDocumento Assinado Digitalmente em 22/06/2026 10:27:57\nLocalizar pelo código: ${100000 + i}`;
}
for (const n of [800, 1200]) {
  const bruto = Array.from({ length: n }, (_, i) => pagina(i + 1, n)).join("\n\n");
  const inteiro = cleanJudicialPdfText(bruto);
  let cedeu = 0; const emPartes = await limparEmPartes(bruto, async () => { cedeu++; });
  ok(bruto.length > 600000, `amostra de ${n} páginas passa do limite do modo em partes (${(bruto.length / 1048576).toFixed(1)} MB)`);
  ok(emPartes === inteiro, `${n} páginas: limpeza em partes idêntica à limpeza inteira (${inteiro.length} caracteres)`);
  ok(cedeu >= 4, `${n} páginas: devolveu o controle à tela entre as partes (${cedeu}x)`);
}
const pequeno = Array.from({ length: 30 }, (_, i) => pagina(i + 1, 30)).join("\n\n");
ok(await limparEmPartes(pequeno) === cleanJudicialPdfText(pequeno), "texto pequeno: igual, sem partes");
ok(await limparEmPartes("") === "" && await limparEmPartes(undefined as any) === "", "entrada vazia");
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); process.exit(falhas ? 1 : 0);
