// FONTES OFICIAIS: (1) teste de acesso do servidor aos sites dos tribunais e do Planalto; (2) importação das LEIS do Planalto para o MySQL, com a marca de cada artigo
// (vigente, revogado ou vetado); (3) conferência das citações da minuta contra essa base, para não citar artigo revogado/vetado/inexistente.
// Só o Super Admin dispara teste e importação. Os endereços são fixos (lista abaixo): não há URL digitada pelo usuário.
import express from "express";
import * as he from "he";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";

export const fontesRouter = express.Router();
const COL_LEI = "legislacao", COL_RESUMO = "legislacao_resumo";

export interface LeiConfig { id: string; nome: string; curto: string; url: string; aliases: RegExp[] }
const L = (id: string, nome: string, curto: string, url: string, ...aliases: RegExp[]): LeiConfig => ({ id, nome, curto, url, aliases });
const P = "https://www.planalto.gov.br/ccivil_03/";
export const LEIS: LeiConfig[] = [
  L("cf88", "Constituição Federal de 1988", "CF/88", P + "constituicao/constituicao.htm", /\bCF(?:\/|\s*-\s*)?(?:19)?88\b/i, /\bCRFB\b/, /Constitui[çc][ãa]o Federal/i, /\bCF\b/),
  L("cpc", "Código de Processo Civil (Lei 13.105/2015)", "CPC", P + "_ato2015-2018/2015/lei/l13105.htm", /\bCPC(?!\s*\/?\s*(?:de\s*)?(?:19)?73)\b/, /C[óo]digo de Processo Civil(?!\s+de\s+1973)/i, /Lei\s*(?:n[º°o.]*\s*)?13\.?105\s*\/\s*(?:20)?15/i),
  L("cc", "Código Civil (Lei 10.406/2002)", "CC", P + "2002/l10406compilada.htm", /\bCC\b(?!\/?\s*(?:de\s*)?1916)/, /C[óo]digo Civil(?!\s+de\s+1916)/i, /Lei\s*(?:n[º°o.]*\s*)?10\.?406\s*\/\s*(?:20)?02/i),
  L("cdc", "Código de Defesa do Consumidor (Lei 8.078/1990)", "CDC", P + "leis/l8078compilado.htm", /\bCDC\b/, /C[óo]digo de Defesa do Consumidor/i, /Lei\s*(?:n[º°o.]*\s*)?8\.?078\s*\/\s*(?:19)?90/i),
  L("l9099", "Lei dos Juizados Especiais (Lei 9.099/1995)", "Lei 9.099/95", P + "leis/l9099.htm", /Lei\s*(?:n[º°o.]*\s*)?9\.?099\s*\/\s*(?:19)?95/i, /\bLJE\b/),
  L("l12153", "Juizados da Fazenda Pública (Lei 12.153/2009)", "Lei 12.153/09", P + "_ato2007-2010/2009/lei/l12153.htm", /Lei\s*(?:n[º°o.]*\s*)?12\.?153\s*\/\s*(?:20)?09/i),
  L("l10259", "Juizados Federais (Lei 10.259/2001)", "Lei 10.259/01", P + "leis/leis_2001/l10259.htm", /Lei\s*(?:n[º°o.]*\s*)?10\.?259\s*\/\s*(?:20)?01/i),
  L("cp", "Código Penal (Decreto-Lei 2.848/1940)", "CP", P + "decreto-lei/del2848compilado.htm", /\bCP\b/, /C[óo]digo Penal(?!\s+Militar)/i),
  L("cpp", "Código de Processo Penal (Decreto-Lei 3.689/1941)", "CPP", P + "decreto-lei/del3689compilado.htm", /\bCPP\b/, /C[óo]digo de Processo Penal(?!\s+Militar)/i),
  L("clt", "Consolidação das Leis do Trabalho (Decreto-Lei 5.452/1943)", "CLT", P + "decreto-lei/del5452.htm", /\bCLT\b/, /Consolida[çc][ãa]o das Leis do Trabalho/i),
  L("l8429", "Improbidade Administrativa (Lei 8.429/1992)", "Lei 8.429/92", P + "leis/l8429.htm", /Lei\s*(?:n[º°o.]*\s*)?8\.?429\s*\/\s*(?:19)?92/i, /\bLIA\b/),
  L("l14133", "Licitações e Contratos (Lei 14.133/2021)", "Lei 14.133/21", P + "_ato2019-2022/2021/lei/l14133.htm", /Lei\s*(?:n[º°o.]*\s*)?14\.?133\s*\/\s*(?:20)?21/i),
  L("l6830", "Execução Fiscal (Lei 6.830/1980)", "LEF", P + "leis/l6830.htm", /Lei\s*(?:n[º°o.]*\s*)?6\.?830\s*\/\s*(?:19)?80/i, /\bLEF\b/),
  L("l7347", "Ação Civil Pública (Lei 7.347/1985)", "Lei 7.347/85", P + "leis/l7347orig.htm", /Lei\s*(?:n[º°o.]*\s*)?7\.?347\s*\/\s*(?:19)?85/i),
  L("l11340", "Maria da Penha (Lei 11.340/2006)", "Lei 11.340/06", P + "_ato2004-2006/2006/lei/l11340.htm", /Lei\s*(?:n[º°o.]*\s*)?11\.?340\s*\/\s*(?:20)?06/i),
  L("eca", "Estatuto da Criança e do Adolescente (Lei 8.069/1990)", "ECA", P + "leis/l8069.htm", /\bECA\b/, /Estatuto da Crian[çc]a e do Adolescente/i, /Lei\s*(?:n[º°o.]*\s*)?8\.?069\s*\/\s*(?:19)?90/i),
  L("l8213", "Benefícios da Previdência Social (Lei 8.213/1991)", "Lei 8.213/91", P + "leis/l8213cons.htm", /Lei\s*(?:n[º°o.]*\s*)?8\.?213\s*\/\s*(?:19)?91/i),
  L("l8112", "Servidores Públicos Federais (Lei 8.112/1990)", "Lei 8.112/90", P + "leis/l8112cons.htm", /Lei\s*(?:n[º°o.]*\s*)?8\.?112\s*\/\s*(?:19)?90/i),
  L("l12016", "Mandado de Segurança (Lei 12.016/2009)", "Lei 12.016/09", P + "_ato2007-2010/2009/lei/l12016.htm", /Lei\s*(?:n[º°o.]*\s*)?12\.?016\s*\/\s*(?:20)?09/i),
  L("lindb", "LINDB (Decreto-Lei 4.657/1942)", "LINDB", P + "decreto-lei/del4657compilado.htm", /\bLINDB\b/, /Lei de Introdu[çc][ãa]o [àa]s Normas do Direito Brasileiro/i),
  L("lgpd", "LGPD (Lei 13.709/2018)", "LGPD", P + "_ato2015-2018/2018/lei/l13709.htm", /\bLGPD\b/, /Lei\s*(?:n[º°o.]*\s*)?13\.?709\s*\/\s*(?:20)?18/i),
  L("l8245", "Locações (Lei 8.245/1991)", "Lei 8.245/91", P + "leis/l8245.htm", /Lei\s*(?:n[º°o.]*\s*)?8\.?245\s*\/\s*(?:19)?91/i),
  L("l7357", "Lei do Cheque (Lei 7.357/1985)", "Lei 7.357/85", P + "leis/l7357.htm", /Lei\s*(?:n[º°o.]*\s*)?7\.?357\s*\/\s*(?:19)?85/i),
  L("l6194", "DPVAT (Lei 6.194/1974)", "Lei 6.194/74", P + "leis/l6194.htm", /Lei\s*(?:n[º°o.]*\s*)?6\.?194\s*\/\s*(?:19)?74/i),
];
const CPC_1973 = /\bCPC\s*\/?\s*(?:de\s*)?(?:19)?73\b|C[óo]digo de Processo Civil de 1973|Lei\s*(?:n[º°o.]*\s*)?5\.?869\s*\/\s*(?:19)?73/i;

