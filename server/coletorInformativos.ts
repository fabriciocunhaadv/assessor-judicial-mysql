// Coletor, parte 2: Jurisprudência em Teses do STJ (site oficial, lido por REGRA) e Informativos do TJGO (PDF mensal oficial, lido com ajuda de IA).
// Mesmas regras do coletor principal: só Super Admin, janela do ano atual e 2 anteriores, não repete o que já está no banco, marca a origem de cada item.
import type { ResumoFonte } from "./coletorPrecedentes";

export const AVISO_JT = "Jurisprudência em Teses do STJ (site oficial): tese extraída de julgados, não é precedente vinculante; confira no tribunal";
export const AVISO_TJGO = "Informativo do TJGO (PDF oficial) lido por IA; confira o texto no informativo";
export const URL_JT_LISTA = "https://scon.stj.jus.br/SCON/jt/jt.jsp";
export const urlEdicaoJT = (n: number) => `https://scon.stj.jus.br/SCON/jt/doc.jsp?livre=${encodeURIComponent(`'${n}' INPATH(TIT)`).replace(/%28/g, "(").replace(/%29/g, ")")}`;
export const URL_TJGO = "https://transparencia.tjgo.jus.br/jurisprudencia/informativo-jurisprudencia";

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NOME_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const decodificar = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª");
const texto = (h: string) => decodificar(String(h || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/\s+([.,;:)])/g, "$1").trim();

// ------------------------------------------------------------------ Jurisprudência em Teses (STJ)
export interface TeseJT { n: number; texto: string; fundamento: string; acordaos: string[] }
export interface EdicaoJT { edicao: number | null; titulo: string; ano: number | null; disponibilizadaEm: string; teses: TeseJT[] }

