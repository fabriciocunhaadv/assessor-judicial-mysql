// Reconhece, num texto (autos, minuta), as FONTES DO DIREITO citadas: leis e demais atos normativos (federais, estaduais, municipais), Constituições, tratados e súmulas/temas.
// Puro (sem banco, sem rede): usado pelo servidor para montar a lista "Fontes pendentes" (o que foi citado e o Studio ainda não tem) e testado sozinho.
export type TipoFonte = "lei" | "lei complementar" | "decreto" | "decreto-lei" | "medida provisória" | "emenda constitucional" | "resolução" | "portaria" | "provimento" | "instrução normativa" | "constituição" | "tratado" | "súmula" | "súmula vinculante" | "tema";
export type EsferaFonte = "federal" | "estadual" | "municipal" | "indefinida";
export interface CitacaoFonte { chave: string; tipo: TipoFonte; esfera: EsferaFonte; ente: string; numero: string; ano: number; orgao: string; rotulo: string }

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
const anoCompleto = (a: string): number => { const n = parseInt(a, 10); if (a.length === 4) return n; return n <= 30 ? 2000 + n : 1900 + n; };
const numeroLimpo = (n: string) => n.replace(/\./g, "").replace(/^0+(?=\d)/, "");
export const maiuscula = (s: string) => s.replace(/(^|\s)([a-zà-ú])/g, (_m, a, b) => a + b.toUpperCase());
const nomeProprio = (s: string) => s.trim().split(/\s+/).map((w, i) => (i > 0 && /^(de|do|da|dos|das)$/i.test(w) ? w.toLowerCase() : w)).join(" ");

const ATO = "Lei\\s+Complementar|Lei\\s+Delegada|Decreto[\\s-]*Lei|Lei|Decreto|Medida\\s+Provis[óo]ria|Emenda\\s+Constitucional|Resolu[çc][ãa]o|Portaria|Provimento|Instru[çc][ãa]o\\s+Normativa";
const RE_ATO = new RegExp(`\\b(${ATO})\\s*(Federal|Estadual|Municipal|Org[âa]nica)?\\s*(?:n[º°o.]{0,2}\\s*)?(\\d{1,3}(?:\\.\\d{3})+|\\d{1,6})\\s*(?:\\/\\s*(\\d{4}|\\d{2})\\b|-\\s*(\\d{4})\\b|,?\\s*de\\s+(?:\\d{1,2}\\s*[º°]?\\s+de\\s+)?[a-zç]+\\s+de\\s+(\\d{4})\\b)`, "gi");
const normalizarTipo = (t: string): TipoFonte => {
  const x = semAcento(t).toLowerCase().replace(/\s+/g, " ").replace("decreto lei", "decreto-lei").replace("decreto- lei", "decreto-lei").replace("lei delegada", "lei");
  return (["lei complementar", "decreto-lei", "decreto", "medida provisoria", "emenda constitucional", "resolucao", "portaria", "provimento", "instrucao normativa"].includes(x) ? ({ "medida provisoria": "medida provisória", "resolucao": "resolução", "instrucao normativa": "instrução normativa" } as any)[x] || x : "lei") as TipoFonte;
};
/** Esfera pela mesma oração: "Lei Estadual", "do Estado de Goiás", "Lei Municipal", "do Município de X". Sem pista: "indefinida" (o Super Admin confirma na lista). */
function esferaEEnte(texto: string, ini: number, fim: number, explicita: string): { esfera: EsferaFonte; ente: string } {
  const e = semAcento(explicita || "").toLowerCase();
  const antes = texto.slice(Math.max(0, ini - 50), ini).split(/[.;,\n]/).pop() || "", depois = (texto.slice(fim, fim + 90).split(/[.;,\n]/)[0] || "").split(/\b(?:Lei|Decreto|Resolu[çc][ãa]o|Portaria|Provimento|Medida|Emenda|Instru[çc][ãa]o|S[úu]mula|Tema)\b/i)[0];      // a vírgula também separa: o município da lei anterior não vale para a seguinte
  const jan = semAcento(`${antes} ${depois}`);
  const mun = /[Mm]unic[ií]pio\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*(?:\s+(?:de|do|da|dos|das)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*){0,3})/.exec(`${antes} ${depois}`);
  const est = /[Ee]stado\s+d[eo]\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*)?)/.exec(`${antes} ${depois}`);
  if (e === "municipal" || e === "organica" || /municipal|do municipio/i.test(jan)) return { esfera: "municipal", ente: mun ? nomeProprio(mun[1]) : "" };
  if (e === "estadual" || /estadual|do estado/i.test(jan) || /\b(?:ce|ce\/go|tjgo)\b/i.test(jan)) return { esfera: "estadual", ente: est ? nomeProprio(est[1]) : /goi[aá]s|\bgo\b/i.test(jan) ? "Goiás" : "" };
  if (e === "federal" || /\bunião\b|uniao|\bfederal\b/i.test(jan)) return { esfera: "federal", ente: "" };
  return { esfera: "indefinida", ente: "" };
}