// ---------- download e leitura ----------
const UA = "Mozilla/5.0 (compatible; AssessorJudicial/1.0; +https://judicial-mysql.assessor.net.br)";
export async function baixar(url: string, timeoutMs = 30000, maxBytes = 25_000_000): Promise<{ status: number; finalUrl: string; contentType: string; buf: Buffer; ms: number }> {
  const t0 = Date.now(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "pt-BR,pt;q=0.9" } });
    const ab = await r.arrayBuffer();
    if (ab.byteLength > maxBytes) throw new Error(`arquivo grande demais (${Math.round(ab.byteLength / 1e6)} MB)`);
    return { status: r.status, finalUrl: r.url, contentType: r.headers.get("content-type") || "", buf: Buffer.from(ab), ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}
/** As páginas do Planalto costumam vir em windows-1252: usa o charset do cabeçalho ou da página. */
export function decodificar(buf: Buffer, contentType = ""): string {
  let cs = /charset=([\w-]+)/i.exec(contentType)?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString("latin1"))?.[1] || "windows-1252";
  cs = cs.toLowerCase();
  try { return new TextDecoder(cs).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); }
}
export function htmlParaLinhas(html: string): string[] {
  const t = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<\/(p|div|tr|li|h[1-6]|table|center|blockquote)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  return he.decode(t).replace(/ /g, " ").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export interface ArtigoLei { t: string; r?: 1; v?: 1; n?: string }
const MARCA_REVOGADO = /\(\s*Revogad[oa]s?\b[^)]*\)?/i, MARCA_VETADO = /\(\s*Vetad[oa]s?\b[^)]*\)?/i;
const CABECALHO = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|DISPOSI[ÇC][ÕO]ES)\b/i;
const chaveArtigo = (n: string, letra?: string) => n.replace(/\./g, "") + (letra ? "-" + letra.toUpperCase() : "");

