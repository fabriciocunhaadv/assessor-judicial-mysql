// BASE DE CONHECIMENTO: envia à IA só o que tem a ver com o caso (busca local, sem gastar cota).
// - documentos curtos (modelos e orientações, até CURTO car.) entram inteiros, dentro de um teto próprio;
// - documentos longos (leis, jurisprudência, doutrina) são cortados em trechos e só entram os trechos que combinam com o caso (termos dos autos e do prompt), na ordem original;
// - o conjunto respeita um teto total de caracteres. Módulo puro (não chama IA nem rede).
export interface DocBase { name?: string; extractedText?: string }
export interface SaidaBase { texto: string; enviados: { nome: string; chars: number; parcial: boolean }[]; omitidos: string[]; totalOriginal: number; totalEnviado: number }

const CURTO = 12000, TETO_CURTOS = 50000, TAM_TRECHO = 3000;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PARADA = new Set("para como esta este esse essa pelo pela entre sobre quando onde cujo cuja deve devem sendo foram havia dessa desse desta deste ainda assim porem contra mesmo mesma outro outra todos todas apos antes autos processo parte partes artigo conforme neste nesta disso deles delas".split(" "));

function termos(textos: string[]): Map<string, number> {
  const f = new Map<string, number>();
  for (const t of textos) for (const w of semAcento(String(t || "").slice(0, 400000)).match(/[a-z0-9]{5,}/g) || []) if (!PARADA.has(w)) f.set(w, (f.get(w) || 0) + 1);
  const top = [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400);
  return new Map(top.map(([w, n]) => [w, Math.log(1 + n)]));
}
const pontos = (trecho: string, ctx: Map<string, number>) => { const vistos = new Set<string>(); let p = 0; for (const w of semAcento(trecho).match(/[a-z0-9]{5,}/g) || []) if (ctx.has(w) && !vistos.has(w)) { vistos.add(w); p += ctx.get(w)!; } return p; };

function emTrechos(texto: string): string[] {
  const out: string[] = []; let atual = "";
  for (const par of texto.split(/(?<=\n)/)) { if (atual.length + par.length > TAM_TRECHO && atual) { out.push(atual); atual = ""; } atual += par; if (atual.length > TAM_TRECHO * 2) { out.push(atual.slice(0, TAM_TRECHO * 2)); atual = atual.slice(TAM_TRECHO * 2); } }
  if (atual) out.push(atual);
  return out;
}

export function selecionarBase(docs: DocBase[], contexto: string[], tetoChars = 150000): SaidaBase {
  const lista = (Array.isArray(docs) ? docs : []).map((d) => ({ nome: String(d?.name || "documento").slice(0, 120), texto: typeof d?.extractedText === "string" ? d.extractedText.trim() : "" })).filter((d) => d.texto);
  const totalOriginal = lista.reduce((n, d) => n + d.texto.length, 0);
  if (totalOriginal <= tetoChars) return { texto: lista.map((d) => `\n\n[=== BASE DE CONHECIMENTO INTERNA: ${d.nome} ===]\n${d.texto}\n`).join(""), enviados: lista.map((d) => ({ nome: d.nome, chars: d.texto.length, parcial: false })), omitidos: [], totalOriginal, totalEnviado: totalOriginal };
  const ctx = termos(contexto);
  let orcamento = tetoChars, curtos = 0;
  const escolhido = new Map<number, { de: number; trechos: Map<number, string> }>();
  const enviados: SaidaBase["enviados"] = [], omitidos: string[] = [];
  const longos: { i: number; trechos: { k: number; t: string; p: number }[] }[] = [];
  lista.forEach((d, i) => {
    if (d.texto.length <= CURTO && curtos + d.texto.length <= TETO_CURTOS && orcamento >= d.texto.length) { curtos += d.texto.length; orcamento -= d.texto.length; escolhido.set(i, { de: i, trechos: new Map([[0, d.texto]]) }); return; }
    const bonusNome = pontos(d.nome, ctx) * 3;
    longos.push({ i, trechos: emTrechos(d.texto).map((t, k) => ({ k, t, p: pontos(t, ctx) + (k === 0 ? bonusNome : 0) })) });
  });
  const todos = longos.flatMap((l) => l.trechos.map((t) => ({ i: l.i, ...t }))).filter((t) => t.p > 0).sort((a, b) => b.p / Math.sqrt(b.t.length) - a.p / Math.sqrt(a.t.length));
  for (const t of todos) {
    if (orcamento < t.t.length) continue;
    const e = escolhido.get(t.i) || { de: t.i, trechos: new Map<number, string>() }; e.trechos.set(t.k, t.t); escolhido.set(t.i, e); orcamento -= t.t.length;
  }
  let texto = "";
  lista.forEach((d, i) => {
    const e = escolhido.get(i);
    if (!e) { omitidos.push(d.nome); return; }
    const ks = [...e.trechos.keys()].sort((a, b) => a - b), corpo = ks.map((k) => e.trechos.get(k)!).join("\n[...]\n");
    const parcial = corpo.length < d.texto.length;
    texto += `\n\n[=== BASE DE CONHECIMENTO INTERNA: ${d.nome}${parcial ? " (somente os trechos relacionados ao caso)" : ""} ===]\n${corpo}\n`;
    enviados.push({ nome: d.nome, chars: corpo.length, parcial });
  });
  return { texto, enviados, omitidos, totalOriginal, totalEnviado: texto.length };
}
