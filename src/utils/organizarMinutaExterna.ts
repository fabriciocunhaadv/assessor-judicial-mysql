// Organiza uma minuta que chega pronta de fora do Studio (hoje: o Agaia) em RELATÓRIO, FUNDAMENTAÇÃO, DISPOSITIVO e fecho (assinatura), com a mesma formatação da tela.
// Funciona com títulos de seção em várias formas (RELATÓRIO, "I - RELATÓRIO", "DA FUNDAMENTAÇÃO", "**Dispositivo**", "Relatório: ...") e também SEM títulos,
// achando as fronteiras pelo próprio texto ("É o relatório. Decido.", "Ante o exposto, DEFIRO ..."). Nada é inventado nem apagado, exceto as fórmulas de transição
// que só marcam a fronteira ("É o relatório.", "Decido.") e os títulos das seções. Funções puras (sem DOM): rodam no navegador e nos testes em Node.
import { organizarTextoDaMinuta } from "./organizarTextoDaMinuta";

export interface MinutaOrganizada {
  titulo: string; relatorio: string; fundamentacao: string; dispositivo: string; closing: string;
  semSecoes: boolean; autor: string; reu: string;
}

const semAc = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", ndash: "–", mdash: "—", sect: "§", laquo: "«", raquo: "»", hellip: "…" };

