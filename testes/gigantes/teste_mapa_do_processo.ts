import { estimarTokens, resumirMovimentacoes, precisaDeMapa, dividirParaMapa, normalizarMapa, blocoDoMapa, conferirComMapa } from "../../src/utils/mapaDoProcesso";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const processo = (movs: number, tam = 1500) => {
  let g = 0; const total = movs; const paginas: string[] = [];
  for (let m = 1; m <= movs; m++) { g++; paginas.push(`[Página ${g} de ${total}]\nTexto da movimentação ${m}. ${"conteúdo do ato ".repeat(Math.ceil(tam / 16))}\nMovimentacao ${m} : ${m === 148 ? "Decisão" : "Intimação"}\nArquivo 1: ato${m}.pdf - Pag.1/1\n`); }
  return paginas.join("");
};
const p157 = processo(157), p100 = processo(100);
const r = resumirMovimentacoes(p157);
ok(r.movs === 157 && r.ultima === 157, `conta 157 movimentações e a última é a 157 (${r.movs}/${r.ultima})`);
ok(precisaDeMapa(processo(60, 8000)) && !precisaDeMapa(processo(300, 500)), "o mapa depende do volume em tokens, não do número de movimentações: 60 movimentações grandes usam o mapa, 300 pequenas não");
const partes = dividirParaMapa(p157, 40_000);
ok(partes.length > 3 && partes.every((x) => x.texto.length <= 40_000 + 2000), `divide em ${partes.length} partes pequenas`);
ok(partes.map((x) => x.texto).join("") === p157, "as partes juntas reproduzem os autos, sem perda e na ordem");
ok(partes.every((x, i) => i === 0 || x.movDe > partes[i - 1].movAte - 1) && partes[partes.length - 1].movAte === 157, "as partes seguem a ordem cronológica até a última movimentação");
ok(partes.every((x) => /^\[Página/.test(x.texto)), "cada parte começa em início de página (nunca no meio de uma peça)");
const bruto = { numeroProcesso: "5000001-00.2026.8.09.0042", estadoAtual: { questaoAtual: "Deliberar sobre a alienação dos imóveis do espólio e a avaliação judicial pendente", pendencias: ["avaliação dos imóveis", "habilitação do inventariante"], vigentes: ["Mov. 71: gratuidade indeferida"] },
  eventos: [{ mov: 71, tipo: "Decisão", resumo: "Indeferiu a gratuidade", situacao: "em_vigor" }, { mov: 999, tipo: "Decisão", resumo: "inventada", situacao: "em_vigor" }, { mov: 148, tipo: "Decisão", resumo: "Determinou nova avaliação", determinou: "avaliar os imóveis", situacao: "pendente" }, { mov: 5, tipo: "Intimação", resumo: "rotina", situacao: "informativo" }] };
const mapa = normalizarMapa(bruto, p157)!;
ok(!!mapa && mapa.eventos.every((e) => e.mov !== 999) && mapa.eventos.length === 3, "descarta evento de movimentação que não existe nos autos");
ok(mapa.eventos[0].mov === 5 && mapa.eventos[2].mov === 148, "eventos ordenados por movimentação");
const mapaFase = normalizarMapa({ ...bruto, faseAtual: { fase: "SENTENCIADO", sentencaMov: 148, atoEsperado: "decidir a petição posterior à sentença", naoRepetir: ["Mov. 148: sentença proferida"] } }, p157)!;
ok(mapaFase.faseAtual?.sentencaMov === 148 && /FASE ATUAL/.test(blocoDoMapa(mapaFase)) && /NÃO refazer/.test(blocoDoMapa(mapaFase)), "a fase atual (sentenciado, ato esperado, o que não repetir) entra no bloco do mapa");
ok(normalizarMapa({ ...bruto, faseAtual: { fase: "x", sentencaMov: 9999, atoEsperado: "y" } }, p157)!.faseAtual?.sentencaMov === undefined, "sentença em movimentação que não existe é descartada");
const novaSentenca = "SENTENÇA\n\nI - RELATÓRIO\nTrata-se de ação de guarda.\nIII - DISPOSITIVO\nJULGO PROCEDENTE o pedido de guarda.";
ok(conferirComMapa(novaSentenca, mapaFase).some((x) => x.codigo === "fase"), "avisa quando o mapa diz que já há sentença e a minuta é uma nova sentença sem citar a anterior");
ok(!conferirComMapa("DECISÃO\n\nTrata-se de petição posterior à sentença (Mov. 148). Indefiro o pedido de nova entrevista.", mapaFase).some((x) => x.codigo === "fase"), "decisão sobre petição posterior que cita a sentença não dispara o aviso de fase");
const bloco = blocoDoMapa(mapa);
ok(/ESTADO ATUAL/.test(bloco) && /alienação dos imóveis/.test(bloco) && /Mov\. 148/.test(bloco) && !/rotina/.test(bloco), "o bloco traz o estado atual e a linha do tempo dos atos relevantes (sem a rotina)");
const minutaCurta = "I - RELATÓRIO\nHouve decisão (Mov. 71, Arq. 1, Pág. 1) e despacho (Mov. 119, Arq. 1, Pág. 1).\nII - FUNDAMENTAÇÃO\nTrata da gratuidade.\nIII - DISPOSITIVO\nDefiro.";
const a1 = conferirComMapa(minutaCurta, mapa);
ok(a1.some((x) => x.codigo === "cobertura" && /148/.test(x.texto) && /119/.test(x.texto)), "avisa quando a minuta para na Mov. 119 e há decisão na 148");
ok(a1.some((x) => x.codigo === "questao_atual"), "avisa quando a minuta não menciona a questão atual do mapa");
const minutaBoa = "Relatório (Mov. 71, Arq. 1, Pág. 1) e decisão (Mov. 148, Arq. 1, Pág. 1) determinaram a avaliação dos imóveis do espólio; delibero sobre a alienação dos imóveis e a avaliação judicial pendente.";
ok(conferirComMapa(minutaBoa, mapa).length === 0, "não avisa quando a minuta cobre o fim e trata a questão atual");
ok(conferirComMapa(minutaBoa, null).length === 0 && conferirComMapa("", mapa).length === 0, "sem mapa ou sem minuta: nenhum aviso");
// caso real (processo 5066786-16.2024): as últimas movimentações ("Processo Redistribuído", "Autos Conclusos") não têm arquivo e a contagem ignorava
const semArquivo = processo(10) + "[Página 11 de 12]\nAutos Conclusos\n1. A movimentação: ( Autos Conclusos ) não possui \"Arquivos\".\nProcesso: 5066786-16.2024.8.09.0149\nMovimentacao 11 : Processo Redistribuído\n[Página 12 de 12]\nAutos Conclusos\nProcesso: 5066786-16.2024.8.09.0149\nMovimentacao 12 : Autos Conclusos\n";
const rs = resumirMovimentacoes(semArquivo);
ok(rs.movs === 12 && rs.ultima === 12, `conta também as movimentações sem arquivo (${rs.movs}/${rs.ultima})`);
process.exit(falhas ? 1 : 0);
