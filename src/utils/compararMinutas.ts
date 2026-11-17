// Compara a minuta que o Studio GEROU com a que ficou LANÇADA no Projudi (texto salvo na pré-análise): o que foi mantido, cortado, acrescentado e reescrito.
// Serve ao Super Admin para calibrar prompts e motores (o que os usuários mais mudam). Lógica pura, sem tela e sem rede.

export interface ParteDiff { t: "=" | "-" | "+"; s: string }
export interface BlocoComp { tipo: "igual" | "alterado" | "removido" | "adicionado"; secao: string; original?: string; lancado?: string; partes?: ParteDiff[] }
export interface SecaoComp { secao: string; palavrasOriginais: number; mantidas: number; aproveitamentoPct: number }
export interface ResultadoComp {
  aproveitamentoPct: number; palavrasOriginal: number; palavrasLancado: number; mantidas: number; removidas: number; acrescentadas: number;
  porSecao: SecaoComp[]; dispositivoMudou: boolean; dispositivoAproveitamentoPct: number | null; blocos: BlocoComp[];
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const palavras = (s: string) => s.split(/\s+/).filter(Boolean);

/** HTML do editor do Projudi → texto em parágrafos (uma linha por bloco). */
export function textoDeHtml(html: string): string {
  const h = String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n");
  return h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª")
    .split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

const TITULO_ATO = /^(despacho|decisao( interlocutoria| saneadora)?|sentenca)( |$)/;
/** Tira o que NÃO é a redação: o cabeçalho que vem ANTES do título do ato (o modelo do Projudi e o do Studio têm o seu) e a linha de assinatura ("..., data do sistema") com o que vem depois. */
export function limparCabecalhoRodape(texto: string): string {
  let linhas = String(texto || "").split(/\n+/).map((l) => l.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean);
  const iTit = linhas.slice(0, 14).findIndex((l) => { const t = chave(l); return t.length > 0 && t.length <= 60 && TITULO_ATO.test(t); });
  if (iTit >= 0) linhas = linhas.slice(iTit + 1);
  const iAss = linhas.findIndex((l) => /data do sistema/i.test(l) || /^\s*documento assinado/i.test(l));
  if (iAss >= 0) linhas = linhas.slice(0, iAss);
  return linhas.join("\n");
}

// Só vale como título de seção a linha que é APENAS o título (“I - RELATÓRIO”, “FUNDAMENTAÇÃO”, “III – DISPOSITIVO”): um parágrafo que apenas começa com “Relatório…” continua sendo texto.
const RX_TITULO = /^(?:(?:iii|ii|iv|i|[1-4])[\s.\-–)]*)?(?:da |do )?(relatorio|fundamentacao|dispositivo)[\s:.]*$/;
const NOME_SECAO: Record<string, string> = { relatorio: "Relatório", fundamentacao: "Fundamentação", dispositivo: "Dispositivo" };
const secaoDoCabecalho = (linha: string): string | null => {
  const t = chave(linha); if (t.length > 40) return null;
  const m = t.match(RX_TITULO); return m ? NOME_SECAO[m[1]] : null;
};

interface Par { texto: string; secao: string }
function emParagrafos(texto: string): Par[] {
  const out: Par[] = []; let secao = "Início";
  for (const l of String(texto || "").split(/\n+/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    const s = secaoDoCabecalho(l); if (s) { secao = s; continue; }      // o cabeçalho da seção marca onde estamos; não conta como texto
    out.push({ texto: l, secao });
  }
  return out;
}

/** LCS de índices entre duas listas de chaves. Devolve pares [i, j] em ordem. */
function lcsIndices(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length; if (!n || !m) return [];
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [number, number][] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return out;
}

function diffPalavras(orig: string, lanc: string): { partes: ParteDiff[]; mantidas: number } {
  const a = palavras(orig), b = palavras(lanc);
  if (a.length * b.length > 6_000_000) return { partes: [{ t: "-", s: orig }, { t: "+", s: lanc }], mantidas: 0 };
  const ka = a.map(chave), kb = b.map(chave), pares = lcsIndices(ka, kb);
  const partes: ParteDiff[] = []; const push = (t: ParteDiff["t"], s: string) => { if (!s) return; const u = partes[partes.length - 1]; if (u && u.t === t) u.s += " " + s; else partes.push({ t, s }); };
  let i = 0, j = 0;
  for (const [pi, pj] of pares) { push("-", a.slice(i, pi).join(" ")); push("+", b.slice(j, pj).join(" ")); push("=", a[pi]); i = pi + 1; j = pj + 1; }
  push("-", a.slice(i).join(" ")); push("+", b.slice(j).join(" "));
  return { partes, mantidas: pares.length };
}

const similaridade = (a: string, b: string): number => {
  const A = new Set(chave(a).split(" ")), B = new Set(chave(b).split(" ")); let c = 0; for (const x of A) if (B.has(x)) c++;
  const u = A.size + B.size - c; return u ? c / u : 0;
};

export function compararMinutas(original: string, lancado: string): ResultadoComp {
  const P = emParagrafos(limparCabecalhoRodape(original)), Q = emParagrafos(limparCabecalhoRodape(lancado));
  const pares = lcsIndices(P.map((p) => chave(p.texto)), Q.map((q) => chave(q.texto)));
  const blocos: BlocoComp[] = []; const mant = new Map<string, number>(), tot = new Map<string, number>();
  const soma = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);
  let mantidas = 0, acrescentadas = 0, removidas = 0;
  const tratarLacuna = (i0: number, i1: number, j0: number, j1: number) => {
    const os = P.slice(i0, i1), ls = Q.slice(j0, j1); let jj = 0;
    for (const o of os) {
      let achou = -1, melhor = 0.45;
      for (let k = jj; k < ls.length; k++) { const s = similaridade(o.texto, ls[k].texto); if (s >= melhor) { melhor = s; achou = k; } }
      if (achou < 0) { blocos.push({ tipo: "removido", secao: o.secao, original: o.texto }); const w = palavras(o.texto).length; soma(tot, o.secao, w); removidas += w; continue; }
      for (let k = jj; k < achou; k++) { blocos.push({ tipo: "adicionado", secao: ls[k].secao, lancado: ls[k].texto }); acrescentadas += palavras(ls[k].texto).length; }
      const d = diffPalavras(o.texto, ls[achou].texto), w = palavras(o.texto).length;
      blocos.push({ tipo: "alterado", secao: o.secao, original: o.texto, lancado: ls[achou].texto, partes: d.partes });
      soma(tot, o.secao, w); soma(mant, o.secao, d.mantidas); mantidas += d.mantidas; removidas += w - d.mantidas; acrescentadas += palavras(ls[achou].texto).length - d.mantidas; jj = achou + 1;
    }
    for (let k = jj; k < ls.length; k++) { blocos.push({ tipo: "adicionado", secao: ls[k].secao, lancado: ls[k].texto }); acrescentadas += palavras(ls[k].texto).length; }
  };
  let i = 0, j = 0;
  for (const [pi, pj] of pares) {
    tratarLacuna(i, pi, j, pj);
    const w = palavras(P[pi].texto).length; blocos.push({ tipo: "igual", secao: P[pi].secao, original: P[pi].texto, lancado: Q[pj].texto });
    soma(tot, P[pi].secao, w); soma(mant, P[pi].secao, w); mantidas += w; i = pi + 1; j = pj + 1;
  }
  tratarLacuna(i, P.length, j, Q.length);
  const palavrasOriginal = P.reduce((s, p) => s + palavras(p.texto).length, 0), palavrasLancado = Q.reduce((s, q) => s + palavras(q.texto).length, 0);
  const pct = (m: number, t: number) => (t ? Math.round((m / t) * 100) : 0);
  const ordem = ["Início", "Relatório", "Fundamentação", "Dispositivo"];
  const porSecao = [...tot.keys()].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).map((s) => ({ secao: s, palavrasOriginais: tot.get(s) || 0, mantidas: mant.get(s) || 0, aproveitamentoPct: pct(mant.get(s) || 0, tot.get(s) || 0) }));
  const disp = porSecao.find((s) => s.secao === "Dispositivo");
  const dispLanc = Q.filter((q) => q.secao === "Dispositivo").length;
  return {
    aproveitamentoPct: pct(mantidas, palavrasOriginal), palavrasOriginal, palavrasLancado, mantidas, removidas, acrescentadas, porSecao,
    dispositivoMudou: disp ? disp.aproveitamentoPct < 100 || dispLanc === 0 || blocos.some((b) => b.secao === "Dispositivo" && b.tipo === "adicionado") : false, dispositivoAproveitamentoPct: disp ? disp.aproveitamentoPct : null, blocos,
  };
}
