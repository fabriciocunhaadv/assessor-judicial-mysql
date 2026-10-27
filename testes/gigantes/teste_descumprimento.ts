import { detectarDescumprimento } from "../../src/utils/descumprimentoDeDeterminacao";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const pg = (g: number, mov: number, tipo: string, txt: string) => `[Página ${g} de 30]\n${txt}\nMovimentacao ${mov} : ${tipo}\nArquivo 1: x.pdf - Pag.1/1\n`;
const base = (extra: string[]) => [pg(1, 1, "Petição Inicial", "Trata-se de ação de inventário e partilha movida por GISLENE. ".repeat(10)), ...extra].join("");
// caso do Mayk: emenda parcial (Mov 8), nova determinação com advertência (Mov 20), intimação, certidão de decurso, conclusos
const mayk = base([
  pg(2, 5, "Despacho", "Emende a inicial no prazo de 15 dias, sob pena de indeferimento."), pg(3, 8, "Petição", "A autora junta parte dos documentos."),
  pg(4, 10, "Decisão", "Junte a certidão negativa de testamento."), pg(5, 13, "Petição", "Pede dilação de 30 dias."),
  pg(6, 20, "Despacho", "Intime-se a parte autora para, no prazo improrrogável de 5 dias, juntar os documentos faltantes, sob pena expressa de indeferimento da inicial e extinção do processo sem resolução do mérito."),
  pg(7, 21, "Intimação", "Intimação expedida."), pg(8, 22, "Publicação", "Publicado no DJe."), pg(9, 23, "Certidão", "Certifico que o prazo assinalado decorreu sem qualquer manifestação ou juntada documental pela promovente."), pg(10, 24, "Conclusos para sentença", "Conclusos.")]);
const r = detectarDescumprimento(mayk);
ok(r && r.decide && r.tipo === "indeferimento_inicial" && r.movDeterminacao === 20 && r.movDecurso === 23 && r.parcial, "caso do Mayk: detecta indeferimento (Mov. 20 → 23, cumprimento parcial anterior): " + (r ? JSON.stringify({ d: r.decide, t: r.tipo, m1: r.movDeterminacao, m2: r.movDecurso, p: r.parcial }) : "null"));
// prazo em curso (sem certidão)
const curso = base([pg(2, 5, "Despacho", "Emende a inicial no prazo de 15 dias, sob pena de indeferimento da inicial."), pg(3, 6, "Intimação", "Intimação expedida para a parte autora.")]);
ok(detectarDescumprimento(curso) === null, "prazo em curso, sem certidão: não decide");
// parte cumpriu depois
const cumpriu = base([pg(2, 5, "Despacho", "Emende a inicial no prazo de 15 dias, sob pena de indeferimento da inicial."), pg(3, 7, "Petição", "Emenda à inicial com os documentos."), pg(4, 8, "Certidão", "Certifico que o prazo decorreu.")]);
const c = detectarDescumprimento(cumpriu);
ok(c && !c.decide && c.possivelCumprimento, "peça da parte depois da determinação: não decide, avisa possível cumprimento");
// já sentenciado depois
ok(detectarDescumprimento(mayk + pg(11, 25, "Sentença", "Indefiro a petição inicial e julgo extinto o processo.")) === null, "sentença já proferida depois: não decide de novo");
// variações de certidão
for (const cert of ["Certifico e dou fé que o prazo transcorreu in albis.", "Decurso de prazo: a parte autora não se manifestou.", "Prazo decorrido sem cumprimento da emenda pela autora."]) {
  const t = base([pg(2, 5, "Despacho", "Intime-se para cumprir no prazo de 5 dias, sob pena de extinção."), pg(3, 9, "Certidão", cert)]);
  const x = detectarDescumprimento(t); ok(x && x.decide && x.tipo === "extincao", "variação de certidão detectada: " + cert.slice(0, 45));
}
process.exit(falhas ? 1 : 0);
