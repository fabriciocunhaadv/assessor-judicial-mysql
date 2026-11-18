// COLETOR DE LEIS ESTADUAIS DE GOIÁS (servidor): procura no site da Secretaria da Economia de Goiás (páginas fixas, endereço previsível pelo número) o texto das leis
// estaduais que os autos citam e o Studio ainda não tem. Só aceita a página se o cabeçalho for MESMO da lei pedida (número e ano). Sem rede nos testes: `baixarFn` é injetável.
import { htmlParaLinhas, decodificar } from "./fontesOficiais";

export const HOST_ECONOMIA_GO = "appasp.economia.go.gov.br";
const BASE = `https://${HOST_ECONOMIA_GO}/legislacao/arquivos/`;
const BLOQUEIO = /acesso negado|requisi[çc][ãa]o foi bloqueada|access denied|request blocked|captcha|forbidden|just a moment/i;

export interface AlvoEstadual { tipo: string; numero: string; ano: number; ente?: string; esfera?: string }
export interface ResultadoColeta { ok: boolean; buf?: Buffer; url?: string; detalhes: string[] }
type BaixarFn = (url: string) => Promise<{ status: number; buf: Buffer; contentType: string; finalUrl?: string }>;

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
/** Elegível ao coletor de Goiás: lei ou lei complementar, esfera estadual (de Goiás) ou ainda a confirmar, com número e ano. */
export const elegivelGoias = (f: AlvoEstadual): boolean =>
  ["lei", "lei complementar"].includes(String(f.tipo).toLowerCase()) && ["estadual", "indefinida"].includes(String(f.esfera || "indefinida"))
  && (f.esfera !== "estadual" || !f.ente || /goi[aá]s/i.test(f.ente)) && digitos(f.numero).length >= 1 && Number(f.ano) >= 1900;

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

export async function coletarLeiGoias(f: AlvoEstadual, baixarFn: BaixarFn): Promise<ResultadoColeta> {
  const detalhes: string[] = [];
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
