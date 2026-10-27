import { matchApplicableBindingPrecedents } from "../../src/utils/bindingPrecedents";
import { citacoesInexistentes, anotarLocalizacao } from "../../src/utils/localizacaoAutos";
import { reduzirPorRelevancia } from "../../src/utils/autosGrandes";
import { legislacaoAplicavelAoCaso } from "../../src/utils/legislacaoPlanalto";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
(async () => {
  // 1) súmulas: a de maior aderência vem primeiro (não a primeira do cadastro)
  const base = (id: string, number: string, tags: string[]): any => ({ id, number, title: "tema " + id, tribunal: "STJ", area: "Geral", tags, statement: "x", sourceUrl: "" });
  const extra = [base("a", "Súmula 1", ["alfa", "beta"]), base("b", "Súmula 2", ["alfa"]), base("c", "Súmula 3", ["alfa", "beta", "gama", "delta", "epsilon"]), base("d", "Súmula 4", ["alfa", "beta", "gama"])];
  const r = matchApplicableBindingPrecedents("alfa beta gama delta epsilon", extra).filter((p) => ["a", "b", "c", "d"].includes(p.id));
  ok(r.map((p) => p.id).join("") === "cda", "ordem por aderência: " + r.map((p) => p.id).join(""));

  // 2) citações inexistentes
  const pag = (g: number, mov: number, arq: number, k: number, t: number) => `[Página ${g} de 30]\ntexto\nMovimentacao ${mov} : Petição\nArquivo ${arq}: x.pdf - Pag.${k}/${t}\n`;
  const autos = Array.from({ length: 24 }, (_, i) => pag(i + 1, 5, 1, (i % 8) + 1, 8)).join("") + pag(25, 7, 2, 1, 3);
  const bad = citacoesInexistentes("Conforme Mov. 5, Arq. 3, Pág. 1; Mov. 7, Arq. 2, Pág. 9; Mov. 5, Arq. 1, Pág. 2; Mov. 99, Arq. 1, Pág. 1.", autos);
  ok(bad.length === 2 && /Arq\. 3/.test(bad[0].citacao) && /Pág\. 9/.test(bad[1].citacao), "citações inexistentes achadas (2) e mov desconhecida ignorada: " + JSON.stringify(bad.map((b) => b.citacao)));

  // 3) redução por relevância: tira o dispensável, mantém o essencial
  const grande = Array.from({ length: 60 }, (_, i) => `[Página ${i + 1} de 60]\n` + (i % 3 === 0 ? "DISPENSAVEL " : "ESSENCIAL ") + "palavra".repeat(40) + ` pagina${i + 1} ` + Array.from({ length: 300 }, (_, k) => `w${i}x${k}y${(i * 7919 + k * 104729) % 99991}`).join(" ")).join("\n");
  const gerar = async (o: any) => ({ text: JSON.stringify({ segmentos: Array.from({ length: 60 }, (_, i) => ({ de: i + 1, ate: i + 1, classe: i % 3 === 0 ? "dispensavel" : "essencial", motivo: "teste" })) }) });
  process.env.AUTOS_GRANDES_PAUSA_MS = "1";
  const red = await reduzirPorRelevancia(gerar, { texto: grande, permitido: Math.floor(grande.length * 0.8), base: {} });
  ok(red && red.cabe && red.omitidas === 20 && red.essenciais === 40 && red.texto.includes("[Página 1 omitida") && red.texto.includes("pagina2 "), "redução: 20 omitidas, 40 essenciais mantidas");
  const semMarcador = await reduzirPorRelevancia(gerar, { texto: "sem paginas ".repeat(10000), permitido: 1000, base: {} });
  ok(semMarcador === null, "sem marcadores de página: devolve null (cai no corte antigo)");
  const pequeno = await reduzirPorRelevancia(gerar, { texto: grande, permitido: grande.length * 2, base: {} });
  ok(pequeno && pequeno.omitidas === 0 && pequeno.cabe, "cabe depois da compactação: nada é omitido");

  // 4) lei aplicável: sem rede, devolve vazio sem lançar
  const l = await legislacaoAplicavelAoCaso("cobrança indevida em cartão de crédito, relação de consumo, juros", { timeoutMs: 500 });
  ok(typeof l.bloco === "string" && Array.isArray(l.artigos), "lei aplicável: não lança erro (artigos: " + l.artigos.length + ")");
  process.exit(falhas ? 1 : 0);
})();
