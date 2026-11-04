// Enunciados do FONAJE (Fórum Nacional dos Juizados Especiais; Cíveis, Criminais e da Fazenda Pública/FONAJEF) em PDF ou página salva.
// O formato é fixo ("ENUNCIADO 10 – texto"), então a leitura é feita por regra, sem IA: não erra o número, não inventa texto e não depende de chave nem de cota.
export interface EnunciadoFonaje { id: string; tribunal: "FONAJE"; type: "enunciado_fonaje"; number: string; title: string; statement: string; sourceUrl: string; tags: string[]; area: string; ramo: string; situacao: "vigente" | "cancelado" | "substituido" }

const RAMOS: Array<{ re: RegExp; chave: string; nome: string; area: string }> = [
  { re: /criminais?|jecrim/i, chave: "criminal", nome: "Criminal", area: "Juizados Especiais Criminais" },
  { re: /fazenda\s+p[úu]blica|fonajef|12\.153/i, chave: "fazenda", nome: "Fazenda Pública", area: "Juizados Especiais da Fazenda Pública" },
  { re: /c[íi]veis|c[íi]vel|jec\b/i, chave: "civel", nome: "Cível", area: "Juizados Especiais Cíveis" },
];
const PARADA = new Set("sobre entre quando contra deste desta desse dessa pelos pelas porém ainda assim ficam fica será serão podem poderá cabível cabe nos nas para com sem uma uns umas dos das que não nem pela pelo como mesmo outra outro outros outras tenha tenham haja houver juizado juizados especial especiais lei".split(" "));
const sa = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function extrairEnunciadosFonaje(texto: string, nomeArquivo = ""): EnunciadoFonaje[] {
  const t = String(texto || "").replace(/\r/g, "").replace(/[ \t ]+/g, " ");
  const marcas = [...t.matchAll(/(?:^|\s)ENUNCIADO\s+(\d{1,3})\s*[–—-]\s*/g)];
  if (marcas.length < 3) return [];
  const ramo = RAMOS.find((r) => r.re.test(sa(nomeArquivo))) || RAMOS.find((r) => r.re.test(sa(t.slice(0, 3000)))) || RAMOS[2];
  const vistos = new Set<string>(), out: EnunciadoFonaje[] = [];
  marcas.forEach((m, i) => {
    const n = parseInt(m[1], 10); if (vistos.has(String(n))) return; vistos.add(String(n));
    const ini = (m.index || 0) + m[0].length, fim = i + 1 < marcas.length ? (marcas[i + 1].index || t.length) : Math.min(t.length, ini + 2500);
    let corpo = t.slice(ini, fim).replace(/\[P[áa]gina[^\]]*\]/gi, " ").replace(/\s+/g, " ").trim();      // marcas de página do leitor de PDF
    corpo = corpo.replace(/\s*(?:Da plataforma|Adobe Acrobat|https?:\/\/\S+|Pesquisar\.\.\.).*$/i, "").trim();      // rodapé/cabeçalho da página impresso junto
    if (corpo.length < 8) return;
    const situacao: EnunciadoFonaje["situacao"] = /^cancelado/i.test(corpo) ? "cancelado" : /^substitu[íi]do/i.test(corpo) ? "substituido" : "vigente";
    const palavras = corpo.toLowerCase().replace(/[^a-zà-ú0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 5 && !PARADA.has(sa(w)));      // com acento: a comparação com o texto dos autos é literal
    const contagem = new Map<string, number>(); palavras.forEach((w) => contagem.set(w, (contagem.get(w) || 0) + 1));
    const tags = [...contagem.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 8).map(([w]) => w);
    out.push({
      id: `fonaje-${ramo.chave}-${n}`, tribunal: "FONAJE", type: "enunciado_fonaje", number: `Enunciado ${n} FONAJE (${ramo.nome})`,
      title: corpo.split(/\s+/).slice(0, 14).join(" ").replace(/[.,;:]+$/, ""), statement: corpo, sourceUrl: "https://www.cnj.jus.br/programas-e-acoes/juizados-especiais/",
      tags: situacao === "vigente" ? tags : [], area: ramo.area, ramo: ramo.nome, situacao,
    });
  });
  return out;
}
