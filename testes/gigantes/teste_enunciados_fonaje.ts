import { extrairEnunciadosFonaje } from "../../src/utils/enunciadosFonaje";
import { matchApplicableBindingPrecedents } from "../../src/utils/bindingPrecedents";
let falhas = 0; const ok = (c: boolean, m: string) => { console.log((c ? "ok: " : "FALHOU: ") + m); if (!c) falhas++; };
const t = `Enunciados Cíveis
ENUNCIADO 1 – O exercício do direito de ação no Juizado Especial Cível é facultativo para o autor.
ENUNCIADO 2 – Substituído pelo Enunciado 58.
ENUNCIADO 3 – Cancelado.
[Página 2 de 9 | Pág. 2/9]
ENUNCIADO 10 – A contestação poderá ser apresentada até a audiência de Instrução e Julgamento, prosseguindo-se o julgamento.
ENUNCIADO 11 – Nas causas de valor superior a vinte salários mínimos, a ausência de contestação, escrita ou oral, ainda que presente o réu, implica revelia. [Página 3 de 9]
ENUNCIADO 12 – A perícia informal é admissível na hipótese do art. 35 da Lei 9.099/1995. Da plataforma Adobe Acrobat`;
const r = extrairEnunciadosFonaje(t, "Enunciados Cíveis - Portal CNJ.pdf");
ok(r.length === 6 && r[0].id === "fonaje-civel-1" && r[0].number === "Enunciado 1 FONAJE (Cível)", "lê os 6 enunciados com número e ramo (Cível)");
ok(r.find((x) => x.id.endsWith("-2"))!.situacao === "substituido" && r.find((x) => x.id.endsWith("-3"))!.situacao === "cancelado", "marca substituído e cancelado");
ok(!/Página|Acrobat/.test(r.map((x) => x.statement).join(" ")), "tira marca de página e rodapé do texto");
ok(extrairEnunciadosFonaje("Enunciados Criminais\nENUNCIADO 1 – x y z w q r s t u.\nENUNCIADO 2 – a b c d e f g h i.\nENUNCIADO 3 – j k l m n o p q r.", "criminais.pdf")[0].id === "fonaje-criminal-1", "ramo criminal pelo nome do arquivo");
ok(extrairEnunciadosFonaje("texto qualquer sem enunciados").length === 0, "texto sem enunciados: nada");
const aplicaveis = matchApplicableBindingPrecedents("Réu citado apresentou contestação na audiência de instrução e julgamento; apresentada contestação, prosseguindo-se o julgamento.", r as any);
ok(aplicaveis.some((p) => p.id === "fonaje-civel-10"), "o enunciado 10 é encontrado quando o caso trata de contestação na audiência");
ok(!aplicaveis.some((p) => p.id === "fonaje-civel-2" || p.id === "fonaje-civel-3"), "enunciado cancelado/substituído não é aplicado");
process.exit(falhas ? 1 : 0);
