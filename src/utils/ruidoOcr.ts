// Páginas de FOTO ou digitalização ruim: o OCR devolve só rabiscos ("ESSE | a RR | SIS SESHSS | …"). Isso não tem informação, ocupa espaço (num processo real, 161 de 629
// páginas, 29% do texto) e ainda alimenta a invenção de fatos pela IA. Aqui a página vira uma linha avisando que é imagem sem texto legível; o carimbo (movimentação,
// arquivo, página) fica, para a pessoa saber onde está a imagem e poder olhá-la. Regra bem estrita para não apagar texto de verdade.

const SEPARA_PAGINAS = /(?=\[Página\s+\d{1,4}\s+de\s+\d{1,4}\])/;

export interface PaginaRuidosa { pagina: number; mov?: number; arquivo?: string; chars: number }

function analisar(p: string): { ruido: boolean; corpo: string } {
  const sem = p.replace(/Processo:[\s\S]*?Localizar pelo código:[^\n]*\n?/, "");      // carimbo do Projudi (cabeçalho/rodapé repetido)
  const linhas = sem.split("\n").map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 25) return { ruido: false, corpo: sem };
  const curtas = linhas.filter((l) => l.length <= 3).length / linhas.length;
  const palavras = (sem.match(/[A-Za-zÀ-ÿ]{4,}/g) || []).length / Math.max(1, sem.length / 6);
  return { ruido: curtas > 0.55 && palavras < 0.15, corpo: sem };
}

/** Troca o miolo das páginas de ruído de OCR por um aviso de uma linha. Idempotente. */
export function limparRuidoDeOcr(texto: string): { texto: string; paginas: PaginaRuidosa[]; charsEconomizados: number } {
  const t = String(texto || "");
  if (!t.includes("[Página")) return { texto: t, paginas: [], charsEconomizados: 0 };
  const paginas: PaginaRuidosa[] = []; let economia = 0;
  const saida = t.split(SEPARA_PAGINAS).map((p) => {
    const g = p.match(/^\[Página\s+(\d{1,4})\s+de/); if (!g) return p;
    const { ruido } = analisar(p); if (!ruido) return p;
    const fim = p.search(/Localizar pelo código:[^\n]*\n?/); let corte = p.length;
    if (fim >= 0) { const m = p.slice(fim).match(/^Localizar pelo código:[^\n]*\n?/); corte = fim + (m ? m[0].length : 0); } else corte = Math.min(p.length, 600);
    const cabeca = p.slice(0, corte).replace(/\s*$/, "\n");
    const mov = Number(p.match(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:/i)?.[1]) || undefined, arquivo = p.match(/Arquivo\s+\d+\s*:\s*([^\n]*?)\s*-\s*Pag\./i)?.[1];
    const novo = `${cabeca}[página de imagem sem texto legível: o OCR devolveu só ruído${arquivo ? ` (arquivo ${arquivo})` : ""}; confira a imagem no processo]\n`;
    economia += p.length - novo.length; paginas.push({ pagina: Number(g[1]), mov, arquivo, chars: p.length });
    return novo;
  }).join("");
  return { texto: saida, paginas, charsEconomizados: economia };
}
