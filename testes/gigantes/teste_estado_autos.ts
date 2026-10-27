import { conferenciasEstado, blocoIndiceMovimentacoes, corrigirPaginasGlobais, corrigirPaginasDaMinuta, REGRA_ESTADO_ATUAL } from "../../src/utils/estadoDosAutos";
const carimbo = (n: number, tipo: string, a: number, k: number, T: number) => `Processo: 1\nMovimentacao ${n} : ${tipo}\nArquivo ${a}: x.pdf - Pag.${k}/${T} Usuário: Z\n`;
const autos = carimbo(1, "Peticão Enviada", 1, 1, 20) + carimbo(5, "Decisão -> Deferimento em Parte", 1, 1, 3) + carimbo(6, "Juntada -> Petição", 1, 1, 11) + carimbo(7, "Ofício Respondido", 1, 1, 1)
  + "Movimentacao 8 : Autos Conclusos\n1. A movimentação: ( Autos Conclusos - P/ DECISÃO ) do dia\n13/10/2026 08:50:06 não possui \"Arquivos\".\n";
const ruim = { relatorio: "Citados (Mov. 1, Arq. 1, Pág. 77). Ab initio, in albis.", dispositivo: "Designo audiência para o dia 15/10/2026." };
const bom = { relatorio: "Conforme Mov. 6 e Mov. 7 (Mov. 6, Arq. 1, Pág. 8).", dispositivo: "Designo audiência para o dia 24/11/2026." };
const r = conferenciasEstado(ruim, autos, "sentenca"), b = conferenciasEstado(bom, autos, "decisao");
console.log(JSON.stringify(r)); console.log(JSON.stringify(b)); console.log(blocoIndiceMovimentacoes(autos));
if (!r.avisoCitacao?.length || r.avisoPendencia?.join() !== "6,7" || r.avisoData !== "15/10/2026" || r.avisoLatim?.length !== 2 || !r.avisoAto) { console.error("FALHOU ruim"); process.exit(1); }
if (Object.keys(b).length) { console.error("FALHOU bom", b); process.exit(1); }
console.log("OK");

// página global -> página do arquivo (o carimbo fica no rodapé de cada página)
const pg = (g: number, mov: number, arq: number, k: number, T: number) => `[Página ${g} de 20]\nTexto da página ${g}\nProcesso: 1\nMovimentacao ${mov} : Juntada\nArquivo ${arq}: d.pdf - Pag.${k}/${T} Usuário: Z\n`;
const glob = pg(10, 120, 1, 1, 3) + pg(11, 120, 1, 2, 3) + pg(12, 120, 1, 3, 3) + pg(13, 130, 1, 1, 1);
const c1 = corrigirPaginasGlobais("(Mov. 120, Arq. 1, Págs. 10 a 12) e (Mov. 130, Arq. 1, Pág. 13)", glob);
const c2 = corrigirPaginasGlobais("(Mov. 120, Arq. 1, Págs. 10 e 11)", glob);      // lista com "e": não mexe
const c3 = corrigirPaginasGlobais("(Mov. 130, Arq. 1, Pág. 10)", glob);           // Mov. não bate com a página global: não mexe
const c4 = corrigirPaginasGlobais("(Mov. 120, Arq. 1, Págs. 1 a 3)", glob);      // já é do arquivo
const m: any = { relatorio: "(Mov. 120, Arq. 1, Pág. 11)", titulo: 5 };
const n = corrigirPaginasDaMinuta(m, glob);
console.log(c1.texto, "|", c2.texto, "|", c3.texto, "|", c4.texto, "|", m.relatorio);
if (c1.texto !== "(Mov. 120, Arq. 1, Págs. 1 a 3) e (Mov. 130, Arq. 1, Pág. 1)" || c2.trocas || c3.trocas || c4.trocas || n !== 1 || m.relatorio !== "(Mov. 120, Arq. 1, Pág. 2)") { console.error("FALHOU páginas"); process.exit(1); }
if (!/não designe data específica/.test(REGRA_ESTADO_ATUAL)) { console.error("FALHOU regra audiência"); process.exit(1); }
console.log("OK páginas");
