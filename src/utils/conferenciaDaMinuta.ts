// Conferência POR CÓDIGO (sem IA) da minuta já pronta contra a FASE do processo (ver faseDoProcesso.ts).
// Só pega frases claras de invasão de fase. Achando, o servidor refaz UMA vez com a instrução curta de `instrucao`; se persistir, entrega com aviso.
import type { FaseDetectada } from "./faseDoProcesso";

export interface AvisoFase { codigo: string; mensagem: string; instrucao: string }

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
const textoMinuta = (m: any) => [m?.title, m?.relatorio, m?.fundamentacao, m?.dispositivo, m?.closing].filter(Boolean).join("\n");

const RX_JULGA_MERITO = /\bjulgo\s+(?:parcialmente\s+)?(?:procedente|improcedente)s?\s+(?:o|os|a)\s+(?:pedidos?|a[cç][aã]o|pretens[aã]o|demanda)\b/;
const RX_NULIDADE_CONTRATO = /\bdeclaro\s+(?:a\s+)?(?:nulidade|inexist[eê]ncia)\s+(?:d[oa]|de)\s+(?:contrato|d[eé]bito|rela[cç][aã]o|cl[aá]usula)/;
const RX_CONDENA_MERITO = /\bcondeno\s+(?:o|a|os|as)\s+(?:r[eé]u|requerid[oa]s?|banco|institui[cç][aã]o|executad[oa]s?|embargad[oa]s?)\b[^.]{0,200}\b(?:restitui|repeti[cç][aã]o\s+(?:do\s+ind[eé]bito|em\s+dobro)|dano\s+moral|danos\s+morais|indeniza)/;
const RX_SANEAMENTO = /\b(?:fixo|fixam-se|ficam\s+fixados)\s+os\s+pontos\s+controvertidos|\bdou\s+(?:o\s+)?processo\s+por\s+saneado|\bsaneio\s+o\s+processo|\bdesigno\s+audi[eê]ncia\s+de\s+instru[cç][aã]o/;
const RX_RECEBE_EMBARGOS = /\brecebo\s+os\s+embargos/;
const RX_RETRATA = /embargos\s+de\s+declara|retrata[cç][aã]o|art(?:igo|\.)?\s*(?:485|924|925)\b|extingo|extin[cç][aã]o/;

export function conferirMinutaComFase(minuta: any, f: FaseDetectada): AvisoFase[] {
  if (!minuta || f.confianca === "baixa" || f.fase === "indefinida") return [];
  const txt = norm(textoMinuta(minuta)), disp = norm(minuta?.dispositivo || "") || txt.slice(-4000);
  const out: AvisoFase[] = [];

  if (RX_JULGA_MERITO.test(disp) && /\bjulgo\s+improcedente\s+(?:o|os|a)\s+(?:pedidos?|a[cç][aã]o)/.test(disp) && /\bjulgo\s+procedente\s+(?:o|os|a)\s+(?:pedidos?|a[cç][aã]o)/.test(disp))
    out.push({ codigo: "contraditorio", mensagem: "O dispositivo julga procedente e improcedente o mesmo pedido (contraditório).", instrucao: "o dispositivo ficou contraditório (julga procedente e improcedente); decida em um só sentido, coerente com a fundamentação" });

  if (f.fase === "cumprimento" || f.fase === "execucao") {
    if (RX_JULGA_MERITO.test(disp) || RX_NULIDADE_CONTRATO.test(disp) || RX_CONDENA_MERITO.test(disp))
      out.push({ codigo: "fase_merito", mensagem: `A minuta decide o MÉRITO ("julgo procedente/improcedente o pedido", nulidade do contrato ou condenação), mas o processo está em ${f.fase === "cumprimento" ? "cumprimento de sentença" : "execução"}: o título já existe.`, instrucao: `o processo está em ${f.fase === "cumprimento" ? "CUMPRIMENTO DE SENTENÇA" : "EXECUÇÃO"}: não reabra o mérito nem julgue procedente/improcedente o pedido; decida apenas a questão pendente da fase (impugnação, excesso, penhora, pagamento/extinção etc.)` });
  }
  if (f.fase === "embargos" && RX_SANEAMENTO.test(txt) && (RX_RECEBE_EMBARGOS.test(txt) || /recebimento dos embargos/.test(txt)))
    out.push({ codigo: "fase_embargos", mensagem: "No recebimento dos embargos a minuta já sanea o processo/fixa pontos controvertidos/designa instrução, o que é de fase posterior.", instrucao: "no recebimento dos embargos decida só o recebimento e o efeito suspensivo e determine a intimação do embargado; NÃO sanear, fixar pontos controvertidos nem designar instrução" });
  if ((f.fase === "pos_sentenca" || f.fase === "recursal") && f.sentencaMov && /^\s*senten[cç]a/.test(norm(minuta?.title || "")) && RX_JULGA_MERITO.test(disp) && !RX_RETRATA.test(txt))
    out.push({ codigo: "refez_sentenca", mensagem: `O processo já tem sentença (Mov. ${f.sentencaMov}) e a minuta é uma NOVA sentença de mérito.`, instrucao: `o processo JÁ foi sentenciado (Mov. ${f.sentencaMov}): não profira nova sentença de mérito; decida o que veio depois (embargos, recurso, cumprimento, trânsito) ou, se for o caso, extinga por fundamento próprio` });
  return out;
}
