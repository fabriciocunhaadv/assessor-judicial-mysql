// Impressão, PDF, Word e "copiar" da minuta: o mesmo arrumo que a tela faz (títulos ###, citações >, negrito) e o cabeçalho do ato como a minuta o traz.
// Antes, esses caminhos jogavam o texto cru ("### 2. DO EXAME…", "> Art. 98…") e o cabeçalho "JUIZADO ESPECIAL CÍVEL" era um texto fixo, igual para qualquer unidade.
import { organizarTextoDaMinuta, SecaoDaMinuta } from "./organizarTextoDaMinuta";

export type BlocoMinuta = { tipo: "titulo" | "citacao" | "paragrafo"; texto: string };

const limpaLinhas = (t: any): string[] => String(t ?? "").replace(/\r\n/g, "\n").split(/\n|<br\s*\/?>/i).map((l) => l.replace(/\*\*/g, "").trim()).filter(Boolean);
const maiuscula = (s: string) => s.toUpperCase();

/** Linhas do cabeçalho do ato. Usa o cabeçalho da própria minuta; sem ele, monta com unidade/vara/comarca. Nunca inventa "Juizado". */
export function cabecalhoDaMinuta(m: { header?: string; judicialUnit?: string; vara?: string; comarca?: string }): string[] {
  const doHeader = limpaLinhas(m?.header);
  if (doHeader.length) return doHeader.map(maiuscula);
  const linhas = ["PODER JUDICIÁRIO DO ESTADO DE GOIÁS", "TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS"];
  const unidade = [m?.judicialUnit, m?.vara].find((x) => typeof x === "string" && x.trim());
  if (unidade) linhas.push(maiuscula(String(unidade).trim()));
  if (m?.comarca && !(unidade && new RegExp(String(m.comarca).trim(), "i").test(String(unidade)))) linhas.push(maiuscula(`Comarca de ${String(m.comarca).replace(/^comarca de\s+/i, "").trim()}`));
  return linhas;
}

/** Rótulos das partes: Juizado usa Promovente/Promovido; nos demais juízos, Requerente/Requerido. */
export function rotulosDasPartes(m: { header?: string; judicialUnit?: string; vara?: string }): { autor: string; reu: string } {
  const ehJuizado = /juizado/i.test([m?.header, m?.judicialUnit, m?.vara].filter((x) => typeof x === "string").join(" "));
  return ehJuizado ? { autor: "Promovente", reu: "Promovido" } : { autor: "Requerente", reu: "Requerido" };
}

/** Texto da seção (markdown da IA) em blocos prontos para imprimir: títulos, citações (cada linha da citação separada) e parágrafos. */
export function blocosDaSecao(texto: string, secao: SecaoDaMinuta): BlocoMinuta[] {
  const t = organizarTextoDaMinuta(String(texto ?? "").replace(/\\n/g, "\n"), secao);
  const out: BlocoMinuta[] = [];
  for (const bruto of t.split(/\n[ \t]*\n/)) {
    const b = bruto.trim(); if (!b) continue;
    const h = /^#{1,6}\s+([\s\S]+)$/.exec(b);
    if (h) { out.push({ tipo: "titulo", texto: h[1].replace(/\s*\n\s*/g, " ").replace(/\*\*/g, "").trim() }); continue; }
    if (/^>/.test(b)) {
      // "> Art. 321. ... > Parágrafo único. ..." : cada "> " abre uma linha da citação
      for (const l of b.split(/\n|\s+>\s+(?=\S)/)) { const x = l.replace(/^>\s?/, "").trim(); if (x) out.push({ tipo: "citacao", texto: x }); }
      continue;
    }
    out.push({ tipo: "paragrafo", texto: b.replace(/\s*\n\s*/g, " ") });
  }
  return out;
}

const escapa = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const negritoEItalicoEmHtml = (s: string) => escapa(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");

/** HTML de uma seção (relatório, fundamentação ou dispositivo) para impressão e cópia. */
export function htmlDaSecao(texto: string, secao: SecaoDaMinuta): string {
  return blocosDaSecao(texto, secao).map((b) => b.tipo === "titulo" ? `<h3 class="sub">${negritoEItalicoEmHtml(b.texto)}</h3>` : b.tipo === "citacao" ? `<blockquote>${negritoEItalicoEmHtml(b.texto)}</blockquote>` : `<p>${negritoEItalicoEmHtml(b.texto)}</p>`).join("");
}

/** Texto simples (sem marcas de markdown) para o "copiar" sem formatação. */
export function textoSimples(texto: string): string {
  return String(texto ?? "").replace(/\\n/g, "\n").replace(/^[ \t]*#{1,6}[ \t]+/gm, "").replace(/^[ \t]*>[ \t]?/gm, "    ").replace(/\s+>\s+(?=(?:Par[áa]grafo|[IVX]+\s*[-–]|§|Art\.))/g, "\n    ").replace(/\*\*/g, "").replace(/(^|[^*])\*(?!\s)([^*\n]+)\*(?!\*)/g, "$1$2");
}