/** Lê as linhas de uma lei e separa por artigo, marcando revogados e vetados. */
export function extrairArtigos(linhas: string[]): { artigos: Record<string, ArtigoLei>; total: number; revogados: number; vetados: number } {
  const artigos: Record<string, ArtigoLei> = {};
  let atual: string | null = null;
  for (const linha of linhas) {
    // "Arts. 6º a 8º (Revogados)": intervalo revogado
    const plural = /^Arts\.?\s*(\d{1,4}(?:\.\d{3})?)\s*[º°o]?\s*(?:-\s*[A-Z]{1,2}\s*)?(?:a|ao|até)\s*(\d{1,4}(?:\.\d{3})?)/i.exec(linha);
    if (plural && (MARCA_REVOGADO.test(linha) || MARCA_VETADO.test(linha))) {
      const a = parseInt(plural[1].replace(/\./g, ""), 10), b = parseInt(plural[2].replace(/\./g, ""), 10);
      if (b >= a && b - a <= 400) for (let i = a; i <= b; i++) artigos[String(i)] = { t: linha.slice(0, 300), ...(MARCA_VETADO.test(linha) ? { v: 1 } : { r: 1 }), n: (MARCA_REVOGADO.exec(linha) || MARCA_VETADO.exec(linha) || [""])[0].slice(0, 160) };
      atual = null; continue;
    }
    const m = /^Art\.?\s*(\d{1,4}(?:\.\d{3})?)\s*(?:[º°o](?![a-zà-ú])|\.)?\s*(?:-\s*([A-Z]{1,2})\b)?/.exec(linha);
    if (m) {
      const k = chaveArtigo(m[1], m[2]);
      const rev = MARCA_REVOGADO.exec(linha), vet = MARCA_VETADO.exec(linha);
      artigos[k] = { t: linha.slice(0, 4000), ...(rev ? { r: 1 as const } : {}), ...(!rev && vet ? { v: 1 as const } : {}), ...((rev || vet) ? { n: (rev || vet)![0].slice(0, 160) } : {}) };
      atual = k; continue;
    }
    if (CABECALHO.test(linha)) { atual = null; continue; }
    if (atual && artigos[atual].t.length < 4000) artigos[atual].t += "\n" + linha.slice(0, 1500);
  }
  const ks = Object.keys(artigos);
  return { artigos, total: ks.length, revogados: ks.filter((k) => artigos[k].r).length, vetados: ks.filter((k) => artigos[k].v).length };
}

