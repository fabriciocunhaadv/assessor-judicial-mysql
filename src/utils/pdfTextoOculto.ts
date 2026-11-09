// TEXTO ESCONDIDO NO PDF: o texto que está em cor BRANCA (ou quase) é invisível a quem lê a página, mas a IA o lê normalmente.
// É a forma mais comum de "prompt injection" em PDF. Percorre as instruções de desenho de cada página (pdf.js) acompanhando a cor de preenchimento
// e junta o que foi escrito em branco. Texto invisível de OCR (modo de renderização 3) NÃO é tratado como escondido: é a camada normal de PDFs escaneados.
// Sem importar o pdf.js: quem chama (navegador ou servidor) passa o documento já carregado e o objeto pdfjs (OPS).

export interface TextoOculto { pagina: number; texto: string; cor: string }
export const MARCA_OCULTO = "[TEXTO ESCONDIDO EM FONTE BRANCA";

const ehBranca = (c: any): boolean => {
  const m = typeof c === "string" ? c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i) : null;
  return !!m && [m[1], m[2], m[3]].every((h) => parseInt(h, 16) >= 0xf0);
};

export async function textoOcultoDeDocumento(pdf: any, pdfjs: any, opts: { maxPaginas?: number; orcamentoMs?: number } = {}): Promise<TextoOculto[]> {
  const out: TextoOculto[] = [];
  const O = pdfjs.OPS, t0 = Date.now();
  const COR = new Set([O.setFillRGBColor, O.setFillGray, O.setFillColor, O.setFillColorN, O.setFillCMYKColor].filter((x: any) => x != null));
  const TEXTO = new Set([O.showText, O.showSpacedText, O.nextLineShowText, O.nextLineSetSpacingShowText].filter((x: any) => x != null));
  const n = Math.min(pdf.numPages || 0, opts.maxPaginas ?? 600);
  for (let p = 1; p <= n; p++) {
    if (Date.now() - t0 > (opts.orcamentoMs ?? 30000)) break;
    let ol: any;
    try { const page = await pdf.getPage(p); ol = await page.getOperatorList(); page.cleanup?.(); } catch { continue; }
    let cor = "#000000", modo = 0; const pilha: [string, number][] = []; let acumulado = "";
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], a = ol.argsArray[i];
      if (fn === O.save) pilha.push([cor, modo]);
      else if (fn === O.restore) { const s = pilha.pop(); if (s) [cor, modo] = s; }
      else if (COR.has(fn)) { if (typeof a?.[0] === "string") cor = a[0].toLowerCase(); }
      else if (fn === O.setTextRenderingMode) modo = Number(a?.[0]) || 0;
      else if (TEXTO.has(fn) && ehBranca(cor) && modo !== 3 && modo !== 7) {
        const g = Array.isArray(a?.[0]) ? a[0] : [];
        for (const x of g) if (x && typeof x === "object" && typeof x.unicode === "string") acumulado += x.unicode;
      }
    }
    const t = acumulado.replace(/\s+/g, " ").trim();
    if (t.replace(/\s/g, "").length >= 6) out.push({ pagina: p, texto: t, cor: "branca" });
  }
  return out;
}


