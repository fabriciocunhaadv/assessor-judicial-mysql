// COLETOR DE LEIS E DECRETOS ESTADUAIS DE GOIÁS (servidor). Fontes, nesta ordem:
//  1) o link informado na fonte (Legisla Goiás ou sites oficiais de Goiás);
//  2) site da Secretaria da Economia de Goiás (páginas fixas pelo número; só leis e leis complementares);
//  3) Legisla Goiás (Casa Civil): a API de busca acha o código do ato pelo número e ano, e o PDF do ato sai pelo código.
// Só aceita o texto se o cabeçalho for MESMO do ato pedido (tipo, número e ano). Sem rede nos testes: `baixarFn` e `lerPdf` são injetáveis.
import { htmlParaLinhas, decodificar } from "./fontesOficiais";
import { federalConhecida } from "./conhecimentoFontes";

export const HOST_ECONOMIA_GO = "appasp.economia.go.gov.br";
const BASE = `https://${HOST_ECONOMIA_GO}/legislacao/arquivos/`;
const API_LEGISLA = "https://legisla.casacivil.go.gov.br/api/v2/pesquisa/legislacoes";
const BLOQUEIO = /acesso negado|requisi[çc][ãa]o foi bloqueada|access denied|request blocked|captcha|forbidden|just a moment/i;

export interface AlvoEstadual { tipo: string; numero: string; ano: number; ente?: string; esfera?: string; link?: string }
export interface ResultadoColeta { ok: boolean; buf?: Buffer; url?: string; formato?: string; detalhes: string[] }
type BaixarFn = (url: string) => Promise<{ status: number; buf: Buffer; contentType: string; finalUrl?: string }>;
type LerPdfFn = (b: Buffer) => Promise<string>;

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
const semZeros = (s: string) => digitos(s).replace(/^0+/, "") || "0";
const tipoDe = (f: AlvoEstadual) => String(f.tipo).toLowerCase();
const ROTULO_TIPO: Record<string, string> = { "lei": "LEI", "lei complementar": "LEI COMPLEMENTAR", "decreto": "DECRETO", "emenda constitucional": "EMENDA CONSTITUCIONAL" };

/** Elegível ao coletor de Goiás: lei ou lei complementar (esfera estadual de Goiás ou ainda a confirmar), decreto ou emenda constitucional (só se já for estadual de Goiás), com número e ano. */
export const elegivelGoias = (f: AlvoEstadual): boolean => {
  const t = tipoDe(f), esfera = String(f.esfera || "indefinida");
  const tipoOk = ["lei", "lei complementar"].includes(t) ? ["estadual", "indefinida"].includes(esfera) : ["decreto", "emenda constitucional"].includes(t) ? esfera === "estadual" : false;
  return tipoOk && (esfera !== "estadual" || !f.ente || /goi[aá]s/i.test(f.ente)) && digitos(f.numero).length >= 1 && Number(f.ano) >= 1900
    && !federalConhecida(f.tipo, f.numero, f.ano);      // as leis federais já conhecidas não são procuradas em Goiás
};

/** Endereços prováveis da lei no site da Economia (a pasta varia entre "Leis"/"leis" e o número da complementar vem com zeros à esquerda). */
export function candidatosEstaduais(f: AlvoEstadual): string[] {
  const n = semZeros(f.numero);
  if (tipoDe(f) === "lei complementar") { const p4 = n.padStart(4, "0"); return [`${BASE}Leis_Complementares/LC_${p4}.htm`, `${BASE}Leis_Complementares/LC_${n}.htm`, `${BASE}leis_complementares/LC_${p4}.htm`]; }
  if (tipoDe(f) === "lei") return [`${BASE}Leis/L_${n}.htm`, `${BASE}leis/L_${n}.htm`];
  return [];      // o site da Economia só tem leis
}

/** O cabeçalho diz "LEI Nº 17.039, DE 22 DE JUNHO DE 2010" (ou LEI COMPLEMENTAR / DECRETO / EMENDA CONSTITUCIONAL)? Confere tipo, número e ano e exige o "Art. 1" (decreto: só o cabeçalho). */
export function conferirLeiGoias(linhas: string[], f: AlvoEstadual): { ok: boolean; motivo?: string } {
  const topo = linhas.slice(0, 40).join(" ");
  if (BLOQUEIO.test(topo) && linhas.length < 40) return { ok: false, motivo: "página de bloqueio" };
  const t = tipoDe(f), rotulo = ROTULO_TIPO[t] || "LEI";
  const nome = t === "lei" ? String.raw`LEI\s*(?:ORDIN\S{0,3}RIA\s*)?` : rotulo.replace(/ /g, String.raw`\s+`) + String.raw`\s*`;
  const rx = new RegExp(String.raw`\b${nome}(?:N[^\d\s,]{0,3})?\s*([\d.]+)\s*,?\s*DE\s+[^,]*?(\d{4})`, "i");
  const m = rx.exec(topo);
  if (!m) return { ok: false, motivo: `não achei o cabeçalho “${rotulo} Nº …, DE … DE ano” na página` };
  if (semZeros(m[1]) !== semZeros(f.numero)) return { ok: false, motivo: `a página é do ato ${m[1]}, não do ${f.numero}` };
  if (Number(m[2]) !== Number(f.ano)) return { ok: false, motivo: `a página é de ${m[2]}, não de ${f.ano}` };
  if (t !== "decreto" && !linhas.some((l) => /^Art(?:igo|\.)?\s*(?:1|[úu]nico)\b/i.test(l) || /^Art\.?\s*1\s*[º°o.]?/i.test(l))) return { ok: false, motivo: "a página não traz o “Art. 1º”" };
  return { ok: true };
}