// ---------- armazenamento ----------
interface ResumoLei { id: string; nome: string; url: string; baixadoEm?: number; total?: number; revogados?: number; vetados?: number; maior?: number; erro?: string }
async function salvarDoc(col: string, id: string, data: any) {
  await garantirDocs();
  await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [col, id, JSON.stringify(data), Date.now()]);
}
/** Estado compacto de uma lei: só quais artigos estão revogados/vetados (com a nota curta) e o último número. O texto dos artigos NÃO é guardado (não pesa no banco). */
interface EstadoLei { r: Record<string, string>; v: Record<string, string>; maior: number }
const BLOQUEIO = /acesso negado|requisi[çc][ãa]o foi bloqueada|access denied|request blocked/i;

/** Lê o HTML de uma lei e guarda o estado compacto + o resumo. Usado pelo download e pelo arquivo enviado pelo Super Admin. */
export async function processarHtmlLei(cfg: LeiConfig, texto: string): Promise<ResumoLei> {
  const linhas = htmlParaLinhas(texto);
  if (BLOQUEIO.test(linhas.slice(0, 30).join(" ")) && linhas.length < 40) throw new Error("o Planalto bloqueou o acesso do servidor (página de “Acesso Negado”); salve a página no seu navegador e envie o arquivo");
  const ex = extrairArtigos(linhas);
  if (ex.total < 5) throw new Error(`formato inesperado: só ${ex.total} artigo(s) reconhecido(s); nada foi gravado`);
  const chaves = Object.keys(ex.artigos);
  const maior = Math.max(...chaves.map((k) => parseInt(k, 10)).filter((n) => Number.isFinite(n)));
  const estado: EstadoLei = { r: {}, v: {}, maior };
  for (const k of chaves) { const a = ex.artigos[k]; if (a.r) estado.r[k] = (a.n || "").slice(0, 90); else if (a.v) estado.v[k] = (a.n || "").slice(0, 90); }
  const agora = Date.now();
  await salvarDoc(COL_LEI, cfg.id, { id: cfg.id, baixadoEm: agora, ...estado });
  const resumo: ResumoLei = { id: cfg.id, nome: cfg.nome, url: cfg.url, baixadoEm: agora, total: ex.total, revogados: ex.revogados, vetados: ex.vetados, maior };
  await salvarDoc(COL_RESUMO, cfg.id, resumo);
  cacheLeis.delete(cfg.id);
  return resumo;
}
async function anotarErro(cfg: LeiConfig, e: any): Promise<ResumoLei> {
  // falha não apaga a versão anterior; só anota o erro no resumo
  const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? AND id=?", [COL_RESUMO, cfg.id]).catch(() => [[]] as any);
  const anterior = (rows as any[])[0] ? JSON.parse((rows as any[])[0].data) : {};
  const resumo = { id: cfg.id, nome: cfg.nome, url: cfg.url, ...anterior, erro: String(e?.name === "AbortError" ? "tempo esgotado" : e?.message || e).slice(0, 220) };
  await salvarDoc(COL_RESUMO, cfg.id, resumo);
  return resumo;
}
export async function importarLei(id: string): Promise<ResumoLei> {
  const cfg = LEIS.find((l) => l.id === id);
  if (!cfg) throw Object.assign(new Error("lei desconhecida"), { status: 404 });
  try {
    const r = await baixar(cfg.url);
    if (r.status !== 200) throw new Error(`o Planalto respondeu ${r.status}`);
    return await processarHtmlLei(cfg, decodificar(r.buf, r.contentType));
  } catch (e: any) { return anotarErro(cfg, e); }
}
/** Descobre qual lei é pelo nome do arquivo salvo (ex.: l13105.htm) ou pelo começo do texto. */
export function descobrirLei(nomeArquivo: string, texto: string): LeiConfig | null {
  const base = (nomeArquivo || "").toLowerCase().replace(/\.[a-z]+$/, "");
  for (const l of LEIS) {
    const arq = l.url.split("/").pop()!.toLowerCase().replace(/\.[a-z]+$/, "");
    const n = (x: string) => /(\d{3,5})/.exec(x)?.[1];
    if (base && (base === arq || (n(base) && n(base) === n(arq) && /^(l|del|lei)/.test(base)) || (arq === "constituicao" && /^constitui/.test(base)))) return l;
  }
  const inicio = htmlParaLinhas(texto).slice(0, 25).join(" ");
  return LEIS.find((l) => l.aliases.slice(0, 6).some((re) => /\d{4,}/.test(re.source) && re.test(inicio))) || null;
}
export async function importarArquivoLei(nomeArquivo: string, buf: Buffer, idForcado?: string): Promise<ResumoLei> {
  let texto: string;
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = decodificar(buf); }      // arquivo salvo pelo navegador: UTF-8 válido ou windows-1252
  const cfg = idForcado ? LEIS.find((l) => l.id === idForcado) : descobrirLei(nomeArquivo, texto);
  if (!cfg) throw Object.assign(new Error(`não reconheci qual lei é o arquivo “${nomeArquivo}”. Use o nome original da página (ex.: l13105.htm) ou escolha a lei na lista.`), { status: 400 });
  try { return await processarHtmlLei(cfg, texto); } catch (e: any) { return anotarErro(cfg, e); }
}
export async function listarResumoLeis(): Promise<ResumoLei[]> {
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT id, data FROM docs WHERE col=?", [COL_RESUMO]);
  const mapa = new Map(rows.map((r) => [r.id, JSON.parse(r.data) as ResumoLei]));
  return LEIS.map((l) => mapa.get(l.id) || { id: l.id, nome: l.nome, url: l.url });
}
const cacheLeis = new Map<string, { ate: number; estado: EstadoLei | null }>();
async function estadoDaLei(id: string): Promise<EstadoLei | null> {
  const c = cacheLeis.get(id);
  if (c && c.ate > Date.now()) return c.estado;
  await garantirDocs();
  const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? AND id=?", [COL_LEI, id]);
  let estado: EstadoLei | null = null;
  if (rows[0]) {
    const d = JSON.parse(rows[0].data);
    if (d.r && d.v) estado = { r: d.r, v: d.v, maior: d.maior || 0 };
    else if (d.artigos) { estado = { r: {}, v: {}, maior: 0 }; for (const [k, a] of Object.entries<any>(d.artigos)) { if (a.r) estado.r[k] = a.n || ""; else if (a.v) estado.v[k] = a.n || ""; estado.maior = Math.max(estado.maior, parseInt(k, 10) || 0); } }      // versão antiga, com texto
  }
  cacheLeis.set(id, { ate: Date.now() + 10 * 60_000, estado });
  return estado;
}

