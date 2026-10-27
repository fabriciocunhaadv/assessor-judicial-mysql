// OUTRAS LEIS (estaduais, municipais e demais normas que o Planalto não tem): o Super Admin envia o texto (HTML, texto ou PDF já convertido) e o sistema passa a conferir os artigos
// citados nas minutas contra essa cópia, igual faz com as leis federais. Base única, compartilhada por todos os gabinetes. Guardado compactado na tabela docs, pasta "legislacao_outras".
import express from "express";
import { gzipSync, gunzipSync } from "zlib";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { artigosAntes, LEIS, importarArquivoLei, processarHtmlLei } from "./fontesOficiais";
import { htmlParaLinhas, decodificarPagina, trechoDoArtigo, ConsultaOutrasLeis } from "../src/utils/legislacaoPlanalto";

const COL = "legislacao_outras";
export type Esfera = "estadual" | "municipal" | "federal" | "outra";
export interface OutraLei { id: string; esfera: Esfera; ente: string; tipo: string; numero: string; ano: number; titulo: string; salvoEm: number; artigos: number; gz?: string }

const txt = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
const ESFERAS: Esfera[] = ["estadual", "municipal", "federal", "outra"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const rotuloDaLei = (l: Pick<OutraLei, "esfera" | "tipo" | "numero" | "ano" | "ente">) => `${l.tipo ? l.tipo.charAt(0).toUpperCase() + l.tipo.slice(1) : "Lei"}${l.esfera === "estadual" ? " Estadual" : l.esfera === "municipal" ? " Municipal" : ""} nº ${l.numero}/${l.ano}${l.ente ? ` (${l.ente})` : ""}`;

/** PDF convertido no navegador vem em parágrafos corridos (vários artigos na mesma linha, com marcas de negrito e "[Página N de M]"). A consulta e a contagem só enxergam artigo
 *  que COMEÇA a linha; aqui cada "Art. N" e cada TÍTULO/CAPÍTULO/SEÇÃO volta a abrir a sua linha. "Art." só abre linha depois de ponto final, ponto e vírgula, dois pontos, fecha-parênteses
 *  ou palavra em maiúsculas (nunca em "...nos termos do Art. 14 desta Lei"). Texto que já está uma linha por artigo não muda. */
export function separarDispositivos(linhas: string[]): string[] {
  const out: string[] = [];
  for (const bruta of linhas) {
    if (/^\[P[áa]gina\s+\d+\s+de\s+\d+\]$/i.test(bruta.trim())) continue;
    let l = bruta.replace(/<\/?u>/gi, "").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    if (!l) continue;
    l = l.replace(/((?:[.;:!?)\]"”]|\b[A-ZÀ-Ú]{4,})\s+)(?=Art\.?\s*\d{1,4}\s*[º°o]?(?:\s*-\s*[A-Z])?\s*(?:[.,\-–—]|\s)\s*(?:[A-ZÀ-Ú(§]|\d|Revogad))/g, "$1\n");
    l = l.replace(/([.;:!?)\]"”]\s+|\b[A-ZÀ-Ú]{4,}\s+)(?=(?:T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|LIVRO)\s+(?:[IVXLCDM]+|\d+|[ÚU]NICO)\b)/g, "$1\n");
    for (const parte of l.split("\n")) { const t = parte.trim(); if (t) out.push(t); }
  }
  return out;
}

/** Texto enviado → linhas. HTML (ou arquivo em UTF-16/windows-1252) passa pela leitura do Planalto; texto puro vira uma linha por parágrafo. */
export function linhasDoEnvio(buf: Buffer, formato: string): string[] {
  const zeros = Array.from(buf.subarray(0, 600)).filter((x) => x === 0).length;
  const utf16 = buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff) || (buf.length >= 20 && zeros / Math.min(buf.length, 600) > 0.25));
  let texto: string;
  if (formato === "texto") texto = buf.toString("utf-8");
  else if (utf16) texto = decodificarPagina(buf);
  else { try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = decodificarPagina(buf); } }      // UTF-8 válido primeiro; senão a leitura da página (windows-1252 etc.)
  if (formato === "texto" || !/<(p|div|br|html|body|table)\b/i.test(texto)) return separarDispositivos(texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean));
  return htmlParaLinhas(texto);
}
const contarArtigos = (linhas: string[]) => linhas.filter((l) => /^Art\.?\s*\d/i.test(l)).length;

