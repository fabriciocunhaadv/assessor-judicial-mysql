// Coletor de súmulas e teses nos sites de apoio (Teses & Súmulas). SÓ o Super Admin aciona (a base é única e aparece para todos os gabinetes).
// Lê as páginas por REGRA (sem IA: não inventa número nem texto), escolhe o que entra e só cadastra o que ainda não está no banco.
// Janela: ano atual e os 2 anteriores, pelo ano que a própria página marca ("Aprovada em", "Publicada em", "julgado em"). Itens sem data legível: só os 150 de maior número da fonte.
import { getAllBindingPrecedents } from "../src/utils/bindingPrecedents";

export const AVISO_ORIGEM_COLETA = "coletado do site de apoio, confira no tribunal";
export const LIMITE_SEM_DATA = 150;

export interface FonteColeta { id: string; tribunal: "STF" | "STJ" | "TNU"; url: string; natureza: "sumula" | "tese"; rotulo: string }
export const FONTES_COLETA: FonteColeta[] = [
  { id: "stf-sumulas", tribunal: "STF", url: "https://tesesesumulas.com.br/sumulas/stf", natureza: "sumula", rotulo: "STF · Súmulas e Súmulas Vinculantes" },
  { id: "stj-sumulas", tribunal: "STJ", url: "https://tesesesumulas.com.br/sumulas/stj", natureza: "sumula", rotulo: "STJ · Súmulas" },
  { id: "tnu-sumulas", tribunal: "TNU", url: "https://tesesesumulas.com.br/sumulas/tnu", natureza: "sumula", rotulo: "TNU · Súmulas" },
  { id: "stf-teses", tribunal: "STF", url: "https://tesesesumulas.com.br/teses/stf", natureza: "tese", rotulo: "STF · Teses de Repercussão Geral" },
  { id: "stj-teses", tribunal: "STJ", url: "https://tesesesumulas.com.br/teses/stj", natureza: "tese", rotulo: "STJ · Recursos Repetitivos" },
  { id: "tnu-teses", tribunal: "TNU", url: "https://tesesesumulas.com.br/teses/tnu", natureza: "tese", rotulo: "TNU · Temas Representativos" },
];

type Tipo = "sumula" | "sumula_vinculante" | "tese_repetitivo" | "tese_repercussao_geral" | "tese_tnu";
export interface ItemBruto { numero: number; tipo: Tipo; rotulo: string; titulo: string; texto: string; ano: number | null; situacao: string; area: string; link: string; firme: boolean; motivoFora?: string }

