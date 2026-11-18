// COLETOR DE LEIS ESTADUAIS DE GOIÁS (servidor): procura no site da Secretaria da Economia de Goiás (páginas fixas, endereço previsível pelo número) o texto das leis
// estaduais que os autos citam e o Studio ainda não tem. Só aceita a página se o cabeçalho for MESMO da lei pedida (número e ano). Sem rede nos testes: `baixarFn` é injetável.
import { htmlParaLinhas, decodificar } from "./fontesOficiais";
import { federalConhecida } from "./conhecimentoFontes";

export const HOST_ECONOMIA_GO = "appasp.economia.go.gov.br";
const BASE = `https://${HOST_ECONOMIA_GO}/legislacao/arquivos/`;
const BLOQUEIO = /acesso negado|requisi[çc][ãa]o foi bloqueada|access denied|request blocked|captcha|forbidden|just a moment/i;

export interface AlvoEstadual { tipo: string; numero: string; ano: number; ente?: string; esfera?: string; link?: string }
export interface ResultadoColeta { ok: boolean; buf?: Buffer; url?: string; formato?: string; detalhes: string[] }
type BaixarFn = (url: string) => Promise<{ status: number; buf: Buffer; contentType: string; finalUrl?: string }>;

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
/** Elegível ao coletor de Goiás: lei ou lei complementar, esfera estadual (de Goiás) ou ainda a confirmar, com número e ano. */
export const elegivelGoias = (f: AlvoEstadual): boolean =>
  ["lei", "lei complementar"].includes(String(f.tipo).toLowerCase()) && ["estadual", "indefinida"].includes(String(f.esfera || "indefinida"))
  && (f.esfera !== "estadual" || !f.ente || /goi[aá]s/i.test(f.ente)) && digitos(f.numero).length >= 1 && Number(f.ano) >= 1900
  && !federalConhecida(f.tipo, f.numero, f.ano);      // as leis federais já conhecidas não são procuradas em Goiás

/** Endereços prováveis da lei no site da Economia (a pasta varia entre "Leis"/"leis" e o número da complementar vem com zeros à esquerda). */
export function candidatosEstaduais(f: AlvoEstadual): string[] {
  const n = digitos(f.numero).replace(/^0+/, "") || "0";
  if (String(f.tipo).toLowerCase() === "lei complementar") {
    const p4 = n.padStart(4, "0");
    return [`${BASE}Leis_Complementares/LC_${p4}.htm`, `${BASE}Leis_Complementares/LC_${n}.htm`, `${BASE}leis_complementares/LC_${p4}.htm`];
  }
  return [`${BASE}Leis/L_${n}.htm`, `${BASE}leis/L_${n}.htm`];
}

/** O cabeçalho da página diz "LEI Nº 17.039, DE 22 DE JUNHO DE 2010"? Confere tipo, número e ano e exige o "Art. 1". */
export function conferirLeiGoias(linhas: string[], f: AlvoEstadual): { ok: boolean; motivo?: string } {
  const topo = linhas.slice(0, 40).join(" ");
  if (BLOQUEIO.test(topo) && linhas.length < 40) return { ok: false, motivo: "página de bloqueio" };
  const comp = String(f.tipo).toLowerCase() === "lei complementar";
  const rx = comp ? /LEI\s+COMPLEMENTAR\s*(?:N[^\d\s,]{0,3})?\s*([\d.]+)\s*,?\s*DE\s+[^,]*?(\d{4})/i : /\bLEI\s*(?:ORDIN\S{0,3}RIA\s*)?(?:N[^\d\s,]{0,3})?\s*([\d.]+)\s*,?\s*DE\s+[^,]*?(\d{4})/i;
  const m = rx.exec(topo);
  if (!m) return { ok: false, motivo: "não achei o cabeçalho “LEI Nº …, DE … DE ano” na página" };
  if (digitos(m[1]).replace(/^0+/, "") !== digitos(f.numero).replace(/^0+/, "")) return { ok: false, motivo: `a página é da lei ${m[1]}, não da ${f.numero}` };
  if (Number(m[2]) !== Number(f.ano)) return { ok: false, motivo: `a página é de ${m[2]}, não de ${f.ano}` };
  if (!linhas.some((l) => /^Art(?:igo|\.)?\s*(?:1|[úu]nico)\b/i.test(l) || /^Art\.?\s*1\s*[º°o.]?/i.test(l))) return { ok: false, motivo: "a página não traz o “Art. 1º”" };
  return { ok: true };
}