/** Sugere os dados da lei pelo começo do texto ("LEI Nº 21.792, DE 5 DE JULHO DE 2023", "ESTADO DE GOIÁS"...). O Super Admin confere antes de salvar. */
export function sugerirDados(linhas: string[]): { esfera: Esfera; ente: string; tipo: string; numero: string; ano: string } {
  const ini = linhas.slice(0, 40).join("\n");
  const m = /\b(LEI\s+COMPLEMENTAR|DECRETO[\s-]+LEI|LEI|DECRETO|RESOLU[ÇC][ÃA]O|PORTARIA|PROVIMENTO|EMENDA\s+CONSTITUCIONAL)\s+(?:ESTADUAL\s+|MUNICIPAL\s+|FEDERAL\s+)?(?:N[º°o.]{0,2}\s*)?(\d{1,2}\.\d{3}|\d{1,6})\s*(?:\/|,|-)?\s*(?:DE\s+(?:\d{1,2}[º°]?\s+DE\s+)?[A-ZÇÃ]+\s+DE\s+)?(\d{4})?/i.exec(ini);
  const uf = /ESTADO\s+D[EO]\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,30})/i.exec(ini)?.[1]?.trim(), mun = /MUNIC[ÍI]PIO\s+D[EO]\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,40})/i.exec(ini)?.[1]?.trim();
  const bonito = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).map((w) => (/^(de|do|da|dos|das)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  const esfera: Esfera = mun || /MUNICIPAL/i.test(m?.[0] || "") ? "municipal" : uf || /ESTADUAL/i.test(m?.[0] || "") ? "estadual" : "outra";
  return { esfera, ente: bonito(mun || uf || ""), tipo: (m?.[1] || "lei").toLowerCase().replace(/\s+/g, " ").replace("decreto lei", "decreto-lei"), numero: m?.[2] || "", ano: m?.[3] || "" };
}

const slug = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
export const idDaLei = (l: { esfera: string; ente: string; tipo: string; numero: string; ano: number }) => `${l.esfera}_${slug(l.ente) || "x"}_${slug(l.tipo)}_${l.numero.replace(/\D/g, "")}_${l.ano}`.slice(0, 190);

let cache: { ate: number; itens: OutraLei[] } | null = null;
async function carregar(): Promise<OutraLei[]> {
  if (cache && cache.ate > Date.now()) return cache.itens;
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? LIMIT 500", [COL]);
  const itens = rows.map((r) => { try { return JSON.parse(r.data) as OutraLei; } catch { return null; } }).filter(Boolean) as OutraLei[];
  cache = { ate: Date.now() + 60_000, itens };
  return itens;
}
/** A lei enviada é uma das leis federais da lista do Planalto (ex.: DPVAT, Lei 14.905/2024)? Então o lugar certo dela é a lista do Planalto, onde também vale como cópia de reserva. */
export const leiDoCatalogo = (l: { esfera: string; tipo: string; numero: string; ano: number }) => (l.esfera === "estadual" || l.esfera === "municipal") ? null : (LEIS.find((c) => c.aliases.slice(0, 6).some((re) => re.test(`${l.tipo === "lei" ? "Lei" : l.tipo} nº ${l.numero}/${l.ano}`))) || null);
export async function listarOutrasLeis(): Promise<any[]> { return (await carregar()).map(({ gz, ...r }) => ({ ...r, noCatalogo: leiDoCatalogo(r) ? { id: leiDoCatalogo(r)!.id, nome: leiDoCatalogo(r)!.nome } : null })).sort((a, b) => b.salvoEm - a.salvoEm); }
export async function gravarOutraLei(l: OutraLei): Promise<void> { await garantirDocs(); await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL, l.id, JSON.stringify(l), Date.now()]); cache = null; }
export async function apagarOutraLei(id: string): Promise<void> { await garantirDocs(); await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL, id]); cache = null; }

