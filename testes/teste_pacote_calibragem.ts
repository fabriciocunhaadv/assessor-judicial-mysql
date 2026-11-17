import { montarPacoteCalibragem } from "../src/utils/pacoteCalibragem";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const d = { processo: "5574437-20.2026.8.09.0166", ato: "DESPACHO", geradoEm: 1763377200000, promptTitulo: "Despacho padrão", motor: "turbo", aproveitamentoPct: 10, coberturaPct: 5, palavrasOriginal: 700, palavrasLancado: 250, mantidas: 20, removidas: 680, acrescentadas: 230, dispositivoMudou: true,
  porSecao: [{ secao: "Relatório", aproveitamentoPct: 0 }], textoLancado: "Registra-se o acordo.\n```\ncódigo dentro\n```\nArquive-se.", textoGerado: "Trata-se de ação longa de exoneração.",
  mudancas: [{ tipo: "removido", secao: "Relatório", original: "Trata-se de ação" }, { tipo: "adicionado", secao: "Dispositivo", lancado: "Arquive-se." }],
  assinado: { aproveitamentoLancadaPct: 90, aproveitamentoGeradaPct: 40, dispositivoMudouDaLancada: false, arquivo: "a.pdf", mudancas: [{ tipo: "alterado", secao: "Dispositivo", original: "x", lancado: "y" }] } };
const t = montarPacoteCalibragem([d, { ...d, processo: "5000001-00.2026.8.09.0166", textoLancado: "", assinado: undefined }], 1763377200000);
ok(t.startsWith("# PACOTE DE CALIBRAGEM") && t.includes("LANÇADA no Projudi é a REFERÊNCIA"), "cabeçalho explica que a lançada é a referência");
ok(t.includes("Comparações: 2") && t.includes("Aproveitamento médio: 10%") && t.includes("Cobertura média da lançada: 5%") && t.includes("DESPACHO 2"), "resumo geral");
ok(t.includes("Registra-se o acordo.") && t.includes("Trata-se de ação longa de exoneração."), "textos INTEIROS (lançada e gerada)");
ok(t.includes("(texto não guardado)"), "texto ausente é dito, não inventado");
ok(t.includes("Prompt: Despacho padrão") && t.includes("Motor: turbo"), "prompt e motor");
ok(t.includes("**CORTADO** (Relatório)") && t.includes("**ACRESCENTADO** (Dispositivo)") && t.includes("lançada → assinada"), "mudanças e assinada");
ok(/````\nRegistra-se o acordo\./.test(t), "cerca maior quando o texto já tem ``` (não quebra o arquivo)");
ok(montarPacoteCalibragem([]).includes("Comparações: 0"), "vazio não quebra");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
