// Layout das minutas de IAs externas (Jusbrasil, Claude, Gemini…). Rodar: npx tsx testes/teste_layout_externa.ts
import { organizarMinutaExterna, limparArtefatosDeIA, marcarCitacoes, htmlParaMarkdown } from "../src/utils/organizarMinutaExterna";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const EMENTA = "AGRAVO DE INSTRUMENTO. AÇÃO DE DIVÓRCIO. POSTERGAÇÃO DO PEDIDO DE GUARDA. SUPRESSÃO DE INSTÂNCIA. ALIMENTOS PROVISÓRIOS. OBSERVÂNCIA DO BINÔMIO NECESSIDADE/POSSIBILIDADE. 1- A análise do pedido de guarda que foi postergado pela juíza de primeiro grau implicaria em inadmissível supressão de instância. 2- A fixação dos alimentos depende da observância da necessidade do alimentando. (TJ-GO - AI: 00958458420198090000, Relator: JAIRO FERREIRA JUNIOR, Data de Julgamento: 24/06/2019, 6ª Câmara Civil, Data de Publicação: DJ de 24/06/2019)";
const TEXTO = `PODER JUDICIÁRIO\n\nDECISÃO INTERLOCUTÓRIA\n\nI - RELATÓRIO\nTrata-se de ação de alimentos cumulada com guarda proposta por Monara em face de Tarles.\n\nII - FUNDAMENTAÇÃO\nOs documentos mencionados na Mov. 55 foram apreciados em conjunto.\n\nVer fontes\n\n${EMENTA} Marca Jusbrasil\n\nValidar citações\n\nReescrever Buscar julgados Perguntar\n\nIII - DISPOSITIVO\nDiante do exposto, acolho parcialmente os pedidos.\n\nCopiar\nBaixar\n\nMonte Claros de Goiás, 09/11/2026.`;
ok(!/Marca Jusbrasil/.test(limparArtefatosDeIA("fim) Marca Jusbrasil")), "tira “Marca Jusbrasil”");
ok(limparArtefatosDeIA("(TJ-GO) Marca Jusbrasil10. TJ-GO - AI: 1").includes("\n\n10. TJ-GO"), "separa o item numerado colado");
ok(limparArtefatosDeIA("a\n\nCopiar\nBaixar\nVer fontes\nValidar citações\nb") === "a\n\nb", "tira linhas de botões");
ok(marcarCitacoes(EMENTA).startsWith("> AGRAVO"), "ementa vira citação em bloco");
ok(!marcarCitacoes("Trata-se de ação de alimentos cumulada com guarda proposta por Monara em face de Tarles, na qual a autora alega diversos fatos longos que não são ementa alguma e continuam por bastante texto para passar de cento e oitenta caracteres sim.").startsWith(">"), "parágrafo comum não vira citação");
ok(!marcarCitacoes("Conforme precedente (TJ-GO - AI: 1), a tese prevalece. " + "texto ".repeat(40)).startsWith(">"), "texto em minúsculas citando tribunal não vira citação");
const o = organizarMinutaExterna(TEXTO, "");
ok(!/Marca Jusbrasil|Validar citações|Ver fontes|Buscar julgados/.test(o.fundamentacao + o.relatorio + o.dispositivo), "nenhum resto da tela nas seções");
ok(/(^|\n)> AGRAVO DE INSTRUMENTO/.test(o.fundamentacao), "ementa em citação dentro da fundamentação: " + o.fundamentacao.slice(0, 120).replace(/\n/g, "⏎"));
ok(!/\nCopiar|Baixar/.test(o.dispositivo + o.closing) && /acolho parcialmente/.test(o.dispositivo), "dispositivo limpo");
ok(/^## Fundamento legal/m.test(htmlParaMarkdown("<h3>Fundamento legal</h3><p>texto</p>")), "título dentro do texto vira subtítulo");
if (falhas) process.exit(1); console.log("TUDO OK");
