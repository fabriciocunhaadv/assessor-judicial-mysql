import { regraArgumentoResposta, atoParaArgumentos, conferirArgumentoResposta, trechoNaMinuta, INSTRUCAO_MATRIZ_ARGUMENTOS, REGRA_LUPA_ARGUMENTO_RESPOSTA } from "../src/utils/argumentosResposta";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
// ---- classificação do ato
ok(atoParaArgumentos("sentenca") === "sentenca" && atoParaArgumentos("SENTENÇA") === "sentenca", "sentença");
ok(atoParaArgumentos("decisao") === "decisao" && atoParaArgumentos("DECISÃO INTERLOCUTÓRIA") === "decisao" && atoParaArgumentos("tutela de urgência") === "decisao", "decisão interlocutória");
ok(atoParaArgumentos("DECISÃO DE SANEAMENTO E ORGANIZAÇÃO") === "saneamento", "saneamento (antes de decisão)");
ok(atoParaArgumentos("DECISÃO - EMBARGOS DE DECLARAÇÃO") === "embargos", "embargos (antes de decisão)");
ok(atoParaArgumentos("despacho") === "despacho" && atoParaArgumentos("auto") === "indefinido" && atoParaArgumentos(undefined) === "indefinido", "despacho e indefinido");
// ---- a regra
const geral = regraArgumentoResposta("auto");
for (const [rx, m] of [[/ARGUMENTO × RESPOSTA/, "cabeçalho Argumento × Resposta"], [/489, § 1º, IV/, "art. 489, § 1º, IV"], [/acolhido, rejeitado ou prejudicado/, "cada argumento recebe resposta"], [/subsidiários/, "inclui argumentos subsidiários"], [/NÃO a imprima como título/, "etapa interna, sem título"], [/RELAÇÃO ALEGADA E MEIOS DE PROVA/, "B: relação alegada e meios de prova"], [/não figure nele|não é signatária/, "B: documento de terceiros prova fatos"], [/ajuste verbal ou tácito/, "B: ajuste verbal"], [/FATO ADMITIDO OU INCONTROVERSO/, "C: fato admitido"], [/art\. 374, II e III/, "C: art. 374"], [/art\. 341/, "C: impugnação específica"], [/PENAL e INFRACIONAL não há presunção/, "C: penal sem presunção de veracidade"], [/REGRAS DO PROCEDIMENTO DA MATÉRIA/, "procedimento da matéria"], [/Lei 9\.099\/1995/, "juizados"], [/art\. 525, § 1º/, "cumprimento de sentença"]] as [RegExp, string][]) ok(rx.test(geral), m);
ok(/NA SENTENÇA:/.test(regraArgumentoResposta("sentenca")) && !/NO SANEAMENTO/.test(regraArgumentoResposta("sentenca")), "cláusula da sentença");
ok(/NO SANEAMENTO/.test(regraArgumentoResposta("DECISÃO DE SANEAMENTO")) && /INCONTROVERSOS/.test(regraArgumentoResposta("DECISÃO DE SANEAMENTO")), "cláusula do saneamento (fatos incontroversos)");
ok(/NOS EMBARGOS DE DECLARAÇÃO/.test(regraArgumentoResposta("embargos de declaração")) && /art\. 1\.022/.test(regraArgumentoResposta("embargos de declaração")), "cláusula dos embargos");
ok(/NO DESPACHO/.test(regraArgumentoResposta("despacho")), "cláusula do despacho");
ok(/DECISÃO INTERLOCUTÓRIA/.test(regraArgumentoResposta("decisao")) && /não antecipe o mérito/.test(regraArgumentoResposta("decisao")), "cláusula da interlocutória");
ok(!/Lindomar|Stefany|Iporá|5079130|53\.143|19\.079|empreitada|Caixa/i.test(regraArgumentoResposta("auto") + INSTRUCAO_MATRIZ_ARGUMENTOS + REGRA_LUPA_ARGUMENTO_RESPOSTA), "nenhum dado de um processo em particular");
ok(/argumentoVsResposta/.test(INSTRUCAO_MATRIZ_ARGUMENTOS) && /nao_enfrentado/.test(INSTRUCAO_MATRIZ_ARGUMENTOS) && /No máximo 15 itens/.test(INSTRUCAO_MATRIZ_ARGUMENTOS), "instrução da matriz da etapa 2");
ok(/omissao/.test(REGRA_LUPA_ARGUMENTO_RESPOSTA) && /autosTrecho/.test(REGRA_LUPA_ARGUMENTO_RESPOSTA) && /NÃO aponte como omissão/.test(REGRA_LUPA_ARGUMENTO_RESPOSTA), "Lupa: omissão provada com trecho dos autos e sem falso alerta");
// ---- conferência da matriz
const minuta = { relatorio: "Relatório do caso.", fundamentacao: "A preliminar de ilegitimidade passiva suscitada pela ré deve ser rejeitada, pois a ré figura como contratante no documento de Mov. 5. Quanto ao pedido de danos morais, o autor não comprovou abalo anímico além do mero aborrecimento.", dispositivo: "Julgo parcialmente procedente o pedido." };
const matriz = [
  { parte: "reu", argumento: "ilegitimidade passiva", localizacao: "Mov. 31, Arq. 1, Pág. 2", resultado: "rejeitado", trechoNaMinuta: "A preliminar de ilegitimidade passiva suscitada pela ré deve ser rejeitada" },
  { parte: "autor", argumento: "danos morais", localizacao: "Mov. 1", resultado: "rejeitado", trechoNaMinuta: "o autor não comprovou abalo anímico além do mero aborrecimento" },
  { parte: "reu", argumento: "prescrição", localizacao: "Mov. 31, Pág. 4", resultado: "nao_enfrentado", trechoNaMinuta: "" },
  { parte: "autor", argumento: "inversão do ônus", localizacao: "Mov. 1", resultado: "acolhido", trechoNaMinuta: "inverto o ônus da prova com base no código do consumidor em razão da hipossuficiência técnica" },
  { parte: "reu", argumento: "tese subsidiária de compensação", localizacao: "Mov. 31", resultado: "prejudicado", trechoNaMinuta: "" },
];
const c = conferirArgumentoResposta(matriz, minuta)!;
ok(c.total === 5 && c.respondidos === 3, "conta os argumentos e os respondidos (inclui o declarado prejudicado)");
ok(c.semResposta.length === 1 && c.semResposta[0].argumento === "prescrição", "aponta o argumento não enfrentado");
ok(c.naoLocalizados.length === 1 && c.naoLocalizados[0].argumento === "inversão do ônus", "aponta a resposta cujo trecho não está na minuta");
ok(conferirArgumentoResposta([], minuta) === null && conferirArgumentoResposta(undefined, minuta) === null && conferirArgumentoResposta("x" as any, minuta) === null, "sem matriz: nada a conferir (sem aviso)");
ok(trechoNaMinuta("A PRELIMINAR de ilegitimidade passiva suscitada pela ré", minuta.fundamentacao), "o trecho confere sem importar maiúsculas e acentos");
ok(trechoNaMinuta("a preliminar de ilegitimidade passiva foi suscitada e deve ser rejeitada pois a ré figura como contratante", minuta.fundamentacao) , "paráfrase próxima confere por quatro palavras seguidas");
ok(!trechoNaMinuta("texto que não aparece em lugar nenhum da minuta apresentada aqui", minuta.fundamentacao), "texto ausente não confere");
const lixo = conferirArgumentoResposta([{ argumento: "" }, null, 5, { argumento: "x", resultado: "RejeitadO", trechoNaMinuta: "o autor não comprovou abalo anímico" }], minuta)!;
ok(lixo.total === 1 && lixo.respondidos === 1, "ignora itens inválidos e normaliza o resultado");
process.exit(falhas ? 1 : 0);
