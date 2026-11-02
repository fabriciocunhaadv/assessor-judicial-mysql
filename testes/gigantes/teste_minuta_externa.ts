import { montarAnaliseDeMinutaExterna, resolverUnidade } from "../../src/utils/minutaExterna";
import { resumoLeve } from "../../src/utils/historicoLeve";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const unidades: any[] = [{ id: "montes_claros", name: "Montes Claros / Vara Única" }, { id: "mc_jec", name: "Montes Claros de Goiás / Juizado Especial Cível" }, { id: "mc_fp", name: "Montes Claros de Goiás / Juizado das Fazendas Públicas" }];
ok(resolverUnidade("Montes Claros de Goias - Juizado Especial Civel - GO", unidades, unidades[0]).id === "mc_jec", "acha a unidade pela serventia do Agaia/Projudi (Juizado Especial Cível)");
ok(resolverUnidade("Montes Claros de Goias - Juizado das Fazendas Publicas - GO", unidades, unidades[0]).id === "mc_fp", "acha a unidade da Fazenda Pública");
ok(resolverUnidade("Outra Comarca - Vara X", unidades, unidades[0]).id === "montes_claros", "sem correspondência clara, usa a unidade ativa");
const texto = ["PODER JUDICIÁRIO DO ESTADO DE GOIÁS", "Processo nº: 5285460-70.2025.8.09.0166", "Exequente: Mauri Pereira Morais", "Executados: Helena Moreira de Oliveira e Onison Martins Arruda", "DECISÃO INTERLOCUTÓRIA", "I. RELATÓRIO", "Trata-se de cumprimento de sentença. ".repeat(5), "II. FUNDAMENTAÇÃO", "Rejeito a compensação. ".repeat(5), "III. DISPOSITIVO", "Intimem-se.".repeat(3)].join("\n");
const a = montarAnaliseDeMinutaExterna({ processo: "5285460-70.2025.8.09.0166", serventia: "x", prompt: "Outros Área Judicial - Fabrício Juizado Especial Cível", promptAgaia: "Outros Área Judicial - Fabrício Juizado Especial Civel", minutaTexto: texto, minutaHtml: "<p>x</p>" }, { unitId: "mc_jec", unitName: "Montes Claros de Goiás / Juizado Especial Cível", uid: "u1", nome: "Fabrício", email: "f@x" });
const m = a.result.minute!;
ok(m.title === "DECISÃO INTERLOCUTÓRIA" && m.processNumber === "5285460-70.2025.8.09.0166", "título e número do processo lidos da minuta");
ok(m.relatorio.startsWith("Trata-se") && m.fundamentacao.startsWith("Rejeito") && m.dispositivo.startsWith("Intimem-se"), "separa relatório, fundamentação e dispositivo");
ok(m.parties.author === "Mauri Pereira Morais" && m.parties.defendant.startsWith("Helena"), "partes lidas do cabeçalho");
ok(a.unitId === "mc_jec" && a.promptTitle.includes("Juizado Especial") && a.createdBy === "u1", "organizada por unidade, prompt e usuário");
const b = montarAnaliseDeMinutaExterna({ processo: "5285460-70.2025.8.09.0166", minutaTexto: texto }, { unitId: "mc_jec", unitName: "" });
ok(a.id === b.id, "o mesmo texto do mesmo processo tem sempre o mesmo id (nova tentativa não duplica)");
// decisão do Agaia sem os títulos I/II/III (como a da tela real)
const livre = ["Processo nº: 5189520.44.2026.8.09.0166", "Natureza: Cumprimento Provisório de Alimentos (Rito da Penhora)", "Exequente: B. G. T. dos S. (representado por sua genitora)", "Executado: Kauan Matheus Freitas dos Santos", "DECISÃO", "Vistos os autos.", "Por meio da decisão proferida em Mov. 35, este Juízo homologou o cálculo do saldo remanescente.".repeat(2), "Em Mov. 38, aportou comunicação da lavra do Egrégio Tribunal.".repeat(2), "Ante o exposto, DETERMINO a intimação do devedor para pagamento no prazo de 15 dias.", "Intimem-se. Cumpra-se."].join("\n\n");
const c = montarAnaliseDeMinutaExterna({ processo: "5189520-44.2026.8.09.0166", minutaTexto: livre }, { unitId: "x", unitName: "y" }).result.minute!;
ok(c.title === "DECISÃO" && c.relatorio.startsWith("Vistos os autos") && c.dispositivo.startsWith("Ante o exposto") && c.dispositivo.includes("Intimem-se") && c.fundamentacao.includes("não traz fundamentação"), "decisão só com relato e dispositivo: o relato vai no relatório, o dispositivo inteiro no dispositivo e a fundamentação fica sinalizada como ausente (nada se mistura nem some)");
ok(!/Exequente|Natureza/.test(c.fundamentacao) && c.parties.author.startsWith("B. G. T."), "o cabeçalho de identificação não se repete no corpo");
const leve = resumoLeve(a, "mysql");
ok(leve.result.origemExterna?.sistema === "Agaia" && !("htmlOriginal" in leve.result.origemExterna), "o resumo da lista do Histórico mantém a origem (etiqueta Agaia) sem o html pesado");
import { organizarMinutaExterna, htmlParaMarkdown } from "../../src/utils/organizarMinutaExterna";
import { reorganizarAnaliseExterna } from "../../src/utils/minutaExterna";
const cab = ["PODER JUDICIÁRIO DO ESTADO DE GOIÁS", "Processo nº: 5000000-00.2026.8.09.0166", "Autor: Maria", "Réu: João", "DECISÃO INTERLOCUTÓRIA"];
// 1) títulos em formas variadas
const v1 = organizarMinutaExterna([...cab, "**I – DO RELATÓRIO**", "Trata-se de pedido de tutela.", "## 2. Fundamentação", "O pedido é plausível (art. 300 do CPC).", "III. DISPOSITIVO:", "Ante o exposto, DEFIRO a tutela.", "Intimem-se."].join("\n\n"));
ok(v1.relatorio === "Trata-se de pedido de tutela." && v1.fundamentacao.startsWith("O pedido é plausível") && v1.dispositivo.startsWith("Ante o exposto") && !v1.semSecoes, "títulos variados (**I – DO RELATÓRIO**, ## 2. Fundamentação, III. DISPOSITIVO:) são reconhecidos");
const v2 = organizarMinutaExterna([...cab, "Relatório: Trata-se de cumprimento de sentença movido por Maria.", "Fundamentação", "Compulsando os autos, verifica-se a regularidade.", "Dispositivo", "DEFIRO o pedido."].join("\n"));
ok(v2.relatorio.startsWith("Trata-se de cumprimento") && v2.fundamentacao.startsWith("Compulsando") && v2.dispositivo.startsWith("DEFIRO"), "título e texto na mesma linha (Relatório: ...) e títulos sem numeração");
const v3 = organizarMinutaExterna([...cab, "I. RELATÓRIO", "Trata-se de pedido.", "III. DISPOSITIVO", "Intimem-se."].join("\n\n"));
ok(v3.relatorio === "Trata-se de pedido." && v3.dispositivo === "Intimem-se.", "só relatório e dispositivo (como o Agaia costuma mandar): nada vai para o lugar errado");
// 2) sem títulos: fronteiras pelo texto
const sem = organizarMinutaExterna([...cab, "Vistos.", "Trata-se de pedido de habilitação formulado por Maria nos autos do cumprimento de sentença.", "É o relatório. Decido.", "A habilitação exige procuração regular (art. 104 do CPC), que consta dos autos (Mov. 3, Arq. 1, Pág. 1).", "Ante o exposto, DEFIRO a habilitação.", "Intime-se.", "Montes Claros de Goiás, data do sistema.", "Juiz de Direito"].join("\n\n"));
ok(sem.relatorio.startsWith("Vistos.") && sem.relatorio.includes("Trata-se de pedido") && !/É o relatório|Decido/.test(sem.relatorio + sem.fundamentacao), "sem títulos: o relatório vai até “É o relatório. Decido.” e a fórmula de transição não fica no texto");
ok(sem.fundamentacao.startsWith("A habilitação exige") && sem.dispositivo.startsWith("Ante o exposto") && sem.dispositivo.includes("Intime-se") && !/data do sistema/.test(sem.dispositivo), "sem títulos: fundamentação e dispositivo separados e o fecho sai do dispositivo");
ok(/data do sistema/.test(sem.closing) && /Juiz de Direito/.test(sem.closing), "o fecho (local/data/assinatura) vai para o campo de fecho");
const an = organizarMinutaExterna([...cab, "Trata-se de pedido de alvará.", "Inicialmente, destaco que a parte comprovou a titularidade (Mov. 4).", "Assim, o pedido merece acolhimento pelos fundamentos expostos.", "Diante do exposto, DEFIRO o alvará.", "Cumpra-se."].join("\n\n"));
ok(an.relatorio === "Trata-se de pedido de alvará." && an.fundamentacao.startsWith("Inicialmente") && an.dispositivo.startsWith("Diante do exposto"), "sem títulos nem “É o relatório”: o relato inicial vai no relatório, a análise na fundamentação e o “Diante do exposto” no dispositivo");
// 3) HTML do Agaia: negrito, itálico e listas viram Markdown
ok(htmlParaMarkdown("<p><strong>DECISÃO</strong></p><p>Texto com <strong>negrito</strong> e <em>itálico</em>&nbsp;ok.</p><ul><li>item 1</li><li>item 2</li></ul><blockquote>Art. 104</blockquote>") === "**DECISÃO**\n\nTexto com **negrito** e *itálico* ok.\n\n- item 1\n- item 2\n\n> Art. 104", "HTML do Agaia vira Markdown (negrito, itálico, lista compacta, citação)");
const h = organizarMinutaExterna("DECISÃO\nI. RELATÓRIO\nTrata-se de pedido com negrito.\nII. FUNDAMENTAÇÃO\nTexto.\nIII. DISPOSITIVO\nDEFIRO.", "<p><strong>DECISÃO</strong></p><p>I. RELATÓRIO</p><p>Trata-se de pedido com <strong>negrito</strong>.</p><p>II. FUNDAMENTAÇÃO</p><p>Texto.</p><p>III. DISPOSITIVO</p><p>DEFIRO.</p>");
ok(h.titulo === "DECISÃO" && h.relatorio.includes("**negrito**") && h.dispositivo === "DEFIRO.", "com HTML: título limpo, negrito preservado nas seções");
// 4) minuta já gravada com a separação antiga: reorganiza ao abrir; se o usuário editou, não mexe
const textoSem = [...cab, "Vistos.", "Trata-se de pedido de habilitação formulado por Maria.", "É o relatório. Decido.", "A habilitação exige procuração regular, presente nos autos.", "Ante o exposto, DEFIRO a habilitação.", "Intime-se."].join("\n\n");
const velho: any = { id: "agaia-1", result: { minute: { title: "DECISÃO INTERLOCUTÓRIA", header: "x", processNumber: "5000000-00.2026.8.09.0166", parties: { author: "Maria", defendant: "João" }, relatorio: "(Decisão elaborada no Agaia sem a divisão em relatório, fundamentação e dispositivo: o texto integral está abaixo.)", fundamentacao: "tudo junto", dispositivo: "Intime-se.", closing: "", fullFormattedText: textoSem }, origemExterna: { sistema: "Agaia", semSecoes: true } } };
velho.result.originalMinute = JSON.parse(JSON.stringify(velho.result.minute));
const novo: any = reorganizarAnaliseExterna(velho);
ok(!!novo && novo.result.minute.relatorio.startsWith("Vistos.") && novo.result.minute.fundamentacao.startsWith("A habilitação") && novo.result.minute.dispositivo.startsWith("Ante o exposto"), "minuta antiga do Agaia é reorganizada ao abrir pelo Histórico");
ok(novo.result.minute.fullFormattedText === textoSem && novo.result.originalMinute.relatorio === novo.result.minute.relatorio, "o texto original fica guardado e a minuta de origem acompanha a nova separação");
const editado: any = JSON.parse(JSON.stringify(velho)); editado.result.minute.fundamentacao = "tudo junto, editado por mim";
ok(reorganizarAnaliseExterna(editado) === null, "minuta que o usuário já editou NÃO é reorganizada");
ok(reorganizarAnaliseExterna(novo) === null, "reorganizar duas vezes não muda mais nada");
ok(reorganizarAnaliseExterna({ id: "x", result: { minute: { ...velho.result.minute }, } } as any) === null, "minuta que não é de fora do Studio não é tocada");
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); process.exit(falhas ? 1 : 0);