// ---------- conferência das citações ----------
export interface AlertaLegislacao { lei: string; artigo: string; tipo: "revogado" | "vetado" | "inexistente" | "cpc1973"; nota?: string }
const alvoDoTexto = (m: RegExpMatchArray | RegExpExecArray) => m.index ?? 0;

/** Números de artigo citados logo antes de uma menção à lei ("arts. 85, § 2º, e 98 do CPC" → 85, 98). */
function artigosAntes(texto: string, pos: number): string[] {
  const janela = texto.slice(Math.max(0, pos - 160), pos);
  const ult = Math.max(janela.toLowerCase().lastIndexOf("art."), janela.toLowerCase().lastIndexOf("arts."), janela.toLowerCase().lastIndexOf("artigo"));
  if (ult < 0) return [];
  let trecho = janela.slice(ult).replace(/§+\s*\d+\s*[º°o]?(?:-[A-Z])?/g, " ").replace(/par[áa]grafo [úu]nico/gi, " ").replace(/\b(?:inc(?:iso)?s?|al[íi]nea)\.?\s*[IVXLC\d]+/gi, " ");
  trecho = trecho.split(/[.;](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕ])/)[0];      // para na frase seguinte
  const nums: string[] = [];
  for (const m of trecho.matchAll(/(?<![\d\/])(\d{1,4}(?:\.\d{3})?)\s*[º°o]?(?:\s*-\s*([A-Z]{1,2})\b)?/g)) {
    const k = chaveArtigo(m[1], m[2]);
    if (/^\d+$/.test(k) && parseInt(k, 10) === 0) continue;
    nums.push(k);
  }
  return Array.from(new Set(nums)).slice(0, 12);
}

