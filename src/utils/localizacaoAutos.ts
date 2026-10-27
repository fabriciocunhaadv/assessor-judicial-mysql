// Localização das peças nos autos do Projudi: cada movimentação tem os seus arquivos e cada arquivo tem as suas páginas.
// O carimbo de cada página ("Movimentacao N : <tipo> / Arquivo M: nome.pdf - Pag.K/T") é a única fonte válida de Mov./Arq./Pág.;
// o marcador "[Página G de N]" é só a posição física no PDF consolidado. Aqui: (1) cada página ganha, logo após o marcador, uma linha com a localização
// real, e (2) as citações da minuta que usam a página global ou o arquivo errado são corrigidas quando os carimbos provam o certo.

export interface Loc { mov: number; arq: number; pag: number; tot: number }
const SEPARA_PAGINAS = /(?=\[Página\s+\d{1,4}\s+de\s+\d{1,4}\])/;
const CARIMBO = /Movimenta[cç][aã]o\s+(\d{1,4})\s*:[^\n]*\n?\s*Arquivo\s+(\d{1,3})\s*:[^\n]*?Pag\.\s*(\d{1,4})\s*\/\s*(\d{1,4})/gi;
const CABECALHO = /^\s*\[Mov\. \d{1,4} · Arq\. \d{1,3} · Pág\. \d{1,4}\/\d{1,4}\]/;      // a limpeza do texto pode juntar a linha com a seguinte

function carimboDaPagina(p: string): Loc | null {
  const c = [...p.matchAll(CARIMBO)].pop();      // o carimbo fica no rodapé da página
  return c ? { mov: +c[1], arq: +c[2], pag: +c[3], tot: +c[4] } : null;
}

/** Acrescenta, depois de cada "[Página G de N]", a linha "[Mov. N · Arq. M · Pág. K/T]" lida do carimbo da própria página. Idempotente. */
export function anotarLocalizacao(texto: string): string {
  if (typeof texto !== "string" || !texto.includes("[Página")) return texto;
  return texto.split(SEPARA_PAGINAS).map((p) => {
    const m = p.match(/^(\[Página\s+\d{1,4}\s+de\s+\d{1,4}\])(\r?\n)?/);
    if (!m) return p;
    const resto = p.slice(m[0].length);
    if (CABECALHO.test(resto)) return p;      // já anotada
    const loc = carimboDaPagina(p);
    return loc ? `${m[1]}\n[Mov. ${loc.mov} · Arq. ${loc.arq} · Pág. ${loc.pag}/${loc.tot}]\n${resto}` : p;
  }).join("");
}

/** Página global -> localização real, lida dos carimbos. */
export function mapaDeLocalizacao(autos: string): Map<number, Loc> {
  const m = new Map<number, Loc>();
  for (const p of String(autos || "").split(SEPARA_PAGINAS)) {
    const g = p.match(/^\[Página\s+(\d{1,4})\s+de/); if (!g) continue;
    const loc = carimboDaPagina(p); if (loc) m.set(+g[1], loc);
  }
  return m;
}

const CITACAO = /Mov\.?\s*(\d{1,4})\s*,\s*Arq\.?\s*(\d{1,3})\s*,\s*P[aá]gs?\.?\s*(\d{1,4})(?:\s*(?:a|-|–)\s*(\d{1,4}))?(?!\s*(?:e|,)\s*\d)/gi;

/** Corrige citações "Mov. X, Arq. Y, Pág(s). Z" que usam a página global do PDF ou o arquivo errado, só quando os carimbos provam a localização certa. */
export function corrigirCitacoes(texto: string, mapa: Map<number, Loc>): { texto: string; trocas: number } {
  if (typeof texto !== "string" || !texto || !mapa.size) return { texto, trocas: 0 };
  const totais = new Map<string, number>(); for (const l of mapa.values()) totais.set(`${l.mov}|${l.arq}`, l.tot);
  let trocas = 0;
  const out = texto.replace(CITACAO, (cit, mov, arq, p1, p2) => {
    const tot = totais.get(`${mov}|${arq}`);
    if (tot !== undefined && +p1 <= tot && (!p2 || +p2 <= tot)) return cit;      // já é arquivo e página que existem
    const a = mapa.get(+p1), b = p2 ? mapa.get(+p2) : a;
    if (!a || !b || a.mov !== +mov || b.mov !== +mov) return cit;      // os carimbos não provam: fica como a IA escreveu (e o aviso de citação mostra)
    trocas++;
    if (a.arq !== b.arq) return `Mov. ${mov}, Arqs. ${Math.min(a.arq, b.arq)} a ${Math.max(a.arq, b.arq)}`;
    return a.pag === b.pag ? `Mov. ${mov}, Arq. ${a.arq}, Pág. ${a.pag}` : `Mov. ${mov}, Arq. ${a.arq}, Págs. ${a.pag} a ${b.pag}`;
  });
  return { texto: out, trocas };
}

/** Aplica a correção aos textos (campos string, no próprio objeto) de uma minuta. Devolve quantas citações foram corrigidas. */
export function corrigirCitacoesDaMinuta(minuta: any, autos: string): number {
  if (!minuta || typeof minuta !== "object") return 0;
  const mapa = mapaDeLocalizacao(autos); if (!mapa.size) return 0;
  let total = 0;
  for (const k of Object.keys(minuta)) {
    if (typeof minuta[k] !== "string") continue;
    const r = corrigirCitacoes(minuta[k], mapa);
    if (r.trocas) { minuta[k] = r.texto; total += r.trocas; }
  }
  return total;
}