// ---------- O texto escondido TEM INTENÇÃO? ----------
// Texto em cor branca é comum em PDF legítimo (rótulo branco sobre caixa colorida, como numa conta de energia). Só é suspeito se o CONTEÚDO tiver intenção de
// influenciar a IA: dar ordem, pedir um resultado, dar valor a uma variável/string, inverter ou trocar um dado, ou afirmar fatos a favor de uma parte.
// Códigos, números, protocolos, datas e rótulos ("Parceiro de Negócio 123819397") NÃO são suspeitos.
const semAc = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const REGRAS_INTENCAO: { motivo: string; rx: RegExp }[] = [
  { motivo: "ordem para ignorar as instruções", rx: /\b(?:ignor(?:e|ar|em)|desconsider(?:e|ar|em)|esquec(?:a|er)|descart(?:e|ar)|disregard|forget|override)\b[^.\n]{0,60}\b(?:instruc|ordens|regras|diretriz|prompt|anterior|previous|above|system|tudo)/ },
  { motivo: "mensagem dirigida à IA", rx: /\b(?:ia|inteligencia artificial|llm|chat ?gpt|gpt|gemini|claude|copilot|assistente virtual|assistente de ia|modelo de linguagem|language model|ai assistant|assistant)\b/ },
  { motivo: "troca de papel ou instrução de sistema", rx: /(?:\bvoce\s+(?:e|sera|agora)\b|\byou are\b|\baja como\b|\bact as\b|\bfinja\b|\bpretend\b|\bsimule\b|\bsystem\s*prompt\b|\bprompt\s+do\s+sistema\b|\bjailbreak\b|\bnovas?\s+instruc|\bnew\s+instructions?\b|<\|im_start\|>|\[inst\]|\[\s*(?:system|sistema)\s*\])/ },
  { motivo: "ordem para decidir ou produzir um resultado", rx: /\b(?:julgue|julgar|decida|decidir|sentencie|profira|conceda|conceder|defira|deferir|indefira|indeferir|reconheca|reconhecer|condene|absolva|aprove|reprove|classifique|atribua|responda|retorne|escreva|inclua|omita|oculte|nao\s+(?:mencione|cite|registre|relate|informe))\b[^.\n]{0,80}\b(?:procedente|improcedente|favor|autor|autora|reu|requerente|requerido|parte|pedido|liminar|tutela|decisao|sentenca|dispositivo|minuta|analise|resultado|nota|risco)\b|\b(?:you must|you should|do not mention|respond with|answer with)\b/ },
  { motivo: "valor dado a uma variável ou campo para simular um resultado", rx: /\b(?:resultado|decisao|sentenca|status|veredito|julgamento|risco|prescricao|procedencia|nota|score)\s*(?:=|:=|->|:|deve\s+ser|seja|sera|igual\s+a)\s*(?:procedente|improcedente|deferid[oa]|indeferid[oa]|aprovad[oa]|reprovad[oa]|true|false|verdadeiro|falso|sim|nao|\d+(?:[.,]\d+)?\s*(?:\/\s*\d+|%|pontos))\b|\b(?:defina|definir|set|atribua|atribuir|assign)\s+[^.\n]{1,40}?\s+(?:como|para|to|as|=)\s+\S+/ },
  { motivo: "pedido para trocar ou inverter um dado", rx: /\b(?:inverta|inverter|troque|trocar|substitua|substituir|altere|alterar|mude|mudar|modifique|falsifique)\b[^.\n]{0,60}\b(?:autor|autora|reu|requerente|requerido|data|valor|prazo|parte|nome|resultado|dado|numero|cpf|processo|decisao)\b|\bonde\s+se\s+le\b|\bleia-se\b|\bleia\s+como\b|\bread\s+as\b|\breplace\s+.{1,40}\s+with\b|\bconsidere\s+que\b|\btrate\s+(?:o|a|os|as)?\s*\w+\s+como\b|\btome\s+como\b|\bassuma\s+que\b/ },
  { motivo: "afirmação sobre o caso a favor de uma parte", rx: /\b(?:o|a)\s+(?:autor|autora|reu|re|requerente|requerido|requerida|exequente|executado|executada)\s+(?:comprovou|provou|e\s+inocente|tem\s+razao|nao\s+deve|nao\s+deveu|pagou|quitou|cumpriu)\b/ },
];
export function classificarTextoOculto(texto: string): { suspeito: boolean; motivo: string } {
  const t = semAc(texto).replace(/\s+/g, " ").trim();
  for (const r of REGRAS_INTENCAO) if (r.rx.test(t)) return { suspeito: true, motivo: r.motivo };
  return { suspeito: false, motivo: "" };
}

// Texto que entra junto com o texto dos autos: a IA vê o trecho identificado como escondido e o detector o reconhece pela marca.
export const blocoTextoOculto = (lista: TextoOculto[]): string =>
  lista.filter((x) => classificarTextoOculto(x.texto).suspeito).map((x) => `\n${MARCA_OCULTO} — pág. ${x.pagina} do arquivo]: ${x.texto.slice(0, 600)}\n`).join("");