/** Sites oficiais de Goiás aceitos num link informado à mão (o servidor só baixa daqui). */
const HOSTS_LINK = ["legisla.casacivil.go.gov.br", "appasp.economia.go.gov.br", "www.economia.go.gov.br", "economia.go.gov.br", "goias.gov.br", "www.goias.gov.br"];
const hostDoLink = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password && HOSTS_LINK.includes(x.hostname) ? x : null; } catch { return null; } };
/** Endereços a partir do link da fonte: no Legisla Goiás o PDF do ato sai pelo código interno (…/pesquisa_legislacao/<código>/…). */
export function candidatosPorLink(link?: string): string[] {
  const x = link ? hostDoLink(link) : null; if (!x) return [];
  const id = /\/pesquisa_legislacao\/(\d+)/.exec(x.pathname)?.[1];
  if (x.hostname === "legisla.casacivil.go.gov.br" && id) return [`${API_LEGISLA}/${id}/pdf`, x.toString()];
  return [x.toString()];
}

/** Texto de um PDF (pdfjs): uma linha por quebra do PDF, para o "Art. 1º" ficar no começo da linha. */
export async function pdfParaTexto(buf: Buffer): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/", disableFontFace: true }).promise;
  let t = "";
  for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); t += (c.items as any[]).map((x) => x.str + (x.hasEOL ? "\n" : " ")).join("") + "\n"; }
  return t;
}
const ehPdf = (b: Buffer) => b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-";
const emLinhas = (texto: string) => texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
const curto = (u: string) => u.replace(BASE, "…/").replace(API_LEGISLA, "Legisla/api");

/** Acha, na busca do Legisla Goiás, os códigos dos atos com este número e ano (os do tipo pedido primeiro). */
export async function buscarCodigosLegisla(f: AlvoEstadual, baixarFn: BaixarFn, detalhes: string[]): Promise<number[]> {
  const url = `${API_LEGISLA}?numero=${semZeros(f.numero)}&ano=${Number(f.ano)}`;
  try {
    const r = await baixarFn(url);
    if (r.status !== 200) { detalhes.push(`Legisla busca → HTTP ${r.status}`); return []; }
    let j: any; try { j = JSON.parse(r.buf.toString("utf-8")); } catch { detalhes.push("Legisla busca → resposta não é JSON"); return []; }
    const lista: any[] = Array.isArray(j?.resultados) ? j.resultados : Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
    const iguais = lista.filter((x) => x && semZeros(String(x.numero ?? "")) === semZeros(f.numero) && Number(x.ano) === Number(f.ano) && Number.isFinite(Number(x.id)));
    if (!iguais.length) { detalhes.push(`Legisla busca → nenhum ato ${f.numero}/${f.ano} (${j?.total_resultados ?? lista.length} resultado(s))`); return []; }
    const t = tipoDe(f), casa = (x: any) => { const tx = JSON.stringify(x?.tipo_legislacao ?? x?.tipo ?? ""); return t === "lei complementar" ? /complementar/i.test(tx) : t === "lei" ? !/complementar|decreto|emenda|resolu|portaria/i.test(tx) : t === "decreto" ? /decreto/i.test(tx) : /emenda/i.test(tx); };
    return [...iguais.filter(casa), ...iguais.filter((x) => !casa(x))].map((x) => Number(x.id)).slice(0, 3);
  } catch (e: any) { detalhes.push(`Legisla busca → ${e?.name === "AbortError" ? "tempo esgotado" : String(e?.message || e).slice(0, 90)}`); return []; }
}

export async function coletarLeiGoias(f: AlvoEstadual, baixarFn: BaixarFn, lerPdf: LerPdfFn = pdfParaTexto): Promise<ResultadoColeta> {
  const detalhes: string[] = [];
  const tentarPdfOuPagina = async (url: string, rotulo: string): Promise<ResultadoColeta | null> => {
    try {
      const r = await baixarFn(url);
      if (r.status !== 200) { detalhes.push(`${rotulo} → HTTP ${r.status}`); return null; }
      if (ehPdf(r.buf)) {
        const texto = await lerPdf(r.buf), c = conferirLeiGoias(emLinhas(texto), f);
        if (c.ok) return { ok: true, buf: Buffer.from(texto, "utf-8"), url, formato: "texto", detalhes };
        detalhes.push(`${rotulo} (PDF) → ${c.motivo}`); return null;
      }
      const linhas = htmlParaLinhas(decodificar(r.buf, r.contentType)), c = conferirLeiGoias(linhas, f);
      if (c.ok) return { ok: true, buf: r.buf, url, detalhes };
      detalhes.push(`${rotulo} → ${c.motivo}`); return null;
    } catch (e: any) { detalhes.push(`${rotulo} → ${e?.name === "AbortError" ? "tempo esgotado" : String(e?.message || e).slice(0, 90)}`); return null; }
  };
  // 1º o link que o Super Admin informou (se houver)
  for (const url of candidatosPorLink(f.link)) { const ok = await tentarPdfOuPagina(url, "link"); if (ok) return ok; }
  // 2º o site da Economia (páginas fixas)
  for (const url of candidatosEstaduais(f)) { const ok = await tentarPdfOuPagina(url, curto(url)); if (ok) return ok; }
  // 3º o Legisla Goiás: a busca acha o código; o PDF sai pelo código
  for (const id of await buscarCodigosLegisla(f, baixarFn, detalhes)) { const ok = await tentarPdfOuPagina(`${API_LEGISLA}/${id}/pdf`, `Legisla ${id}`); if (ok) return ok; }
  return { ok: false, detalhes };
}