export function extrairEdicaoJT(html: string): EdicaoJT {
  const s = String(html || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, "");
  const ed = s.match(/<span class="numeroSumula">\s*(\d+)\s*<\/span>/i);
  const tit = s.match(/<span class="clsVerbete">\s*<a[^>]*>([\s\S]*?)<\/a>/i);
  const dt = s.match(/Edição disponibilizada em:\s*<b class="clsData">\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const teses: TeseJT[] = [];
  for (const bloco of s.split(/<div class="clsTemasJT[^"]*"[^>]*>/i).slice(1)) {
    const n = parseInt((bloco.match(/<div id="TEMA(\d+)"/i) || [])[1] || "", 10);
    const t = (bloco.match(/<div class="clsSubmitPesquisaTema">\s*<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1];
    if (!Number.isFinite(n) || !t) continue;
    const corpo = texto(t).replace(/^\d+\)\s*/, "");
    if (corpo.length < 15) continue;
    const antesBotoes = bloco.split(/<div class="clsBotoesJT/i)[0];
    const fund = (antesBotoes.match(/<div>\s*<i>([\s\S]*?)<\/i>\s*<\/div>/i) || [])[1];
    const ac = (bloco.match(/<h4>\s*Acórdãos\s*<\/h4>\s*<div class="clsJulgadosJT">([\s\S]*?)<\/div>\s*<\/div>/i) || [])[1] || "";
    const acordaos = ac ? ac.split(/<\/div>\s*<div>/i).map((x) => texto(x)).filter(Boolean).slice(0, 4) : [];
    teses.push({ n, texto: corpo, fundamento: fund ? texto(fund) : "", acordaos });
  }
  return { edicao: ed ? +ed[1] : null, titulo: tit ? texto(tit[1]) : "", ano: dt ? +dt[3] : null, disponibilizadaEm: dt ? `${dt[1]}/${dt[2]}/${dt[3]}` : "", teses };
}

export function precedentesDaEdicaoJT(e: EdicaoJT, agora: string) {
  if (!e.edicao) return [];
  return e.teses.map((t) => ({
    id: `col-stj-jt-${e.edicao}-${t.n}`, tribunal: "STJ", type: "jurisprudencia_em_teses", number: `JT ${e.edicao}.${t.n}`,
    title: `Jurisprudência em Teses do STJ, edição ${e.edicao} (${e.titulo || "sem título"}), tese ${t.n}: ${t.texto.slice(0, 110)}`,
    statement: `${t.texto}${t.fundamento ? ` [${t.fundamento}]` : ""}${t.acordaos.length ? ` Julgados que a sustentam: ${t.acordaos.join("; ")}.` : ""}`,
    sourceUrl: urlEdicaoJT(e.edicao), tags: tagsSimples(`${e.titulo} ${t.texto}`), area: "Geral",
    origem: "coletor_site_oficial", avisoOrigem: AVISO_JT, sourceFile: `Jurisprudência em Teses, edição ${e.edicao}`, importedAt: agora,
    anoRef: e.ano ?? undefined, edicaoJT: e.edicao, situacao: "vigente",
  }));
}

const FRACAS = new Set(["sobre", "acerca", "quando", "ainda", "porém", "entre", "contra", "forma", "casos", "caso", "deve", "devem", "pode", "podem", "seja", "sendo", "desde", "apenas", "mesmo", "também", "somente", "exclusivamente"]);
function tagsSimples(t: string): string[] {
  const f = new Map<string, number>();
  for (const w of (t.toLowerCase().match(/[a-zà-ú]{6,}/g) || [])) if (!FRACAS.has(w)) f.set(w, (f.get(w) || 0) + 1);
  return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

/** Acha a edição mais nova a partir da página de listagem (qualquer número de edição que apareça em links ou caixas de seleção). */
export function maiorEdicaoDaLista(html: string): number | null {
  const nums = new Set<number>();
  for (const m of String(html || "").matchAll(/livre=(?:'|%27|&#39;|&#x27;)?(\d{1,4})(?:'|%27|&#39;|&#x27;)?(?:\s|%20|\+)?INPATH/gi)) nums.add(+m[1]);
  for (const m of String(html || "").matchAll(/name="selecao_edicao"[^>]*value="(\d{1,4})"/gi)) nums.add(+m[1]);
  for (const m of String(html || "").matchAll(/EDI[ÇC][ÃA]O N\.\s*(\d{1,4})/gi)) nums.add(+m[1]);
  return nums.size ? Math.max(...nums) : null;
}

export async function coletarJT(o: { baixar: (u: string) => Promise<string>; existentes: any[]; anoAtual: number; agora: string; htmlLista?: string; htmlEdicao?: Record<number, string>; maxEdicoes?: number; simular?: boolean; gravar?: (l: any[]) => Promise<void> }) {
  const r: ResumoFonte = { id: "stj-jt", rotulo: "STJ · Jurisprudência em Teses", ok: false, lidos: 0, naoFirmes: 0, foraJanela: 0, candidatos: 0, novos: 0, jaExistiam: 0 };
  const novos: any[] = [];
  try {
    const lista = o.htmlLista ?? await o.baixar(URL_JT_LISTA);
    let topo = maiorEdicaoDaLista(lista);
    if (!topo) throw new Error("não achei o número da edição mais nova na página de listagem (o site pode ter mudado)");
    const buscar = async (n: number) => o.htmlEdicao?.[n] ?? await o.baixar(urlEdicaoJT(n));
    for (let k = 0; k < 6; k++) { try { const e = extrairEdicaoJT(await buscar(topo + 1)); if (e.edicao === topo + 1 && e.teses.length) topo++; else break; } catch { break; } }      // a edição mais nova pode não estar na listagem
    const jaTem = new Set(o.existentes.filter((p: any) => p?.edicaoJT).map((p: any) => +p.edicaoJT));
    const minAno = o.anoAtual - 2; const max = o.maxEdicoes ?? 150; let falhasSeguidas = 0;
    for (let n = topo, i = 0; n >= 1 && i < max; n--, i++) {
      if (jaTem.has(n)) { r.jaExistiam++; continue; }
      let e: EdicaoJT;
      try { e = extrairEdicaoJT(await buscar(n)); falhasSeguidas = 0; } catch { if (++falhasSeguidas >= 3) break; continue; }
      if (!e.edicao || !e.teses.length) { if (++falhasSeguidas >= 3) break; continue; }
      r.lidos += e.teses.length;
      if (e.ano != null && e.ano < minAno) { r.foraJanela += e.teses.length; break; }      // as edições vêm em ordem; ao sair da janela, para
      const itens = precedentesDaEdicaoJT(e, o.agora); r.candidatos += itens.length;
      novos.push(...itens);
    }
    r.novos = novos.length; r.ok = true;
    if (novos.length && !o.simular && o.gravar) await o.gravar(novos);
  } catch (err: any) { r.erro = String(err?.message || err).slice(0, 240); }
  return { resumo: r, novos };
}

// ------------------------------------------------------------------ Informativos do TJGO (PDF mensal)
export interface PdfInformativo { url: string; ano: number; mes: number; nome: string }
export function listarPdfsTjgo(html: string): PdfInformativo[] {
  const out = new Map<string, PdfInformativo>();
  for (const m of String(html || "").matchAll(/href="([^"]+?\.pdf)"/gi)) {
    const url = decodificar(m[1]); const nome = decodeURIComponent(url.split("/").pop() || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!/informativo/.test(nome)) continue;
    const ano = (nome.match(/(20\d\d)/) || [])[1]; const mi = MESES.findIndex((x) => nome.includes(x));
    if (!ano || mi < 0) continue;
    const k = `${ano}-${mi + 1}`; if (!out.has(k)) out.set(k, { url, ano: +ano, mes: mi + 1, nome });
  }
  return [...out.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes);
}
export interface ItemInformativoIA { titulo: string; enunciado: string; area?: string; processo?: string }

export async function coletarInformativosTjgo(o: {
  baixar: (u: string) => Promise<string>; lerPdf: (url: string) => Promise<string>; extrairComIA?: (texto: string, ctx: { ano: number; mes: number }) => Promise<ItemInformativoIA[]>;
  existentes: any[]; anoAtual: number; agora: string; htmlPagina?: string; simular?: boolean; gravar?: (l: any[]) => Promise<void>; maxMeses?: number;
}) {
  const r: ResumoFonte = { id: "tjgo-informativos", rotulo: "TJGO · Informativos de Jurisprudência", ok: false, lidos: 0, naoFirmes: 0, foraJanela: 0, candidatos: 0, novos: 0, jaExistiam: 0 };
  const novos: any[] = [];
  try {
    const html = o.htmlPagina ?? await o.baixar(URL_TJGO);
    const pdfs = listarPdfsTjgo(html);
    if (!pdfs.length) throw new Error("não achei os PDFs dos informativos na página (ela pode carregar a lista por script; nesse caso a coleta precisa ser feita pela extensão)");
    r.lidos = pdfs.length;
    const minAno = o.anoAtual - 2;
    const dentro = pdfs.filter((p) => p.ano >= minAno && p.ano <= o.anoAtual); r.foraJanela = pdfs.length - dentro.length; r.candidatos = dentro.length;
    const mesesFeitos = new Set(o.existentes.filter((p: any) => p?.mesRef && /^coletor/.test(String(p.origem || ""))).map((p: any) => String(p.mesRef)));
    const pendentes = dentro.filter((p) => !mesesFeitos.has(`${p.ano}-${String(p.mes).padStart(2, "0")}`));
    r.jaExistiam = dentro.length - pendentes.length;
    if (pendentes.length && !o.extrairComIA && !o.simular) throw new Error("falta a chave de IA para ler os PDFs (configure a chave do Gemini ou use a chave nativa)");
    let feitos = 0; const falhasMes: string[] = [];
    for (const p of pendentes.slice(0, o.maxMeses ?? 12)) {
      if (o.simular) { novos.push({ simulado: true, mesRef: `${p.ano}-${p.mes}` }); continue; }
      try {
        const txt = await o.lerPdf(p.url);
        if (!txt || txt.trim().length < 200) { falhasMes.push(`${NOME_MES[p.mes - 1]}/${p.ano}: PDF sem texto legível`); continue; }
        const itens = await o.extrairComIA!(txt, { ano: p.ano, mes: p.mes });
        const mesRef = `${p.ano}-${String(p.mes).padStart(2, "0")}`;
        const lote = itens.filter((i) => i && (i.enunciado || "").trim().length >= 30).map((i, k) => ({
          id: `col-tjgo-informativo-${mesRef}-${k + 1}`, tribunal: "TJGO", type: "informativo_tjgo", number: `Informativo TJGO ${NOME_MES[p.mes - 1]}/${p.ano}, item ${k + 1}`,
          title: String(i.titulo || i.enunciado).slice(0, 160), statement: String(i.enunciado).trim() + (i.processo ? ` (${i.processo})` : ""), sourceUrl: p.url,
          tags: tagsSimples(`${i.titulo} ${i.enunciado}`), area: "Geral", origem: "coletor_informativo_ia", avisoOrigem: AVISO_TJGO, sourceFile: `Informativo TJGO ${NOME_MES[p.mes - 1]}/${p.ano}`,
          importedAt: o.agora, anoRef: p.ano, mesRef, situacao: "vigente",
        }));
        if (!lote.length) { falhasMes.push(`${NOME_MES[p.mes - 1]}/${p.ano}: a IA não encontrou itens`); continue; }
        if (o.gravar) await o.gravar(lote);
        novos.push(...lote); feitos++;
      } catch (e: any) { falhasMes.push(`${NOME_MES[p.mes - 1]}/${p.ano}: ${String(e?.message || e).slice(0, 80)}`); }
    }
    r.novos = o.simular ? pendentes.slice(0, o.maxMeses ?? 12).length : novos.length; r.ok = true;
    if (falhasMes.length) { r.naoFirmes = falhasMes.length; r.erro = `meses com problema: ${falhasMes.slice(0, 3).join("; ")}`; }
    if (o.simular) return { resumo: { ...r, novos: pendentes.length, rotulo: `TJGO · Informativos (${pendentes.length} mês(es) a ler; os itens só aparecem depois da leitura)` }, novos: [] };
  } catch (err: any) { r.erro = String(err?.message || err).slice(0, 300); }
  return { resumo: r, novos };
}