export async function verificarCitacoes(texto: string): Promise<{ alertas: AlertaLegislacao[]; leisConferidas: string[]; semBase: boolean }> {
  const alertas: AlertaLegislacao[] = [], conferidas = new Set<string>();
  if (!texto || texto.length < 20) return { alertas, leisConferidas: [], semBase: false };
  if (CPC_1973.test(texto)) alertas.push({ lei: "CPC", artigo: "", tipo: "cpc1973", nota: "A minuta cita o CPC de 1973 (Lei 5.869/73), revogado pelo CPC/2015." });
  let temBase = false;
  for (const lei of LEIS) {
    const posicoes: number[] = [];
    for (const re of lei.aliases) { const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); for (const m of texto.matchAll(g)) posicoes.push(alvoDoTexto(m)); }
    if (!posicoes.length) continue;
    const estado = await estadoDaLei(lei.id);
    if (!estado) continue;
    temBase = true; conferidas.add(lei.curto);
    const vistos = new Set<string>();
    for (const pos of posicoes) for (const k of artigosAntes(texto, pos)) {
      if (vistos.has(k)) continue; vistos.add(k);
      const n = parseInt(k, 10);
      if (k in estado.r) alertas.push({ lei: lei.curto, artigo: k, tipo: "revogado", nota: estado.r[k] || undefined });
      else if (k in estado.v) alertas.push({ lei: lei.curto, artigo: k, tipo: "vetado", nota: estado.v[k] || undefined });
      else if (estado.maior > 0 && Number.isFinite(n) && n > estado.maior) alertas.push({ lei: lei.curto, artigo: k, tipo: "inexistente", nota: `a lei vai até o art. ${estado.maior}` });
    }
  }
  return { alertas, leisConferidas: Array.from(conferidas), semBase: !temBase };
}

/** Trecho para o prompt: dispositivos revogados/vetados das leis que o contexto menciona. */
export async function avisoDispositivosRevogados(contexto: string): Promise<string> {
  const partes: string[] = [];
  for (const lei of LEIS) {
    if (!lei.aliases.some((re) => re.test(contexto))) continue;
    const estado = await estadoDaLei(lei.id);
    if (!estado) continue;
    const ks = [...Object.keys(estado.r), ...Object.keys(estado.v)].sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
    if (ks.length) partes.push(`${lei.curto}: arts. ${ks.slice(0, 90).join(", ")}${ks.length > 90 ? ` (e outros ${ks.length - 90})` : ""}`);
  }
  if (!partes.length) return "";
  return `\n\n[LEGISLAÇÃO CONFERIDA NO PLANALTO — DISPOSITIVOS REVOGADOS OU VETADOS (NUNCA CITE COMO VIGENTES)]:\n${partes.join("\n")}\nDIRETRIZ: ao citar lei, use apenas dispositivos vigentes; o CPC aplicável é o de 2015 (Lei 13.105/2015), nunca o de 1973; se não tiver certeza da numeração ou da vigência de um artigo, descreva a norma sem o número e sinalize para conferência.\n`;
}

