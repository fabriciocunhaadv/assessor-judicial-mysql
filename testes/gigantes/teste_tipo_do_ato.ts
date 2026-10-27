// Dispositivo de saneamento que decide pedidos NÃO vira sentença; sentença de verdade continua sendo sentença.
import fs from "fs";
const src = fs.readFileSync(new URL("../../server.ts", import.meta.url), "utf8");
const i = src.indexOf("export function checkIsDispositivoSentenca("); let d = 0, k = src.indexOf("{", i), j = k;
for (; ; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (d === 0) break; } }
const fn = new Function(src.slice(i, j + 1).replace("export function checkIsDispositivoSentenca(text: string): boolean", "function checkIsDispositivoSentenca(text)") + "; return checkIsDispositivoSentenca;")() as (t: string) => boolean;
const naoSentenca = [
  "ACOLHO o pedido de habilitação do novo advogado e HOMOLOGO a procuração. Determino a expedição de ofícios.",
  "REJEITO o pedido de reabertura de prazo, ante a certidão de decurso. DEFIRO a prova testemunhal.",
  "INDEFIRO os pedidos de perícia. REJEITO os pedidos de dilação. Designo audiência.",
  "Declaro saneado o feito. Afasto a alegação de prescrição (art. 487, II, do CPC) por ora. Designo audiência.",
  "Ante o exposto, nos termos do artigo 357 do Código de Processo Civil, DOU O PROCESSO POR SANEADO E ORGANIZADO, determinando a dilação probatória.",
];
const sentenca = [
  "Ante o exposto, JULGO PROCEDENTE o pedido para condenar o réu ao pagamento de R$ 10.000,00.",
  "JULGO IMPROCEDENTES os pedidos formulados na inicial e extingo o processo com resolução do mérito (art. 487, I, do CPC).",
  "REJEITO os pedidos formulados na inicial, nos termos do art. 487, I, do CPC.",
  "Extingo o processo sem resolução do mérito, nos termos do art. 485, III, do CPC.",
  "ACOLHO os pedidos iniciais e condeno a parte ré a pagar a quantia de R$ 5.000,00.",
];
const erros = [...naoSentenca.filter((t) => fn(t)).map((t) => "deveria ser decisão: " + t.slice(0, 60)), ...sentenca.filter((t) => !fn(t)).map((t) => "deveria ser sentença: " + t.slice(0, 60))];
if (erros.length) { console.error(erros.join("\n")); process.exit(1); }
console.log("OK", naoSentenca.length + sentenca.length, "casos");
