// Só para a TELA: arruma o texto da minuta na hora de exibir (parágrafos, itens do dispositivo um por linha, títulos em linha própria).
// Não altera o que está gravado: se o texto já vem bem formatado, devolve igual.
export type SecaoDaMinuta = "relatorio" | "fundamentacao" | "dispositivo";

const MAIUSC = "A-ZÁÉÍÓÚÂÊÔÃÕÇ";
const ABREV = /(?:^|[\s(])(?:mov|movs|arq|arqs|p|pp|pág|págs|art|arts|inc|incs|nº|n|fls|dr|dra|sr|sra|cf|ex|obs|v|vs|ss|c|r|rs|al|alín|par|parág|ref|proc|min|des|rel|trf|sum|súm|ed|vol|org|tel|etc)\.$/i;
const TRANSICAO = new RegExp(`^(?:Após|Em seguida|Posteriormente|Por sua vez|Noutro giro|Ocorre que|Instad[oa]|Citad[oa]s?|Intimad[oa]s?|Contest(?:ou|ação)|Sobreveio|Sobrevindo|Ademais|Outrossim|Contudo|Todavia|No mais|No mérito|No tocante|Quanto|Assim|Dessa forma|Diante|Ante|Isso posto|Registre-se|Consigne-se|Cumpre|É o relatório|Passo)\\b`);

/** Divide em frases sem cortar abreviações (mov., art., p. ...) nem números ("9.099/95"). */
function frases(t: string): string[] {
  const partes = t.split(new RegExp(`(?<=[.!?])\\s+(?=[${MAIUSC}"“(\\[*])`));
  const out: string[] = [];
  for (const p of partes) {
    if (out.length && ABREV.test(out[out.length - 1])) out[out.length - 1] += " " + p; else out.push(p);
  }
  return out;
}

/** Bloco longo sem parágrafos: agrupa frases em parágrafos de ~450 caracteres, preferindo quebrar antes de uma palavra de transição. */
function emParagrafos(t: string): string {
  const fs = frases(t.trim()); if (fs.length < 4) return t;
  const par: string[] = []; let atual = "";
  for (const f of fs) {
    if (atual && (atual.length >= 520 || (atual.length >= 260 && TRANSICAO.test(f)))) { par.push(atual); atual = ""; }
    atual += (atual ? " " : "") + f;
  }
  if (atual) par.push(atual);
  return par.join("\n\n");
}

/** "1. A. 2. B. 3. C." na mesma linha -> um item por linha. Só quando a numeração é sequencial (1, 2, 3...), para não confundir com "art. 5. Sobre". */
function itensEmLinhas(t: string): string {
  const re = new RegExp(`(^|[.;:)]\\s+|\\n)(\\d{1,2})\\.\\s+(?=[${MAIUSC}"“])`, "g");
  let esperado = 1; const aceitos: RegExpMatchArray[] = [];
  for (const m of t.matchAll(re)) if (+m[2] === esperado) { aceitos.push(m); esperado++; }
  if (aceitos.length < 2) return t;
  for (const m of aceitos.reverse()) {      // de trás para frente, para não deslocar as posições
    if (!/^[.;:)]/.test(m[1])) continue;      // início do texto ou já em linha própria
    const inicioDoNumero = m.index! + m[1].length;
    t = t.slice(0, m.index! + 1) + "\n\n" + t.slice(inicioDoNumero);
  }
  return t.replace(/\n{3,}/g, "\n\n");
}

export function organizarTextoDaMinuta(texto: string, secao: SecaoDaMinuta): string {
  if (typeof texto !== "string" || !texto.trim()) return texto;
  try {
    let t = texto.replace(/\r\n/g, "\n");
    // títulos (###) e blocos de citação (>) sempre em linha própria
    t = t.replace(/([^\n#])[ \t]+(#{2,4}[ \t]+\S)/g, "$1\n\n$2").replace(/([^\n])[ \t]+(>[ \t]*[*"“])/g, "$1\n\n$2");
    if (secao === "dispositivo") {
      t = itensEmLinhas(t);
      t = t.replace(/([^\n])[ \t]+((?:\*\*)?Determina[çc][õo]es\s+(?:à|a)s?\s+(?:escrivania|partes)[^:\n]{0,30}:(?:\*\*)?)/gi, "$1\n\n$2")
           .replace(/(^|\n\n)(Determina[çc][õo]es\s+(?:à|a)s?\s+(?:escrivania|partes)[^:\n]{0,30}:)(?!\*)/gi, "$1**$2**");
    } else {
      // quebras simples sem nenhuma linha em branco: a IA usou "\n" como parágrafo
      if (!/\n[ \t]*\n/.test(t) && t.includes("\n")) t = t.replace(/\n(?![ \t]*(?:\d{1,2}\.|[-*•]|>|#))/g, "\n\n");
      // bloco único longo: divide em parágrafos
      const blocos = t.split(/\n[ \t]*\n/).map((b) => (b.length > 900 && !/^\s*(?:[-*•>#]|\d{1,2}\.)/.test(b) && !b.includes("\n") ? emParagrafos(b) : b));
      t = blocos.join("\n\n");
    }
    // citação com vários trechos na mesma linha ("> Art. 321. ... > Parágrafo único. ...") -> cada trecho em uma linha da citação
    t = t.split(/\n[ \t]*\n/).map((b) => (/^\s*>/.test(b) ? b.replace(/[ \t]+>[ \t]+(?=\S)/g, "  \n> ") : b)).join("\n\n");
    return t.replace(/\n{3,}/g, "\n\n");
  } catch { return texto; }
}