/** Sites oficiais de Goiás aceitos num link informado à mão (o servidor só baixa daqui). */
const HOSTS_LINK = ["legisla.casacivil.go.gov.br", "appasp.economia.go.gov.br", "www.economia.go.gov.br", "economia.go.gov.br", "goias.gov.br", "www.goias.gov.br"];
const hostDoLink = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password && HOSTS_LINK.includes(x.hostname) ? x : null; } catch { return null; } };
/** Endereços a partir do link da fonte: no Legisla Goiás o PDF do ato sai pelo código interno (…/pesquisa_legislacao/<código>/…). */
export function candidatosPorLink(link?: string): string[] {
  const x = link ? hostDoLink(link) : null; if (!x) return [];
  const id = /\/pesquisa_legislacao\/(\d+)/.exec(x.pathname)?.[1];
  if (x.hostname === "legisla.casacivil.go.gov.br" && id) return [`https://legisla.casacivil.go.gov.br/api/v2/pesquisa/legislacoes/${id}/pdf`, x.toString()];
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

export async function coletarLeiGoias(f: AlvoEstadual, baixarFn: BaixarFn, lerPdf: (b: Buffer) => Promise<string> = pdfParaTexto): Promise<ResultadoColeta> {
  const detalhes: string[] = [];
  // 1º o link que o Super Admin informou (se houver); o ato é aceito pelo número no texto (PDF) ou pelo cabeçalho (página)
  for (const url of candidatosPorLink(f.link)) {
    try {
      const r = await baixarFn(url);
      if (r.status !== 200) { detalhes.push(`link ${new URL(url).pathname.slice(0, 60)} → HTTP ${r.status}`); continue; }
      if (ehPdf(r.buf)) {
        const texto = await lerPdf(r.buf), linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
        const c = conferirLeiGoias(linhas, f);
        if (c.ok) return { ok: true, buf: Buffer.from(texto, "utf-8"), url, formato: "texto", detalhes };
        detalhes.push(`link (PDF) → ${c.motivo}`); continue;
      }
      const linhas = htmlParaLinhas(decodificar(r.buf, r.contentType)), c = conferirLeiGoias(linhas, f);
      if (c.ok) return { ok: true, buf: r.buf, url, detalhes };
      detalhes.push(`link (página) → ${c.motivo}`);
    } catch (e: any) { detalhes.push(`link → ${e?.name === "AbortError" ? "tempo esgotado" : String(e?.message || e).slice(0, 90)}`); }
  }
  for (const url of candidatosEstaduais(f)) {
    try {
      const r = await baixarFn(url);
      if (r.status !== 200) { detalhes.push(`${url.replace(BASE, "…/")} → HTTP ${r.status}`); continue; }
      const linhas = htmlParaLinhas(decodificar(r.buf, r.contentType));
      const c = conferirLeiGoias(linhas, f);
      if (c.ok) return { ok: true, buf: r.buf, url, detalhes };
      detalhes.push(`${url.replace(BASE, "…/")} → ${c.motivo}`);
    } catch (e: any) { detalhes.push(`${url.replace(BASE, "…/")} → ${e?.name === "AbortError" ? "tempo esgotado" : String(e?.message || e).slice(0, 90)}`); }
  }
  return { ok: false, detalhes };
}
