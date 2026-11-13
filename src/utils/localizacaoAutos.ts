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
    const maxTot = Math.max(0, ...[...mapa.values()].filter((l) => l.mov === +mov).map((l) => l.tot));
    if (tot === undefined && +p1 <= maxTot) return cit;      // o arquivo citado não existe, mas a página cabe dentro de arquivos da movimentação: não dá para provar que é "página global"; fica o aviso de citação
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
    const r2 = repararCitacoesPorNome(minuta[k], autos);      // 1º: arquivo que a movimentação não tem -> acha pelo nome do documento citado (evidência mais forte)
    if (r2.trocas) { minuta[k] = r2.texto; total += r2.trocas; }
    const r = corrigirCitacoes(minuta[k], mapa);      // 2º: página global do PDF usada no lugar da página do arquivo
    if (r.trocas) { minuta[k] = r.texto; total += r.trocas; }
  }
  return total;
}

/** Citações "Mov. X, Arq. Y, Pág. Z" da minuta que NÃO existem nos autos, conferidas só pelos carimbos (sem IA): arquivo que a movimentação não tem, ou página além do total do arquivo.
 *  Movimentação que nem aparece nos carimbos fica de fora (essa conferência é outra). Só confere onde os carimbos provam. */
export function citacoesInexistentes(minuta: string, autos: string): Array<{ citacao: string; motivo: string }> {
  if (typeof minuta !== "string") return [];
  const outTela: Array<{ citacao: string; motivo: string }> = [], daTela = arquivosDoQuadro(autos);
  if (daTela.size) { const vistasT = new Set<string>(); for (const m of minuta.matchAll(CITACAO)) { const mov = +m[1], arq = +m[2], cit = m[0].trim(), nomes = daTela.get(mov); if (nomes && arq > nomes.length && !vistasT.has(cit)) { vistasT.add(cit); outTela.push({ citacao: cit, motivo: `a Mov. ${mov} tem só ${nomes.length} arquivo(s) na tela do Projudi (não existe o Arq. ${arq})` }); } } }
  const mapa = mapaDeLocalizacao(autos); if (!mapa.size) return outTela.slice(0, 8);
  const totais = new Map<string, number>(), arqsDaMov = new Map<number, Set<number>>();
  for (const l of mapa.values()) { totais.set(`${l.mov}|${l.arq}`, l.tot); (arqsDaMov.get(l.mov) || arqsDaMov.set(l.mov, new Set()).get(l.mov)!).add(l.arq); }
  const out: Array<{ citacao: string; motivo: string }> = [], vistas = new Set<string>();
  for (const m of minuta.matchAll(CITACAO)) {
    const mov = +m[1], arq = +m[2], p1 = +m[3], p2 = m[4] ? +m[4] : 0, cit = m[0].trim();
    const arqs = arqsDaMov.get(mov); if (!arqs || vistas.has(cit)) continue;      // movimentação sem carimbo nos autos: não dá para provar
    const tot = totais.get(`${mov}|${arq}`);
    if (tot === undefined) { vistas.add(cit); out.push({ citacao: cit, motivo: `a Mov. ${mov} não tem o Arq. ${arq} nos autos (arquivos que ela tem: ${[...arqs].sort((a, b) => a - b).join(", ")})` }); }
    else if (p1 > tot || (p2 && p2 > tot)) { vistas.add(cit); out.push({ citacao: cit, motivo: `o Arq. ${arq} da Mov. ${mov} tem só ${tot} página(s)` }); }
  }
  return [...outTela, ...out.filter((o) => !outTela.some((t) => t.citacao === o.citacao))].slice(0, 8);
}


// ---------- ÍNDICE DE ARQUIVOS (prevenção) e reparo por nome do arquivo ----------
const CARIMBO_NOME = /Movimenta[cç][aã]o\s+(\d{1,4})\s*:[^\n]*\n?\s*Arquivo\s+(\d{1,3})\s*:\s*([^\n]*?)\s*-\s*Pag\.\s*(\d{1,4})\s*\/\s*(\d{1,4})/gi;
const semAc = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** mov -> arq -> {nome, tot}, lido dos carimbos das páginas (a única fonte válida de Arq.). */
export function arquivosPorMovimentacao(autos: string): Map<number, Map<number, { nome: string; tot: number }>> {
  const m = new Map<number, Map<number, { nome: string; tot: number }>>();
  for (const c of String(autos || "").matchAll(CARIMBO_NOME)) {
    const mov = +c[1], arq = +c[2];
    const arqs = m.get(mov) || m.set(mov, new Map()).get(mov)!;
    if (!arqs.has(arq)) arqs.set(arq, { nome: c[3].trim(), tot: +c[5] });
  }
  return m;
}