export function extrairCitacoes(texto: string, maximo = 80): CitacaoFonte[] {
  const t = String(texto || "").replace(/ /g, " "), achadas = new Map<string, CitacaoFonte>();
  const guardar = (c: Omit<CitacaoFonte, "chave" | "rotulo"> & { rotulo?: string }) => {
    const chave = [c.tipo, c.esfera, slug(c.ente), c.numero ? numeroLimpo(c.numero) : "", c.ano || "", c.orgao, c.tipo === "tratado" ? slug(c.rotulo || "") : ""].join("|");
    if (!achadas.has(chave) && achadas.size < maximo) achadas.set(chave, { ...c, chave, rotulo: c.rotulo || `${maiuscula(c.tipo)}${c.esfera === "estadual" ? " Estadual" : c.esfera === "municipal" ? " Municipal" : ""} ${c.numero}/${c.ano}${c.ente ? ` (${c.ente})` : ""}` });
  };
  let m: RegExpExecArray | null;
  RE_ATO.lastIndex = 0;
  while ((m = RE_ATO.exec(t))) {
    const ano = anoCompleto(m[4] || m[5] || m[6] || ""); if (!(ano >= 1900 && ano <= 2100)) continue;
    const tipo = normalizarTipo(m[1]), { esfera, ente } = esferaEEnte(t, m.index, m.index + m[0].length, m[2] || "");
    guardar({ tipo, esfera, ente, numero: numeroLimpo(m[3]), ano, orgao: "" });
  }
  // Constituições
  if (/constitui[çc][ãa]o\s+(?:do\s+)?estado\s+de\s+goi[aá]s|constitui[çc][ãa]o\s+estadual|\bCE\s*\/\s*GO\b/i.test(t)) guardar({ tipo: "constituição", esfera: "estadual", ente: "Goiás", numero: "", ano: 1989, orgao: "", rotulo: "Constituição do Estado de Goiás" });
  if (/constitui[çc][ãa]o\s+federal|\bCRFB\b|\bCF\s*\/\s*(?:88|1988)\b|constitui[çc][ãa]o\s+da\s+rep[úu]blica/i.test(t)) guardar({ tipo: "constituição", esfera: "federal", ente: "", numero: "", ano: 1988, orgao: "", rotulo: "Constituição Federal de 1988" });
  // Tratados, convenções e pactos (pelo nome, até o fim da expressão)
  const RE_TRATADO = /\b(Conven[çc][ãa]o|Pacto|Tratado|Protocolo)((?:\s+(?:Internacional|Americana|Interamericana|Europeia))*)\s+((?:sobre|de|dos|das|do|da|contra|para)\s+(?:(?:os|as|o|a)\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*(?:\s+(?:(?:de|do|da|dos|das|e|sobre|contra|para)\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]*){0,6})/g;
  while ((m = RE_TRATADO.exec(t))) { const nome = `${m[1]}${m[2]} ${m[3]}`.replace(/\s+/g, " ").replace(/[\s,;:.]+$/, "").slice(0, 120); if (nome.length >= 18) guardar({ tipo: "tratado", esfera: "federal", ente: "", numero: "", ano: 0, orgao: "", rotulo: nome }); }
  // Súmulas e temas (com o tribunal)
  const RE_SUM = /\bS[úu]mula\s+(Vinculante\s+)?(?:n[º°o.]{0,2}\s*)?(\d{1,2}\.\d{3}|\d{1,4})(?:\s*(?:,|\/|-|\(|d[oa])?\s*(?:d[oa]\s+)?(STF|STJ|TJGO|TJ\/GO|TNU|TST|TSE|STM))?/gi;
  while ((m = RE_SUM.exec(t))) {
    const sv = !!m[1], orgao = sv ? "STF" : (m[3] || "").toUpperCase().replace("TJ/GO", "TJGO");
    guardar({ tipo: sv ? "súmula vinculante" : "súmula", esfera: "federal", ente: "", numero: m[2], ano: 0, orgao, rotulo: `${sv ? "Súmula Vinculante" : "Súmula"} ${m[2]}${orgao ? ` do ${orgao}` : " (tribunal não informado)"}` });
  }
  const RE_TEMA = /\bTema\s+(?:n[º°o.]{0,2}\s*)?(\d{1,2}\.\d{3}|\d{1,4})(?:\s*(?:,|\/|-|\()?\s*(?:d[oa]\s+)?(STF|STJ))\b/gi;
  while ((m = RE_TEMA.exec(t))) guardar({ tipo: "tema", esfera: "federal", ente: "", numero: numeroLimpo(m[1]), ano: 0, orgao: m[2].toUpperCase(), rotulo: `Tema ${numeroLimpo(m[1])} do ${m[2].toUpperCase()}` });
  return [...achadas.values()];
}
