// Utilidades de texto de lei compartilhadas entre o cliente, o servidor e a leitura do Planalto.

/** Padroniza o começo da linha do artigo: "Art . 1º", "Artigo 1º", "ARTIGO 1º", "Art.1º" e invisíveis (espaço de largura zero, marcador) viram "Art. 1º". */
export function normalizarLinhaLei(l: string): string {
  let t = String(l ?? "").replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "").replace(/^[\s•·▪■>\-–—]*(?=(?:art|artigo))/i, "").trim();
  t = t.replace(/^(?:art|artigo)\s*\.?\s*(?=\d)/i, "Art. ");
  return t;
}

/** PDF convertido no navegador vem em parágrafos corridos (vários artigos na mesma linha, com marcas de negrito e "[Página N de M]"). A consulta e a contagem só enxergam artigo
 *  que COMEÇA a linha; aqui cada "Art. N" e cada TÍTULO/CAPÍTULO/SEÇÃO volta a abrir a sua linha. "Art." só abre linha depois de ponto final, ponto e vírgula, dois pontos, fecha-parênteses
 *  ou palavra em maiúsculas (nunca em "...nos termos do Art. 14 desta Lei"). Texto que já está uma linha por artigo não muda. */
export function separarDispositivos(linhas: string[]): string[] {
  const out: string[] = [];
  for (const bruta of linhas) {
    if (/^\[P[áa]gina\s+\d+\s+de\s+\d+\]$/i.test(bruta.trim())) continue;
    let l = bruta.replace(/<\/?u>/gi, "").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    if (!l) continue;
    l = l.replace(/((?:[.;:!?)\]"”]|\b[A-ZÀ-Ú]{4,})\s+)(?=Art(?:igo)?\s*\.?\s*\d{1,4}\s*[º°o]?(?:\s*-\s*[A-Z])?\s*(?:[.,\-–—]|\s)\s*(?:[A-ZÀ-Ú(§]|\d|Revogad))/g, "$1\n");
    l = l.replace(/([.;:!?)\]"”]\s+|\b[A-ZÀ-Ú]{4,}\s+)(?=(?:T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|LIVRO)\s+(?:[IVXLCDM]+|\d+|[ÚU]NICO)\b)/g, "$1\n");
    for (const parte of l.split("\n")) { const t = normalizarLinhaLei(parte); if (t) out.push(t); }
  }
  return out;
}