/** mov -> nomes dos arquivos, na ordem da tela do Projudi (Arq. 1, 2, 3…), lidos do QUADRO DE MOVIMENTAÇÕES ("· arquivos: 1=nome; 2=nome"). Só existe se a extensão (3.0.0+) abriu a lista de arquivos de cada movimentação. */
export function arquivosDoQuadro(autos: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const t = String(autos || ""), i = t.indexOf("[QUADRO DE MOVIMENTA"); if (i < 0) return out;
  const f = t.indexOf("[FIM DO QUADRO", i), corpo = t.slice(i, f > 0 ? f : i + 400000);
  for (const linha of corpo.split("\n")) {
    const m = linha.match(/^Mov\.\s*(\d{1,4})\s*·.*?·\s*arquivos:\s*(.+)$/); if (!m) continue;
    const nomes = m[2].split(/;\s*(?=\d{1,3}=)/).map((x) => x.replace(/^\d{1,3}=/, "").trim()).filter(Boolean);
    if (nomes.length) out.set(+m[1], nomes);
  }
  return out;
}

/** Bloco para o pedido da IA: quais arquivos (e quantas páginas) cada movimentação TEM de verdade, com o nome. Evita citar "Arq. 27" numa movimentação que só tem 23. */
export function blocoIndiceArquivos(autos: string, maxChars = 24000): string {
  const m = arquivosPorMovimentacao(autos), q = arquivosDoQuadro(autos); if (!m.size && !q.size) return "";
  const linhas: string[] = [];
  for (const mov of [...m.keys()].sort((a, b) => a - b)) {
    const arqs = m.get(mov)!;
    linhas.push(`Mov. ${mov} (${arqs.size} arquivo${arqs.size > 1 ? "s" : ""}): ` + [...arqs.entries()].sort((a, b) => a[0] - b[0]).map(([a, v]) => `Arq. ${a} = ${v.nome.slice(0, 60)} (${v.tot} pág.)`).join("; "));
  }
  let tela = "";
  if (q.size) {      // lista da TELA do Projudi (extensão 3.0.0+): completa, com áudio/vídeo/HTML que não entram no PDF; a numeração é a da tela
    const l2 = [...q.keys()].sort((a, b) => a - b).map((mov) => `Mov. ${mov} (${q.get(mov)!.length} arquivo${q.get(mov)!.length > 1 ? "s" : ""} na tela): ` + q.get(mov)!.map((n, i) => `Arq. ${i + 1} = ${n.slice(0, 60)}`).join("; "));
    tela = `\n\n[LISTA OFICIAL DE ARQUIVOS LIDA DA TELA DO PROJUDI (completa; inclui áudio, vídeo e documentos “online” que não entram no PDF; vale para o NÚMERO do arquivo)]\n${l2.join("\n").slice(0, maxChars)}\n[FIM DA LISTA DA TELA]`;
  }
  let txt = linhas.join("\n"); if (txt.length > maxChars) txt = txt.slice(0, maxChars) + "\n[... índice cortado ...]";
  if (!txt) return tela + "\n";
  return tela + `\n\n[ÍNDICE OFICIAL DE ARQUIVOS POR MOVIMENTAÇÃO (lido dos carimbos das páginas; é a ÚNICA fonte válida do número do arquivo)]\nRegra: em "Mov. N, Arq. M, Pág. K", o ARQUIVO M é o número do arquivo DENTRO da movimentação N e a PÁGINA K é a página DENTRO desse arquivo (de 1 ao total dele). NUNCA cite um arquivo que não esteja neste índice para a movimentação, nem página além do total do arquivo. Para citar um documento, ache o nome dele aqui e use o número do arquivo correspondente.\n${txt}\n[FIM DO ÍNDICE]\n`;
}

/** Citação com arquivo que a movimentação NÃO tem: tenta achar o arquivo certo pelo nome (palavras do arquivo que aparecem logo antes da citação). Só troca se um único arquivo se destaca. */
export function repararCitacoesPorNome(texto: string, autos: string): { texto: string; trocas: number } {
  const idx = arquivosPorMovimentacao(autos); if (typeof texto !== "string" || !texto || !idx.size) return { texto, trocas: 0 };
  let trocas = 0;
  const out = texto.replace(CITACAO, (cit, mov, arq, p1, p2, pos: number, todo: string) => {
    const arqs = idx.get(+mov); if (!arqs) return cit;
    const ok = arqs.get(+arq); if (ok && +p1 <= ok.tot && (!p2 || +p2 <= ok.tot)) return cit;      // existe: nada a reparar
    const antes = semAc(todo.slice(Math.max(0, pos - 220), pos));
    const pontos = [...arqs.entries()].map(([a, v]) => {
      const palavras = semAc(v.nome).replace(/\.[a-z0-9]{2,4}$/i, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(sign|assinado|pdf|doc|docx)$/.test(w) && !/^\d+$/.test(w));
      return { a, v, n: palavras.filter((w) => antes.includes(w)).length };
    }).sort((x, y) => y.n - x.n);
    const [m1, m2] = pontos; if (!m1 || m1.n < 2 || (m2 && m2.n === m1.n)) return cit;
    if (+p1 > m1.v.tot || (p2 && +p2 > m1.v.tot)) return `Mov. ${mov}, Arq. ${m1.a}, Pág. 1`;      // a página citada não cabe no arquivo certo: aponta o início dele
    trocas++; return cit.replace(/Arq\.?\s*\d{1,3}/i, `Arq. ${m1.a}`);
  });
  return { texto: out, trocas };
}
