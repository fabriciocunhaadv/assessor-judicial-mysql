import { compararMinutas, limparCabecalhoRodape, textoDeHtml } from "../src/utils/compararMinutas";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const orig = `PODER JUDICIÁRIO DO ESTADO DE GOIÁS
SENTENÇA
I - RELATÓRIO
Trata-se de ação de cobrança proposta por Fulano contra Banco X, alegando cobrança indevida de tarifa no valor de R$ 100,00.
O réu apresentou contestação e juntou documentos.
II - FUNDAMENTAÇÃO
A relação é de consumo e aplica-se o Código de Defesa do Consumidor.
A tarifa cobrada não tem previsão contratual, conforme o contrato do Mov. 5, Arq. 2.
Aplica-se a Súmula 297 do STJ ao caso concreto.
III - DISPOSITIVO
Ante o exposto, julgo procedente o pedido para condenar o réu à restituição de R$ 100,00, em dobro.
Sem custas e honorários, nos termos do art. 55 da Lei 9.099/95.`;
const lanc = `<p>DECISÃO</p><p>SENTENÇA</p><p>I - RELATÓRIO</p><p>Trata-se de ação de cobrança proposta por Fulano contra Banco X, alegando cobrança indevida de tarifa no valor de R$ 100,00.</p><p>O réu apresentou contestação e juntou documentos.</p>
<p>II - FUNDAMENTAÇÃO</p><p>A relação é de consumo e aplica-se o Código de Defesa do Consumidor.</p><p>A tarifa cobrada não tem previsão contratual e, portanto, a cobrança é indevida, conforme o contrato do Mov. 5, Arq. 2.</p>
<p>III - DISPOSITIVO</p><p>Ante o exposto, julgo procedente o pedido para condenar o réu à restituição simples de R$ 100,00.</p><p>Sem custas e honorários, nos termos do art. 55 da Lei 9.099/95.</p><p>Goiânia, data do sistema</p><p>Juiz de Direito</p>`;
const txt = textoDeHtml(lanc);
ok(!txt.includes("<") && txt.split("\n").length >= 10, "HTML do editor vira parágrafos");
ok(!limparCabecalhoRodape(txt).includes("data do sistema") && !limparCabecalhoRodape(txt).startsWith("DECISÃO"), "tira cabeçalho (até o título do ato) e a assinatura");
const r = compararMinutas(orig, txt);
ok(r.aproveitamentoPct >= 80 && r.aproveitamentoPct < 100, `aproveitamento alto mas não total: ${r.aproveitamentoPct}%`);
const sec = Object.fromEntries(r.porSecao.map((s) => [s.secao, s.aproveitamentoPct]));
ok(sec["Relatório"] === 100, `relatório intacto: ${sec["Relatório"]}%`);
ok(sec["Fundamentação"] < 100 && sec["Fundamentação"] >= 60, `fundamentação mexida: ${sec["Fundamentação"]}%`);
ok(r.blocos.some((b) => b.tipo === "removido" && /S[úu]mula 297/.test(b.original || "")), "parágrafo da súmula 297 foi cortado");
ok(r.blocos.some((b) => b.tipo === "alterado" && b.partes?.some((p) => p.t === "+" && /portanto/.test(p.s))), "parágrafo alterado mostra as palavras acrescentadas");
ok(r.dispositivoMudou && r.dispositivoAproveitamentoPct != null && r.dispositivoAproveitamentoPct < 100, `dispositivo mexido (dobro → simples) é sinalizado: ${r.dispositivoAproveitamentoPct}%`);
const hd = compararMinutas("SENTENÇA\nRelatório de teste.\nDispositivo final da causa.\nJulgo procedente.", "SENTENÇA\nRelatório de teste.\nDispositivo final da causa.\nJulgo procedente.");
ok(hd.porSecao.length === 1 && hd.porSecao[0].secao === "Início" && hd.mantidas === 9, `parágrafo que só COMEÇA com “Relatório”/“Dispositivo” continua texto (${JSON.stringify(hd.porSecao)})`);
const igual = compararMinutas(orig, orig);
ok(igual.aproveitamentoPct === 100 && !igual.dispositivoMudou && igual.acrescentadas === 0 && igual.removidas === 0, "minuta idêntica: 100% e nada mudou");
const outra = compararMinutas(orig, "SENTENÇA\nTexto totalmente diferente sobre outro assunto qualquer.\n");
ok(outra.aproveitamentoPct < 10 && outra.dispositivoMudou, "minuta totalmente reescrita: aproveitamento baixo e dispositivo mudou");
ok(compararMinutas(orig, "").aproveitamentoPct === 0 && compararMinutas("", "abc def").aproveitamentoPct === 0, "vazios não quebram");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