// ---------- consulta na hora da minuta ----------
const padraoNumero = (numero: string) => numero.replace(/\D/g, "").replace(/(\d)(?=(\d{3})+$)/, "$1\\.?").replace(/^(\d+)$/, "$1");
const referencias = (l: OutraLei) => {
  const dig = l.numero.replace(/\D/g, ""), num = dig.length > 3 ? `${dig.slice(0, -3)}\\.?${dig.slice(-3)}` : dig;
  const ano2 = String(l.ano).slice(-2);
  return new RegExp(`(?<![\\d.])${num}\\s*(?:\\/\\s*(?:${l.ano}|${ano2})|-\\s*${l.ano}|,\\s*de\\s+(?:\\d{1,2}[º°]?\\s+de\\s+)?[a-zç]+\\s+de\\s+${l.ano})(?!\\d)`, "gi");
};
const ARTIGO_APOS = /^\s*[,;(]?\s*(?:c\/c\s*)?(?:em\s+seu\s+|no\s+|nos\s+)?art(?:igo)?s?\.?\s*(\d{1,4}(?:\s*-\s*[A-Z])?)/i;
/** Diz se a menção é de lei estadual ou municipal olhando só a mesma oração (até a vírgula/ponto): "Lei Estadual nº 123/2020", "Lei 123/2020 do Município de X". */
const esferaDoContexto = (t: string, ini: number, fim: number): Esfera | null => {
  const antes = t.slice(Math.max(0, ini - 40), ini).split(/[,;.\n]/).pop() || "", depois = (t.slice(fim, fim + 60).split(/[,;.\n]/)[0]) || "";
  const j = semAcento(`${antes} ${depois}`).toLowerCase();
  return /estadual|do estado/.test(j) ? "estadual" : /municipal|do municipio/.test(j) ? "municipal" : null;
};

export async function consultarOutrasLeis(textos: string[], maxArtigos = 10): Promise<ConsultaOutrasLeis | null> {
  const leis = await carregar();
  if (!leis.length) return null;
  const todo = textos.map((t) => String(t || "")).join("\n");
  const usados: Array<{ lei: OutraLei; artigo: string }> = [], vistos = new Set<string>(), cobertas: OutraLei[] = [];
  for (const lei of leis) {
    const re = referencias(lei); let m: RegExpExecArray | null;
    while ((m = re.exec(todo))) {
      const ini = m.index, fim = ini + m[0].length, ctx = esferaDoContexto(todo, ini, fim);
      if (ctx && lei.esfera !== "outra" && lei.esfera !== ctx && lei.esfera !== "federal") continue;      // "Lei Municipal 123/2020" não é a Lei Estadual 123/2020
      if (!cobertas.includes(lei)) cobertas.push(lei);
      const nums = [...artigosAntes(todo, ini)];
      const a = ARTIGO_APOS.exec(todo.slice(fim, fim + 60)); if (a) nums.push(a[1].replace(/\s+/g, ""));
      for (const n of nums) { const k = `${lei.id}:${n}`; if (!vistos.has(k) && usados.length < maxArtigos) { vistos.add(k); usados.push({ lei, artigo: n.toUpperCase() }); } }
    }
  }
  if (!cobertas.length) return null;
  const linhas: string[] = [], conferidos: string[] = [], naoAchados: string[] = [], cache = new Map<string, string[]>();
  for (const { lei, artigo } of usados) {
    if (!cache.has(lei.id)) cache.set(lei.id, lei.gz ? gunzipSync(Buffer.from(lei.gz, "base64")).toString("utf-8").split("\n") : []);
    const tr = trechoDoArtigo(cache.get(lei.id)!, artigo);
    if (!tr) { naoAchados.push(`${rotuloDaLei(lei)}, art. ${artigo}`); continue; }
    conferidos.push(`${rotuloDaLei(lei)}, art. ${artigo}${tr.revogado ? " (REVOGADO)" : ""} (base do gabinete)`);
    linhas.push(`• ${rotuloDaLei(lei)} — ${tr.revogado ? "ARTIGO REVOGADO (não fundamentar nele) — " : ""}\n${tr.texto}`);
  }
  const datas = cobertas.map((l) => `${rotuloDaLei(l)}: cópia enviada em ${new Date(l.salvoEm).toLocaleDateString("pt-BR")}`).join("; ");
  const bloco = `\n\n[LEGISLAÇÃO ESTADUAL/MUNICIPAL E OUTRAS NORMAS CONSULTADAS NA BASE DO GABINETE (textos enviados pelo Super Administrador)]:\n${linhas.join("\n\n")}` +
    (naoAchados.length ? `\n\nNão localizei no texto da base: ${naoAchados.join("; ")}. Confira se o número do artigo e a norma citados estão corretos.` : "") +
    `\n\nDIRETRIZ: ao citar esses dispositivos, confira número, caput e parágrafos com o texto acima; se a citação do rascunho divergir, corrija. Estes textos são cópias enviadas pelo gabinete (${datas}) e podem estar desatualizados: confirme a vigência antes de afirmar que a norma está em vigor.`;
  return {
    bloco, conferidos, naoAchados,
    cobre: (local: string) => { const l = local.replace(/\./g, ""); return cobertas.some((c) => { const n = c.numero.replace(/\D/g, ""); return l.includes(n) && new RegExp(`(?:${c.ano}|\\b${String(c.ano).slice(-2)}\\b)`).test(l); }); },
  };
}

// ---------- rotas (só Super Admin) ----------
export const outrasLeisRouter = express.Router();
const soSuper = (req: any, res: express.Response): boolean => { if (!req.usuarioSessao?.superAdmin) { res.status(403).json({ erro: "somente o super administrador" }); return false; } return true; };
const corpoBruto = express.raw({ type: () => true, limit: "30mb" });

outrasLeisRouter.get("/", async (req, res) => { if (!soSuper(req, res)) return; try { res.json({ leis: await listarOutrasLeis() }); } catch { res.status(500).json({ erro: "não consegui ler a lista" }); } });
/** Lê o arquivo e devolve a sugestão dos dados (esfera, ente, tipo, número, ano) e quantos artigos achou. Não grava nada. Cabeçalho x-formato: "texto" quando o navegador já converteu o PDF. */
outrasLeisRouter.post("/analisar", corpoBruto, (req: any, res) => {
  if (!soSuper(req, res)) return;
  if (!Buffer.isBuffer(req.body) || req.body.length < 100) return void res.status(400).json({ erro: "arquivo vazio ou pequeno demais" });
  const linhas = linhasDoEnvio(req.body, String(req.headers["x-formato"] || ""));
  res.json({ sugestao: sugerirDados(linhas), artigos: contarArtigos(linhas), linhas: linhas.length, amostra: linhas.slice(0, 4).join(" | ").slice(0, 300) });
});
/** Grava a lei. Dados pelos parâmetros (esfera, ente, tipo, numero, ano, titulo); o corpo é o arquivo. */
outrasLeisRouter.post("/", corpoBruto, async (req: any, res) => {
  if (!soSuper(req, res)) return;
  try {
    const q = req.query || {}, esfera = ESFERAS.includes(q.esfera) ? (q.esfera as Esfera) : null, numero = txt(q.numero, 20).replace(/[^\d.]/g, ""), ano = Number(q.ano), tipo = txt(q.tipo, 40).toLowerCase() || "lei", ente = txt(q.ente, 80);
    if (!esfera || !numero || !(ano >= 1900 && ano <= 2100)) return void res.status(400).json({ erro: "informe a esfera, o número e o ano da lei" });
    if ((esfera === "estadual" || esfera === "municipal") && !ente) return void res.status(400).json({ erro: esfera === "estadual" ? "informe o estado (ex.: Goiás)" : "informe o município (ex.: Goiânia)" });
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) return void res.status(400).json({ erro: "arquivo vazio ou pequeno demais" });
    // lei federal que já está na lista do Planalto: vai para lá (mesma leitura, cópia de reserva e contagem "N de 29 prontas")
    const cat = leiDoCatalogo({ esfera, tipo, numero, ano });
    if (cat && String(req.headers["x-formato"] || "") !== "texto") {
      const r = await importarArquivoLei(`${cat.url.split("/").pop()}`, req.body, cat.id);
      if (!r.erro) return void res.json({ redirecionada: { id: cat.id, nome: cat.nome, artigos: r.total } });
    }
    const linhas = linhasDoEnvio(req.body, String(req.headers["x-formato"] || ""));
    const artigos = contarArtigos(linhas);
    if (artigos < 1) return void res.status(400).json({ erro: "não reconheci nenhum artigo no arquivo (linhas começando com “Art. 1º”). Confira se é o texto da lei." });
    const gz = gzipSync(Buffer.from(linhas.join("\n"), "utf-8")).toString("base64");
    if (gz.length > 6_000_000) return void res.status(413).json({ erro: "texto grande demais mesmo compactado" });
    const lei: OutraLei = { id: "", esfera, ente, tipo, numero, ano, titulo: txt(q.titulo, 200), salvoEm: Date.now(), artigos, gz };
    lei.id = idDaLei(lei);
    await gravarOutraLei(lei);
    const { gz: _g, ...resumo } = lei;
    res.json({ lei: resumo });
  } catch (e: any) { res.status(500).json({ erro: e?.message || "falha ao gravar" }); }
});
/** Move uma lei já enviada aqui para a lista do Planalto (quando ela é uma das leis federais da lista). */
outrasLeisRouter.post("/:id/promover", async (req: any, res) => {
  if (!soSuper(req, res)) return;
  try {
    const lei = (await carregar()).find((l) => l.id === String(req.params.id));
    if (!lei) return void res.status(404).json({ erro: "lei não encontrada" });
    const cat = leiDoCatalogo(lei);
    if (!cat) return void res.status(400).json({ erro: "esta lei não está na lista do Planalto" });
    const linhas = lei.gz ? gunzipSync(Buffer.from(lei.gz, "base64")).toString("utf-8").split("\n") : [];
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const resumo = await processarHtmlLei(cat, `<html><body>${linhas.map((l) => `<p>${esc(l)}</p>`).join("")}</body></html>`);
    await apagarOutraLei(lei.id);
    res.json({ ok: true, lei: resumo });
  } catch (e: any) { res.status(400).json({ erro: e?.message || "não consegui mover" }); }
});
outrasLeisRouter.delete("/:id", async (req: any, res) => { if (!soSuper(req, res)) return; try { await apagarOutraLei(String(req.params.id)); res.json({ ok: true }); } catch { res.status(500).json({ erro: "não consegui excluir" }); } });
