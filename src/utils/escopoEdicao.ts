// ESCOPO DA EDIÇÃO PELO CHAT: quando o usuário pede para mexer só em UMA parte da minuta ("edite só o relatório"), só essa parte pode mudar.
// A IA recebe a ordem no prompt E o servidor devolve as outras partes exatamente como estavam (garantia: a IA às vezes reescreve tudo mesmo assim).
// Função pura, sem rede.
export type SecaoMinuta = "relatorio" | "fundamentacao" | "dispositivo";
const SECOES: Record<SecaoMinuta, RegExp> = { relatorio: /relat[óo]rio/gi, fundamentacao: /fundamenta[çc][ãa]o|motiva[çc][ãa]o/gi, dispositivo: /dispositivo/gi };
const NOME: Record<SecaoMinuta, string> = { relatorio: "relatório", fundamentacao: "fundamentação", dispositivo: "dispositivo" };
const RESTRITIVO = /\b(s[óo]|somente|apenas|exclusivamente|unicamente|s[óo]mente)\b/i;
const VERBO = /(alter|edit|reescrev|refa[çc]|refaz|mud|ajust|corrig|melhor|troc|transform|reform|reorgan|resum|enxug|simplific|detalh|ampli|complet|substitu|remov|retir|\btir[ae]|inclu|acrescent|insir|coloc|adapt|revis|reduz|encurt|aprofund|redij|redig|escrev|deix|pass)/i;
const REFERENCIA = /(considerando|com base (?:n|d)[oa]|conforme (?:o|a)|de acordo com|a partir d|levando em conta|tendo em vista|em harmonia com|coerente com|compat[íi]vel com|seguindo (?:o|a)|igual (?:ao|à)|consistente com)\s+(?:todo\s+)?(?:o|a)?\s*$/i;
const GLOBAL = /(toda a (?:minuta|senten[çc]a|decis[ãa]o)|a (?:minuta|senten[çc]a|decis[ãa]o) (?:toda|inteira)|minuta inteira|todas as (?:partes|se[çc][õo]es)|tudo\b)|(convert(?:a|er)|transform(?:e|ar))\s+(?:\S+\s+){0,3}(?:em|a|na|no)\s+(?:uma?\s+)?(?:decis|senten|despach|embargo)|em decis[ãa]o interlocut/i;

/** Quais partes o pedido manda mexer; null = o pedido vale para a minuta inteira (ou não dá para saber). */
export function escopoDoPedido(mensagem: string): SecaoMinuta[] | null {
  const msg = String(mensagem || "").replace(/\s+/g, " ").trim();
  if (!msg) return null;
  const restritivo = RESTRITIVO.test(msg);
  if (GLOBAL.test(msg) && !restritivo) return null;
  const alvos = new Set<SecaoMinuta>(), mencionadas = new Set<SecaoMinuta>();
  for (const oracao of msg.split(/[.;!?\n]+/)) {
    const comVerbo = VERBO.test(oracao);
    for (const sec of Object.keys(SECOES) as SecaoMinuta[]) {
      const rx = new RegExp(SECOES[sec].source, "gi"); let m: RegExpExecArray | null;
      while ((m = rx.exec(oracao))) {
        const antes = oracao.slice(Math.max(0, m.index - 40), m.index);
        if (REFERENCIA.test(antes)) continue;      // "…considerando o relatório": é só referência, não é para mexer nele
        mencionadas.add(sec);
        if (comVerbo || restritivo) alvos.add(sec);
      }
    }
  }
  if (alvos.size === 0 && mencionadas.size === 1) return [...mencionadas];      // "o relatório está em tópicos, não gosto": uma parte só
  return alvos.size ? (Object.keys(SECOES) as SecaoMinuta[]).filter((s) => alvos.has(s)) : null;
}

export const nomeDaSecao = (s: SecaoMinuta) => NOME[s];
export const textoDoEscopo = (e: SecaoMinuta[]) => e.map((s) => NOME[s]).join(" e ");

/** Ordem para a IA quando o pedido é de uma parte só. */
export function blocoDeEscopo(escopo: SecaoMinuta[]): string {
  const fora = (Object.keys(SECOES) as SecaoMinuta[]).filter((s) => !escopo.includes(s));
  if (!fora.length) return "";
  return `\n# ESCOPO DESTE PEDIDO (OBRIGATÓRIO): o usuário mandou alterar SOMENTE ${textoDoEscopo(escopo)}.\n` +
    `- Reescreva apenas: ${textoDoEscopo(escopo)}. Em ${fora.map((s) => NOME[s]).join(" e ")}, devolva o texto EXATAMENTE como está na minuta atual, palavra por palavra, sem melhorar, resumir, ampliar nem reorganizar.\n` +
    `- As regras de exaustividade e ampliação deste prompt valem só para ${textoDoEscopo(escopo)}; NÃO as aplique a ${fora.map((s) => NOME[s]).join(" nem a ")}.\n` +
    `- Se o usuário pediu texto corrido / sem tópicos, transforme listas, enumerações e itens em parágrafos de prosa contínua, mantendo TODOS os fatos, pedidos e valores, sem inventar nada.\n`;
}

type Minuta = { title?: string; relatorio?: string; fundamentacao?: string; dispositivo?: string; [k: string]: any };
/** Garantia no servidor: o que o pedido não mandou mudar volta exatamente como estava (inclusive o título). */
export function aplicarEscopo(original: Minuta | undefined, nova: Minuta, escopo: SecaoMinuta[] | null): { minuta: Minuta; restauradas: SecaoMinuta[] } {
  if (!escopo || !original) return { minuta: nova, restauradas: [] };
  const minuta = { ...nova }, restauradas: SecaoMinuta[] = [];
  for (const sec of Object.keys(SECOES) as SecaoMinuta[]) {
    if (escopo.includes(sec)) continue;
    if (typeof original[sec] === "string" && minuta[sec] !== original[sec]) { minuta[sec] = original[sec]; restauradas.push(sec); }
  }
  if (typeof original.title === "string") minuta.title = original.title;
  return { minuta, restauradas };
}
