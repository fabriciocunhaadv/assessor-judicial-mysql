// Acha, no texto da minuta do assessor, o ponto a que um apontamento se refere, para a tela destacar e levar o juiz até ele.
// 1) pelo trecho citado pela IA (mesmo que não seja literal: ignora acento, maiúscula, espaço e aspas; se ainda não achar, usa uma sequência de palavras do trecho);
// 2) pelo local dito pela IA ("Relatório, Parágrafo 3"): o 3º parágrafo da seção. Nada é inventado: sem achado, devolve null.
export interface PontoNaMinuta { inicio: number; fim: number; precisao: "trecho" | "paragrafo" }

const semAcento = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Texto simplificado + para cada caractere simplificado, a posição no original. */
function simplificar(t: string): { s: string; mapa: number[] } {
  let s = ""; const mapa: number[] = []; let espaco = true;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (/[\s ]/.test(c) || /["'“”‘’«»]/.test(c)) { if (!espaco && /[\s ]/.test(c)) { s += " "; mapa.push(i); espaco = true; } continue; }
    for (const x of semAcento(c)) { s += x; mapa.push(i); }
    espaco = false;
  }
  return { s, mapa };
}

function porTrecho(minuta: string, trecho: string): PontoNaMinuta | null {
  const alvo = simplificar(trecho).s.trim(); if (alvo.length < 8) return null;
  const { s, mapa } = simplificar(minuta);
  const acha = (n: string, precisao: PontoNaMinuta["precisao"]): PontoNaMinuta | null => {
    const i = s.indexOf(n); if (i < 0) return null;
    return { inicio: mapa[i], fim: mapa[Math.min(i + n.length - 1, mapa.length - 1)] + 1, precisao };
  };
  const direto = acha(alvo, "trecho"); if (direto) return direto;
  const palavras = alvo.split(" ");      // a IA às vezes resume ou troca uma palavra: procura a maior sequência de palavras do trecho que exista na minuta
  for (let tam = Math.min(12, palavras.length); tam >= 4; tam--) {
    for (let a = 0; a + tam <= palavras.length; a++) { const r = acha(palavras.slice(a, a + tam).join(" "), "trecho"); if (r) return r; }
  }
  return null;
}

const SECOES: [RegExp, RegExp][] = [
  [/relat[óo]rio/i, /^[ \t]*(?:[IVX]+[ \t]*[-–.)][ \t]*)?RELAT[ÓO]RIO\b[^\n]*/im],
  [/fundamenta[çc][ãa]o/i, /^[ \t]*(?:[IVX]+[ \t]*[-–.)][ \t]*)?(?:FUNDAMENTA[ÇC][ÃA]O|M[ÉE]RITO)\b[^\n]*/im],
  [/dispositivo/i, /^[ \t]*(?:[IVX]+[ \t]*[-–.)][ \t]*)?(?:DISPOSITIVO|DECIDO|ANTE O EXPOSTO)\b[^\n]*/im],
];

function porLocal(minuta: string, local: string): PontoNaMinuta | null {
  const n = /(?:par[áa]grafo|par\.?|§)\s*(?:n[º°o.]*\s*)?(\d{1,3})/i.exec(local)?.[1];
  const sec = SECOES.find(([nome]) => nome.test(local));
  let ini = 0, fim = minuta.length, tituloFim = 0;
  if (sec) {
    const m = sec[1].exec(minuta); if (!m) return null;
    ini = m.index; tituloFim = m.index + m[0].length;
    const proximos = SECOES.map(([, re]) => { const x = new RegExp(re.source, "im").exec(minuta.slice(tituloFim)); return x ? tituloFim + x.index : -1; }).filter((p) => p > 0);
    fim = proximos.length ? Math.min(...proximos) : minuta.length;
  }
  if (!n) return sec ? { inicio: ini, fim: tituloFim, precisao: "paragrafo" } : null;
  const corpo = minuta.slice(tituloFim, fim), pars: { a: number; b: number }[] = [];
  const separador = (corpo.match(/\n\s*\n/g) || []).length >= 1 ? "\\n\\s*\\n" : "\\n";      // minuta sem linha em branco entre os parágrafos: cada quebra de linha separa um parágrafo
  const re = new RegExp(`\\S[\\s\\S]*?(?=${separador}|$)`, "g"); let x: RegExpExecArray | null;
  while ((x = re.exec(corpo)) && pars.length < 400) { if (x[0].trim()) pars.push({ a: tituloFim + x.index, b: tituloFim + x.index + x[0].length }); if (re.lastIndex === x.index) re.lastIndex++; }
  const p = pars[Number(n) - 1]; if (!p) return null;
  const txt = minuta.slice(p.a, p.b);
  return { inicio: p.a + (txt.length - txt.trimStart().length), fim: p.b - (txt.length - txt.trimEnd().length), precisao: "paragrafo" };
}

export function localizarNaMinuta(minuta: string, ref: { trecho?: string; local?: string }): PontoNaMinuta | null {
  if (!minuta) return null;
  try {
    return (ref.trecho ? porTrecho(minuta, ref.trecho) : null) || (ref.local ? porLocal(minuta, ref.local) : null);
  } catch { return null; }
}