/** HTML do Agaia -> Markdown simples (parágrafos, **negrito**, *itálico*, listas e citações), sem depender do DOM. */
export function htmlParaMarkdown(html: string): string {
  let t = String(html || "").replace(/\r/g, "");
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, x: string) => (x.replace(/<[^>]+>/g, "").trim() ? `**${x.replace(/<[^>]+>/g, "").trim()}**` : x));
  t = t.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, x: string) => (x.replace(/<[^>]+>/g, "").trim() ? `*${x.replace(/<[^>]+>/g, "").trim()}*` : x));
  t = t.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "").replace(/<blockquote\b[^>]*>/gi, "\n\n> ").replace(/<\/(p|div|h[1-6]|blockquote|ul|ol|tr|table)>/gi, "\n\n");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
  return t.replace(/[ \t ]+/g, " ").split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const limpa = (l: string) => l.replace(/^[ \t>#]+/, "").replace(/[*_`]+/g, "").trim();
const TITULO_ATO = /^(SENTEN[ÇC]A|DECIS[ÃA]O(?: INTERLOCUT[ÓO]RIA)?|DESPACHO|ATO ORDINAT[ÓO]RIO)$/i;

type Tipo = "REL" | "FUN" | "DIS";
const CAB = /^(RELAT[ÓO]RIO|S[ÍI]NTESE (?:DO PROCESSO|DOS FATOS|PROCESSUAL)|HIST[ÓO]RICO PROCESSUAL|BREVE RELATO|FUNDAMENTA[ÇC][ÃA]O(?: JUR[ÍI]DICA)?|FUNDAMENTOS|MOTIVA[ÇC][ÃA]O|RAZ[ÕO]ES DE DECIDIR|M[ÉE]RITO|DISPOSITIVO(?: FINAL)?|DISPOSI[ÇC][ÕO]ES FINAIS|PARTE DISPOSITIVA|CONCLUS[ÃA]O)\b\s*(?:[:–—-]\s*([\s\S]*))?$/i;
const CAB_DECIDO = /^(DECIDO|PASSO A DECIDIR|FUNDAMENTO E DECIDO)\s*[.:]?$/i;

/** A linha é um título de seção? Devolve o tipo e o texto que vier na mesma linha ("Relatório: Trata-se..."). */
function cabecalho(linha: string): { tipo: Tipo; resto: string } | null {
  const bruto = linha.trim(); if (!bruto || bruto.length > 220) return null;
  let t = limpa(bruto);
  t = t.replace(/^(?:[IVX]{1,4}|\d{1,2}|[A-D])\s*[-–—.):]\s*/i, "").replace(/^(?:D[OA]S?|DE)\s+/i, "").replace(/[.:;\s]+$/, (m) => (/[:]/.test(m) ? ":" : "")).trim();
  if (CAB_DECIDO.test(t)) return { tipo: "FUN", resto: "" };
  const m = CAB.exec(t); if (!m) return null;
  const palavra = semAc(m[1]).toUpperCase();
  const tipo: Tipo = /^(RELATORIO|SINTESE|HISTORICO|BREVE)/.test(palavra) ? "REL" : /^(DISPOSITIVO|DISPOSICOES|PARTE DISPOSITIVA|CONCLUSAO)/.test(palavra) ? "DIS" : "FUN";
  const resto = (m[2] || "").trim();
  if (resto && resto.length < 12) return null; // "Mérito - X" curto demais: provavelmente é frase, não título
  return { tipo, resto };
}

const INICIO_DISPOSITIVO = /^(?:\*\*)?(Ante o exposto|Diante do exposto|Pelo exposto|Isto posto|Isto,? posto|Posto isso|Em face do exposto|Por todo o exposto|Do exposto|Assim sendo|Por tais raz[õo]es|Dessa forma|DEFIRO|INDEFIRO|DETERMINO|JULGO|HOMOLOGO|DECLARO|REJEITO|ACOLHO|Defiro|Indefiro|Determino|Julgo|Homologo|Declaro|Rejeito|Acolho)\b/;
const INICIO_ANALISE = /^(?:\*\*)?(Inicialmente|De in[ií]cio|Em primeiro lugar|Primeiramente|Preliminarmente|Quanto ao|Quanto [àa]|Da |Do |No m[ée]rito|Pois bem|Passo|Analisando|Examinando|Verifico|Verifica-se|Observo|Registro|Destaco|Cumpre|Compete|Nos termos|Segundo|De acordo|Conforme|Consoante|A (?:quest[ãa]o|controv[ée]rsia)|O (?:ponto|cerne)|[ÉE] cedi[çc]o|Sabe-se|Ressalte|Prima facie|A priori|Decido|Fundamento)/i;
const NARRATIVO = /^(?:\*\*)?(Vistos|Trata-se|Cuida-se|Cuidam|Versam|Tratam|Os presentes autos|Compulsando|Em s[ií]ntese|Narra|Relata|A parte (?:autora|exequente|requerente)|O exequente|O autor|A autora|Na (?:peti[çc][ãa]o|inicial)|Em (?:peti[çc][ãa]o|manifesta[çc][ãa]o)|Sobreveio|Instaurad)/i;
const MARCA_RELATORIO = /(?:^|[\s.])(?:[ÉE]|Eis|Este [ée]|Esse [ée]) o (?:breve )?(?:relat[óo]rio|relato)\.?(?:\s*(?:Decido|Passo a decidir|Fundamento e decido)\.?)?\s*$/i;
const SO_TRANSICAO = /^(?:\*\*)?(?:[ÉE]|Eis|Este [ée]|Esse [ée]) o (?:breve )?(?:relat[óo]rio|relato)\.?\s*(?:Decido|Passo a decidir|Fundamento e decido)?\.?(?:\*\*)?$|^(?:\*\*)?(?:Decido|Passo a decidir|Fundamento e decido)\.?(?:\*\*)?$/i;
const FECHO = /(data d[oa] (?:sistema|assinatura)|assinad[oa] (?:digital)?mente|^\(?documento assinado|^\(?assinado|\bjuiz(?:a)?(?:\(a\))? de direito\b|^[A-ZÀ-Ú][\p{L} ]{2,60}\s*-\s*GO\s*,|^[A-ZÀ-Ú][\p{L} ]{2,60},\s*\d{1,2} de \p{L}+ de \d{4})/iu;

function paragrafosDe(t: string): string[] {
  let ps = t.split(/\n[ \t]*\n/).map((x) => x.trim()).filter(Boolean);
  if (ps.length <= 1 && /\n/.test(t)) ps = t.split(/\n/).map((x) => x.trim()).filter(Boolean);
  return ps;
}

/** Tira do fim as linhas de fecho (local, data do sistema, assinatura) e devolve [texto sem o fecho, fecho]. */
function separarFecho(ps: string[]): [string[], string] {
  const fecho: string[] = []; let fim = ps.length;
  while (fim > 1 && fecho.length < 3) {
    const p = ps[fim - 1]; if (p.length > 200 || !FECHO.test(limpa(p))) break;
    fecho.unshift(limpa(p)); fim--;
  }
  return [ps.slice(0, fim), fecho.join("\n\n")];
}

/** Separa o texto em [fundamentação, dispositivo] pelo primeiro parágrafo que abre o dispositivo (depois de ao menos um parágrafo de fundamentação). */
function separarDispositivo(ps: string[], desde = 1): [string[], string[]] {
  let k = ps.findIndex((x, i) => i >= desde && INICIO_DISPOSITIVO.test(x));
  if (k < 0) k = ps.findIndex((x, i) => i >= desde && /^(Intim(e|em)-se|Cumpra-se|Publique-se|Expe[çc]a-se|Interven[çc][ãa]o)/i.test(x));
  return k > 0 ? [ps.slice(0, k), ps.slice(k)] : [ps, []];
}

function organizar(secao: "relatorio" | "fundamentacao" | "dispositivo", t: string): string {
  const x = (t || "").trim(); if (!x) return "";
  try { return organizarTextoDaMinuta(x, secao).trim(); } catch { return x; }
}

/** Texto da minuta (Markdown ou texto puro, já sem o cabeçalho de identificação) -> seções. `corpo` não deve conter a linha do título do ato. */
export function separarSecoes(corpo: string): { relatorio: string; fundamentacao: string; dispositivo: string; closing: string; semSecoes: boolean } {
  const linhas = corpo.replace(/\r/g, "").split("\n");
  const marcas: { i: number; tipo: Tipo; resto: string }[] = [];
  linhas.forEach((l, i) => { const c = cabecalho(l); if (c) marcas.push({ i, ...c }); });

  let rel = "", fund = "", disp = "", semSecoes = false;
  if (marcas.length) {
    const pega = (de: number, ate: number, resto: string) => [resto, ...linhas.slice(de, ate)].join("\n").trim();
    const pre = linhas.slice(0, marcas[0].i).join("\n").trim();
    const partes: Record<Tipo, string[]> = { REL: [], FUN: [], DIS: [] };
    marcas.forEach((m, n) => { partes[m.tipo].push(pega(m.i + 1, n + 1 < marcas.length ? marcas[n + 1].i : linhas.length, m.resto)); });
    rel = partes.REL.join("\n\n").trim(); fund = partes.FUN.join("\n\n").trim(); disp = partes.DIS.join("\n\n").trim();
    if (pre) { if (rel) rel = pre + "\n\n" + rel; else if (marcas[0].tipo !== "REL") rel = pre; }
    if (!disp && fund) { const [f, d] = separarDispositivo(paragrafosDe(fund)); if (d.length) { fund = f.join("\n\n"); disp = d.join("\n\n"); } }
    if (!rel && !fund && !disp) semSecoes = true;
  } else semSecoes = true;

  if (semSecoes) {
    // sem títulos: acha as fronteiras pelo texto
    const org = organizarTextoDaMinuta(corpo.trim(), "fundamentacao");
    let ps = paragrafosDe(org);
    // 1) fim do relatório
    let ate = -1, descartaAte = -1, direto = false; // direto: depois do relato vem logo o dispositivo (sem fundamentação em separado)
    const iMarca = ps.findIndex((p) => MARCA_RELATORIO.test(p));
    if (iMarca >= 0) {
      if (SO_TRANSICAO.test(limpa(ps[iMarca]))) { ate = iMarca; descartaAte = iMarca + 1; }
      else { const cortado = ps[iMarca].replace(MARCA_RELATORIO, "").trim(); ps = [...ps.slice(0, iMarca), ...(cortado ? [cortado] : []), ...ps.slice(iMarca + 1)]; ate = cortado ? iMarca + 1 : iMarca; descartaAte = ate; }
    } else {
      const iDecido = ps.findIndex((p, i) => i >= 1 && SO_TRANSICAO.test(limpa(p)));
      if (iDecido >= 1) { ate = iDecido; descartaAte = iDecido + 1; }
      else if (NARRATIVO.test(ps[0] || "")) {
        let k = ps.findIndex((p, i) => i >= 1 && INICIO_ANALISE.test(p));
        if (k < 0) { k = ps.findIndex((p, i) => i >= 1 && INICIO_DISPOSITIVO.test(p)); direto = k > 0; }
        if (k < 0) k = 1;
        ate = k; descartaAte = k;
      }
    }
    const relPs = ate > 0 ? ps.slice(0, ate) : [];
    let resto = ate > 0 ? ps.slice(descartaAte) : ps;
    if (resto.length && /^(?:\*\*)?(Decido|Passo a decidir|Fundamento e decido)\.?(?:\*\*)?\s+/i.test(resto[0])) resto = [resto[0].replace(/^(?:\*\*)?(Decido|Passo a decidir|Fundamento e decido)\.?(?:\*\*)?\s+/i, ""), ...resto.slice(1)];
    rel = relPs.join("\n\n");
    if (direto) { fund = ""; disp = resto.join("\n\n"); }
    else {
      const [fPs, dPs] = separarDispositivo(resto, resto.length > 1 ? 1 : 0);
      fund = fPs.join("\n\n"); disp = dPs.join("\n\n");
      if (!fund && disp) { fund = disp; disp = ""; } // sem relatório nem fundamentação identificáveis: nada fica sem lugar
      if (!disp && fund) { const ps2 = paragrafosDe(fund); if (ps2.length > 2 && INICIO_DISPOSITIVO.test(ps2[ps2.length - 1])) { disp = ps2[ps2.length - 1]; fund = ps2.slice(0, -1).join("\n\n"); } }
    }
  }

  // fecho (local, data, assinatura) sai do fim do dispositivo (ou da fundamentação, se não houver dispositivo)
  let closing = "";
  const alvo = disp ? "disp" : "fund"; const base = paragrafosDe(alvo === "disp" ? disp : fund);
  const [semFecho, fecho] = separarFecho(base);
  if (fecho) { closing = fecho; if (alvo === "disp") disp = semFecho.join("\n\n"); else fund = semFecho.join("\n\n"); }
  return { relatorio: organizar("relatorio", rel), fundamentacao: organizar("fundamentacao", fund), dispositivo: organizar("dispositivo", disp), closing, semSecoes };
}

/** Texto (e HTML opcional) da minuta externa -> título, seções formatadas, fecho e partes. */
export function organizarMinutaExterna(texto: string, html = ""): MinutaOrganizada {
  const plano = String(texto || "").replace(/\r/g, "").trim();
  const md = html ? htmlParaMarkdown(html) : "";
  const semMarcas = (s: string) => s.replace(/[*_>#-]+/g, "").replace(/\s+/g, "");
  const fonte = md && semMarcas(md).length >= 0.85 * semMarcas(plano).length && semMarcas(md).length <= 1.6 * semMarcas(plano).length ? md : plano; // usa o HTML (negrito, itálico, listas) quando ele traz o mesmo conteúdo
  const linhas = fonte.split("\n");
  const iTit = linhas.findIndex((l) => TITULO_ATO.test(limpa(l).replace(/[.:\s]+$/, "")));
  const titulo = iTit >= 0 ? limpa(linhas[iTit]).replace(/[.:\s]+$/, "").toUpperCase() : "MINUTA (AGAIA)";
  const corpo = (iTit >= 0 ? linhas.slice(iTit + 1) : linhas).join("\n").trim();
  const topo = (iTit >= 0 ? linhas.slice(0, iTit) : linhas.slice(0, 12)).join("\n");
  const autor = (topo.match(/(?:Exequente|Autor(?:a)?|Requerente|Promovente|Embargante|Reclamante)\s*(?:\(.*?\))?\s*:\s*([^\n]+)/i) || plano.match(/(?:Exequente|Autor(?:a)?|Requerente|Promovente)\s*:\s*([^\n]+)/i) || [])[1]?.replace(/\*+/g, "").trim() || "";
  const reu = (topo.match(/(?:Executad[oa]s?|R[ée]u?s?|Requerid[oa]s?|Promovid[oa]s?|Embargad[oa]s?|Reclamad[oa]s?)\s*(?:\(.*?\))?\s*:\s*([^\n]+)/i) || plano.match(/(?:Executad[oa]s?|R[ée]u?s?|Requerid[oa]s?|Promovid[oa]s?)\s*:\s*([^\n]+)/i) || [])[1]?.replace(/\*+/g, "").trim() || "";
  const s = separarSecoes(corpo);
  return { titulo, ...s, autor, reu };
}