const MESES: Record<string, number> = { janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const limpar = (h: string) => String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, "")
  .replace(/<div class="google-anno-skip[^>]*>[\s\S]*?<\/div>/gi, "");
const decodificar = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª");
const texto = (h: string) => decodificar(String(h || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Ano marcado pela PRÓPRIA página (rodapé do item). Nunca pega data citada dentro do enunciado ou da tese. */
export function anoDoItem(rodape: string, enunciado: string): number | null {
  let m = rodape.match(/(?:Aprovada|Publicada)\s+em\s+(\d{1,2})\/(\d{1,2})\/(20\d\d|19\d\d)/i);
  if (m) return +m[3];
  m = enunciado.match(/\((?:SÚMULA|S[úu]mula)\s+\d+[^)]*?julgado\s+em\s+(\d{1,2})\/(\d{1,2})\/(20\d\d|19\d\d)/i);
  if (m) return +m[3];
  m = enunciado.match(/\(A Turma Nacional de Uniformização,[^)]*?\bde (\d{1,2}) de ([a-zçã]+) de (20\d\d|19\d\d)/i);
  if (m && MESES[m[2].toLowerCase()]) return +m[3];
  return null;
}

const SITUACAO_FIRME = /^(julgado|tr[aâ]nsito em julgado|ac[oó]rd[aã]o\b.*publicado|ac[oó]rd[aã]o de m[eé]rito publicado|m[eé]rito julgado|revisado)/i;

export function extrairItens(html: string, fonte: FonteColeta): ItemBruto[] {
  const s = limpar(html);
  const cls = fonte.natureza === "sumula" ? "sumula-item" : "tese-item";
  const partes = s.split(new RegExp(`<div class="${cls}[^"]*"[^>]*data-numero="`, "i")).slice(1);
  const out: ItemBruto[] = [];
  const vistos = new Set<string>();
  for (const p of partes) {
    const n = parseInt(p.slice(0, p.indexOf('"')).replace(/\D/g, ""), 10);
    if (!Number.isFinite(n)) continue;
    const link = (p.match(/href="(https:\/\/tesesesumulas\.com\.br\/(?:sumula|tese)\/[^"]+)"/i) || [])[1] || fonte.url;
    const ps = [...p.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => texto(m[1])).filter((x) => x.length > 0);
    const cabecalho = texto((p.match(/<h4[\s\S]*?<\/h4>/i) || [""])[0]);
    const spans = [...p.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => texto(m[1])).filter(Boolean);
    const rodape = spans.filter((x) => /(Aprovada|Publicada) em|Situação:|\(.*\)\.\s*$/i.test(x)).join(" ");
    if (fonte.natureza === "sumula") {
      const enunciado = ps[0] || "";
      if (!enunciado) continue;
      const sv = /\/sv\d+/i.test(link) || /vinculante/i.test(cabecalho);
      const tipo: Tipo = sv ? "sumula_vinculante" : "sumula";
      const rotulo = sv ? `Súmula Vinculante ${n}` : `Súmula ${n}`;
      const cancelada = /CANCELAMENTO|\(cancelad[ao]|s[úu]mula cancelada/i.test(enunciado);
      const k = `${tipo}:${n}`; if (vistos.has(k)) continue; vistos.add(k);
      out.push({ numero: n, tipo, rotulo, titulo: enunciado.replace(/\s*\((?:SÚMULA|Súmula)\s+\d+.*$/i, "").slice(0, 140), texto: enunciado, ano: anoDoItem(rodape, enunciado), situacao: cancelada ? "cancelada" : "vigente", area: "", link, firme: !cancelada, motivoFora: cancelada ? "cancelada" : undefined });
    } else {
      const tipo: Tipo = fonte.tribunal === "STJ" ? "tese_repetitivo" : fonte.tribunal === "STF" ? "tese_repercussao_geral" : "tese_tnu";
      // cabeçalho: "TEMA 1469 [ÁREA] Situação". A situação é o ÚLTIMO bloco curto antes da questão; no TNU a área vem antes dela.
      const blocoCab = (p.match(/<\/h4>([\s\S]*?)(?=<p[ >])/i) || ["", ""])[1];
      const cab = [...blocoCab.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => texto(m[1])).filter(Boolean);
      const situacao = cab.length ? cab[cab.length - 1] : "";
      const area = fonte.tribunal === "TNU" && cab.length > 1 ? cab[0] : "";
      const questao = ps[0] || "", tese = ps[1] || "";
      const firme = SITUACAO_FIRME.test(situacao) && tese.length >= 20 && !/aguarda julgamento|^\[/i.test(tese);
      const k = `${tipo}:${n}`; if (vistos.has(k)) continue; vistos.add(k);
      out.push({ numero: n, tipo, rotulo: `Tema ${n}`, titulo: questao.slice(0, 200), texto: tese, ano: anoDoItem(rodape, tese), situacao, area, link, firme, motivoFora: firme ? undefined : (/cancelad/i.test(situacao) ? "cancelado" : !SITUACAO_FIRME.test(situacao) ? `situação "${situacao || "?"}" (sem tese firmada)` : "sem texto da tese") });
    }
  }
  return out;
}

/** Janela de anos + 150 maiores números das que não têm data. Só entram itens com tese/enunciado firme e vigente. */
export function escolherItens(itens: ItemBruto[], anoAtual: number, limiteSemData = LIMITE_SEM_DATA): { escolhidos: ItemBruto[]; foraJanela: number; naoFirmes: number } {
  const firmes = itens.filter((i) => i.firme);
  const naoFirmes = itens.length - firmes.length;
  const minAno = anoAtual - 2;
  const porTipo = new Map<string, ItemBruto[]>();
  for (const i of firmes) { if (!porTipo.has(i.tipo)) porTipo.set(i.tipo, []); porTipo.get(i.tipo)!.push(i); }
  const escolhidos: ItemBruto[] = [];
  for (const lista of porTipo.values()) {
    const topo = new Set([...lista].sort((a, b) => b.numero - a.numero).slice(0, limiteSemData).map((i) => i.numero));
    for (const i of lista) {
      if (i.ano != null ? (i.ano >= minAno && i.ano <= anoAtual) : topo.has(i.numero)) escolhidos.push(i);
    }
  }
  escolhidos.sort((a, b) => a.tipo.localeCompare(b.tipo) || b.numero - a.numero);
  return { escolhidos, foraJanela: firmes.length - escolhidos.length, naoFirmes };
}

const PALAVRAS_FRACAS = new Set(["sobre", "acerca", "quando", "esta", "este", "sendo", "ainda", "porém", "entre", "dessa", "desse", "daquele", "aquele", "para", "pelo", "pela", "contra", "forma", "caso", "casos", "saber", "definir", "estabelecer", "possibilidade", "aplicação", "aplicável", "hipótese", "relação", "todos", "todas", "quais", "qual", "deve", "devem", "podem", "pode", "tema", "súmula"]);
const tagsDe = (t: string, area: string) => {
  const palavras = (t.toLowerCase().match(/[a-zà-ú]{6,}/g) || []).filter((w) => !PALAVRAS_FRACAS.has(w));
  const freq = new Map<string, number>(); for (const w of palavras) freq.set(w, (freq.get(w) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  return area ? [area.toLowerCase(), ...top] : top;
};

export function paraPrecedente(i: ItemBruto, fonte: FonteColeta, agora: string) {
  const NOME_TIPO: Record<Tipo, string> = { sumula: "Súmula", sumula_vinculante: "Súmula Vinculante", tese_repetitivo: "Tema repetitivo", tese_repercussao_geral: "Tema de repercussão geral", tese_tnu: "Tema representativo" };
  const enunciado = i.tipo.startsWith("tese") && i.titulo ? `${i.texto}` : i.texto;
  return {
    id: `col-${fonte.tribunal.toLowerCase()}-${i.tipo}-${i.numero}`,
    tribunal: fonte.tribunal, type: i.tipo, number: i.rotulo,
    title: `${NOME_TIPO[i.tipo]} ${i.numero} do ${fonte.tribunal}${i.titulo ? ": " + i.titulo.slice(0, 120) : ""}`,
    statement: enunciado,
    sourceUrl: i.link, tags: tagsDe(`${i.titulo} ${i.texto}`, i.area), area: "Geral",
    origem: "coletor_site_apoio", avisoOrigem: AVISO_ORIGEM_COLETA, sourceFile: fonte.rotulo, importedAt: agora,
    anoRef: i.ano ?? undefined, situacao: "vigente", situacaoNoSite: i.situacao || undefined,
  };
}

/** Chave que reconhece o MESMO precedente venha de onde vier (base interna, PDF ou coletor): tribunal + natureza + número. */
export function chaveDoPrecedente(p: { tribunal?: string; type?: string; number?: string }): string | null {
  const num = String(p.number || ""); const t = String(p.tribunal || "").toUpperCase(); if (!t) return null;
  const sv = /vinculante/i.test(num) || p.type === "sumula_vinculante";
  const m = num.match(/(?:s[úu]mula(?:\s+vinculante)?|tema|enunciado)\s*(?:n[º°o.]*)?\s*(\d[\d.]*)/i);
  if (!m) return null;
  const natureza = sv ? "sv" : /s[úu]mula/i.test(num) || p.type === "sumula" ? "sumula" : /tema/i.test(num) || /^tese/.test(String(p.type || "")) ? "tese" : null;
  if (!natureza) return null;
  return `${t}|${natureza}|${m[1].replace(/\./g, "")}`;
}

export interface ResumoFonte { id: string; rotulo: string; ok: boolean; erro?: string; lidos: number; naoFirmes: number; foraJanela: number; candidatos: number; novos: number; jaExistiam: number }
export interface ResultadoColeta { anos: number[]; fontes: ResumoFonte[]; novos: any[]; totalNovos: number; totalJaExistiam: number; simulado: boolean }

export async function baixarPagina(url: string): Promise<string> {
  const base = process.env.COLETOR_SITE_BASE;      // só para teste: troca o endereço do site por um servidor local
  if (base) url = url.replace("https://tesesesumulas.com.br", base);
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AssessorJudicial-Coletor)", "Accept": "text/html" }, signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`o site respondeu ${r.status}`);
  return await r.text();
}

export async function coletarPrecedentes(opts: {
  existentes: any[]; anoAtual?: number; simular?: boolean; baixar?: (url: string) => Promise<string>; fontes?: FonteColeta[]; htmlPorFonte?: Record<string, string>;
  andamento?: (msg: string, feitas: number, total: number) => void; gravar?: (itens: any[]) => Promise<void>; agora?: Date;
}): Promise<ResultadoColeta> {
  const agoraD = opts.agora || new Date(), anoAtual = opts.anoAtual || agoraD.getFullYear();
  const fontes = opts.fontes || FONTES_COLETA, baixar = opts.baixar || baixarPagina, agora = agoraD.toISOString();
  const conhecidas = new Set<string>(); const ids = new Set<string>();
  for (const p of [...opts.existentes, ...getAllBindingPrecedents()]) { const k = chaveDoPrecedente(p as any); if (k) conhecidas.add(k); if ((p as any).id) ids.add(String((p as any).id)); }
  const resumo: ResumoFonte[] = []; const novos: any[] = []; let feitas = 0;
  for (const f of fontes) {
    opts.andamento?.(`Lendo ${f.rotulo}…`, feitas, fontes.length);
    const r: ResumoFonte = { id: f.id, rotulo: f.rotulo, ok: false, lidos: 0, naoFirmes: 0, foraJanela: 0, candidatos: 0, novos: 0, jaExistiam: 0 };
    try {
      const html = opts.htmlPorFonte?.[f.id] ?? await baixar(f.url);
      const itens = extrairItens(html, f);
      if (!itens.length) throw new Error("a página não trouxe nenhum item reconhecível (o site pode ter mudado ou bloqueado o acesso)");
      r.lidos = itens.length;
      const esc = escolherItens(itens, anoAtual); r.naoFirmes = esc.naoFirmes; r.foraJanela = esc.foraJanela; r.candidatos = esc.escolhidos.length;
      const daFonte: any[] = [];
      for (const i of esc.escolhidos) {
        const p = paraPrecedente(i, f, agora); const k = chaveDoPrecedente(p as any);
        if ((k && conhecidas.has(k)) || ids.has(p.id)) { r.jaExistiam++; continue; }
        if (k) conhecidas.add(k); ids.add(p.id); daFonte.push(p);
      }
      r.novos = daFonte.length; r.ok = true;
      if (daFonte.length && !opts.simular && opts.gravar) await opts.gravar(daFonte);
      novos.push(...daFonte);
    } catch (e: any) { r.erro = String(e?.message || e).slice(0, 240); }
    resumo.push(r); feitas++;
  }
  opts.andamento?.("Concluído", fontes.length, fontes.length);
  return { anos: [anoAtual - 2, anoAtual - 1, anoAtual], fontes: resumo, novos, totalNovos: novos.length, totalJaExistiam: resumo.reduce((a, x) => a + x.jaExistiam, 0), simulado: !!opts.simular };
}
