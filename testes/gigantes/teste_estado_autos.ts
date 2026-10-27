import { conferenciasEstado, blocoIndiceMovimentacoes } from "../../src/utils/estadoDosAutos";
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