// ---------- teste de acesso (reconhecimento) ----------
const SITES: { id: string; grupo: string; nome: string; url: string }[] = [
  { id: "stf-sv", grupo: "STF", nome: "STF • Súmulas Vinculantes", url: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26" },
  { id: "stf-sumulas", grupo: "STF", nome: "STF • Súmulas", url: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=30" },
  { id: "stj-sumulas", grupo: "STJ", nome: "STJ • Súmulas (PDF)", url: "https://www.stj.jus.br/docs_internet/SumulasSTJ.pdf" },
  { id: "stj-site", grupo: "STJ", nome: "STJ • Portal", url: "https://www.stj.jus.br/sites/portalp/Jurisprudencia/Sumulas" },
  { id: "tnu", grupo: "TNU", nome: "TNU • Súmulas (CJF)", url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/turma-nacional-de-uniformizacao/sumulas-da-tnu" },
  { id: "tjgo-site", grupo: "TJGO", nome: "TJGO • Portal", url: "https://www.tjgo.jus.br/" },
  { id: "tjgo-transp", grupo: "TJGO", nome: "TJGO • Jurisprudência (transparência)", url: "https://transparencia.tjgo.jus.br/jurisprudencia" },
  { id: "tjgo-sumulas", grupo: "TJGO", nome: "TJGO • Súmulas", url: "https://www.tjgo.jus.br/sumulas" },
  { id: "planalto-cpc", grupo: "Planalto", nome: "Planalto • CPC (Lei 13.105/2015)", url: LEIS.find((l) => l.id === "cpc")!.url },
  { id: "planalto-cdc", grupo: "Planalto", nome: "Planalto • CDC (Lei 8.078/1990)", url: LEIS.find((l) => l.id === "cdc")!.url },
];
export async function reconhecer(): Promise<any[]> {
  const rodar = async (s: (typeof SITES)[number]) => {
    try {
      const r = await baixar(s.url, 20000);
      const ehPdf = /pdf/i.test(r.contentType) || r.buf.subarray(0, 5).toString() === "%PDF-";
      const out: any = { ...s, status: r.status, urlFinal: r.finalUrl === s.url ? undefined : r.finalUrl, tipo: r.contentType.split(";")[0], bytes: r.buf.length, ms: r.ms };
      if (!ehPdf) {
        const linhas = htmlParaLinhas(decodificar(r.buf, r.contentType));
        out.amostra = linhas.slice(0, 6).join(" | ").slice(0, 280);
        out.linhas = linhas.length;
        if (s.grupo === "Planalto") { const ex = extrairArtigos(linhas); out.leitura = { artigos: ex.total, revogados: ex.revogados, vetados: ex.vetados }; }
        if ((BLOQUEIO.test(linhas.slice(0, 40).join(" ")) && linhas.length < 40) || /captcha|forbidden|enable javascript|cloudflare/i.test(linhas.slice(0, 40).join(" "))) out.bloqueio = "BLOQUEADO: a página é um aviso de bloqueio (ou exige JavaScript), não o conteúdo";
      } else out.amostra = "(arquivo PDF)";
      return out;
    } catch (e: any) { return { ...s, status: 0, erro: String(e?.name === "AbortError" ? "tempo esgotado (20 s)" : e?.cause?.code || e?.message || e).slice(0, 160) }; }
  };
  const out: any[] = [];
  for (let i = 0; i < SITES.length; i += 4) out.push(...(await Promise.all(SITES.slice(i, i + 4).map(rodar))));
  return out;
}

// ---------- rotas (Super Admin) ----------
const soSuper = (req: any, res: express.Response): boolean => { if (!req.usuarioSessao?.superAdmin) { res.status(403).json({ erro: "somente o super administrador" }); return false; } return true; };
fontesRouter.post("/reconhecer", async (req, res) => { if (!soSuper(req, res)) return; try { res.json({ resultados: await reconhecer() }); } catch (e: any) { res.status(500).json({ erro: "falha no teste" }); } });
fontesRouter.get("/leis", async (req, res) => { if (!soSuper(req, res)) return; try { res.json({ leis: await listarResumoLeis() }); } catch { res.status(500).json({ erro: "não consegui ler o banco" }); } });
fontesRouter.post("/leis/:id/atualizar", async (req, res) => { if (!soSuper(req, res)) return; try { res.json({ lei: await importarLei(req.params.id) }); } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.message || "falha" }); } });
/** Arquivo de lei salvo no navegador (Ctrl+S na página do Planalto): o servidor lê e guarda só o estado compacto. Corpo = bytes do arquivo. */
fontesRouter.post("/leis/importar-arquivo", express.raw({ type: () => true, limit: "30mb" }), async (req, res) => {
  if (!soSuper(req, res)) return;
  try {
    const nome = decodeURIComponent(String(req.headers["x-nome-arquivo"] || "")), id = String(req.query.id || "") || undefined;
    if (!Buffer.isBuffer(req.body) || req.body.length < 200) return void res.status(400).json({ erro: "arquivo vazio ou pequeno demais" });
    res.json({ lei: await importarArquivoLei(nome, req.body, id) });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.message || "falha ao ler o arquivo" }); }
});
/** Qualquer usuário logado pode conferir um texto (ex.: a minuta) contra a base de leis. */
fontesRouter.post("/verificar-citacoes", async (req, res) => { try { res.json(await verificarCitacoes(String(req.body?.texto || "").slice(0, 400000))); } catch { res.status(500).json({ erro: "falha na conferência" }); } });
