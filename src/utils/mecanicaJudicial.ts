// Princípios de mecânica judicial que valem para QUALQUER área (cível, família, criminal, fazenda, juizados...) e para TODOS os módulos
// (análise normal, Turbo, Lupa, Mesa de Audiência, gigantes). Texto das regras + conferências sem IA (leves, só texto) sobre a minuta pronta.

export const REGRA_COMPETENCIA_PRIMEIRO = `

[COMPETÊNCIA — VERIFICAÇÃO PRÉVIA OBRIGATÓRIA EM TODA MINUTA]
Antes de qualquer análise de mérito, tutela, medida cautelar ou custódia, confronte o JUÍZO indicado na capa com o objeto dos autos (matéria, rito, valor da causa ou da alçada, pena máxima cominada, qualidade das partes). Esta verificação é etapa interna: não a imprima como título.
1. Se o juízo for competente, siga normalmente.
2. Se for incompatível (ex.: juizado com causa acima do limite legal; vara especializada diante de matéria alheia; juízo comum diante de competência da Fazenda ou da Infância), o ÚNICO ato a minutar é a decisão de declínio, fundamentada na regra legal de competência, com remessa urgente.
3. No declínio, NÃO decida mérito nem medidas cautelares; apenas registre, com sua localização, as medidas urgentes pendentes (ex.: pessoa presa, prazo em curso, tutela requerida) e cientifique o juízo destinatário, para que o competente decida sem perecimento de direito.
4. Se houver dúvida real sobre a competência, diga objetivamente qual elemento falta para defini-la.
5. Juizado Especial (Lei 9.099/1995, art. 3º, § 2º): ficam excluídas as causas de natureza alimentar, falimentar, fiscal e de interesse da Fazenda Pública (salvo a Lei 12.153/2009), acidentes de trabalho, resíduos (inventário, arrolamento, sobrepartilha, alvará de herança) e estado e capacidade das pessoas (divórcio, guarda, interdição, filiação). Se o juízo indicado for Juizado e a matéria for uma dessas, o ato é a decisão de incompetência. No Juizado não há condenação em custas nem honorários em primeiro grau (arts. 54 e 55 da Lei 9.099/1995), salvo recorrente vencido ou litigância de má-fé.`;

export const REGRA_AREA_PELA_CAPA = `

[ÁREA DO ATO — DEFINIDA PELA CLASSE DA CAPA]
Identifique a área (cível, família, criminal, infracional, execução penal, fazenda, eleitoral etc.) pela CLASSE PROCESSUAL da capa e pelo conteúdo dos autos. Se divergir da "área" ou do modelo informados na solicitação, prevalece a classe da capa. Use apenas institutos e diplomas do ramo do feito: não aplique gratuidade da justiça, tutela do art. 300 do CPC ou outro instituto cível em feito criminal, nem o inverso. Os títulos de etapas internas (teses do gabinete, checklist, matriz, controle final) são apoio de raciocínio e NUNCA aparecem na minuta.`;

export const REGRA_PECA_DA_PARTE = `

[PEDIDOS E MANIFESTAÇÕES DE PARTE — SÓ COM A PEÇA LOCALIZADA]
Só afirme que uma parte, o Ministério Público, a Defensoria, a Fazenda ou terceiro requereu, pugnou, manifestou-se, opinou ou concordou se indicar, no mesmo período, a movimentação, o arquivo e a página da peça (Mov./Arq./Pág.). Se não houver peça, escreva expressamente "não consta manifestação de [parte] nos autos" e decida com o que existe. Um modelo ou roteiro que pressuponha o pedido NÃO autoriza afirmá-lo.`;

export const REGRA_FATO_DOCUMENTADO = `

[FATOS MATERIAIS E HISTÓRICO DE PARTE — SÓ O QUE O DOCUMENTO REGISTRA]
1. Só afirme que um bem foi encontrado, apreendido, entregue, restituído, depositado ou pago se citar o termo, o laudo ou o comprovante (Mov./Arq./Pág.). Se a narrativa menciona bens que nenhum documento registra, diga expressamente que não há registro da sua localização.
2. Ao qualificar um bem, indique o titular conforme o documento de titularidade ou de entrega e, se for outra pessoa, quem o possuía ou detinha; não atribua propriedade a quem só detinha.
3. Ao usar antecedentes, registros ou histórico processual de uma parte, cite cada item como consta do documento (tipo, data e natureza) e NÃO crie classificações agregadas que o documento não traz (ex.: "crimes contra o patrimônio", "reiteração", "inadimplente contumaz"). Não trate registro policial ou inquérito como condenação.`;

export const REGRA_PARTES_FALECIDAS = `

[PARTE FALECIDA]
Pessoa que já morreu não figura como parte viva: no cabeçalho e nas qualificações use "Espólio de NOME" (representado pelo inventariante) ou os sucessores habilitados, conforme os autos. Se os autos tratam a pessoa falecida como parte (ex.: ação contra os "espólios" de A e B), o cabeçalho deve dizer "Espólio de A" e "Espólio de B".`;

export const REGRA_LINGUAGEM_E_FECHO = `

[LINGUAGEM E FECHO]
Toda expressão latina vem traduzida entre parênteses na primeira ocorrência. O fecho da minuta reproduz o nome da comarca e do juízo exatamente como constam na capa dos autos, sem abreviar.`;

/** Conjunto completo, para as minutas (etapa 1, etapa 2 e Turbo). */
export const REGRAS_MECANICA_JUDICIAL = REGRA_COMPETENCIA_PRIMEIRO + REGRA_AREA_PELA_CAPA + REGRA_PECA_DA_PARTE + REGRA_FATO_DOCUMENTADO + REGRA_PARTES_FALECIDAS + REGRA_LINGUAGEM_E_FECHO;
/** Parte de fidelidade (sem competência/área), para módulos que não redigem o ato (Mesa de Audiência, ata, copiloto). */
export const REGRAS_FIDELIDADE_AUTOS = REGRA_PECA_DA_PARTE + REGRA_FATO_DOCUMENTADO;

// ===== Conferências sem IA =====
const textoDe = (m: any): string => { try { return typeof m === "string" ? m : JSON.stringify(m || {}); } catch { return ""; } };

/** Juizado/vara incompatível: capa em Juizado e autos dizendo que não é menor potencial ofensivo, sem declínio na minuta. */
const MATERIA_FORA_DO_JUIZADO: Array<[RegExp, string]> = [
  [/invent[áa]rio|arrolamento|sobrepartilha|alvar[áa] judicial|ado[çc][ãa]o de heran[çc]a/i, "resíduos (inventário, arrolamento, sobrepartilha)"],
  [/div[óo]rcio|dissolu[çc][ãa]o de uni[ãa]o est[áa]vel|guarda\b|interdi[çc][ãa]o|curatela|investiga[çc][ãa]o de (?:paternidade|maternidade)|ado[çc][ãa]o\b|tutela de menor/i, "estado e capacidade das pessoas (família)"],
  [/a[çc][ãa]o de alimentos|execu[çc][ãa]o de alimentos|cumprimento de (?:senten[çc]a|decis[ãa]o) de alimentos|revisional de alimentos|exonera[çc][ãa]o de alimentos/i, "natureza alimentar"],
  [/fal[êe]ncia|recupera[çc][ãa]o judicial|recupera[çc][ãa]o extrajudicial/i, "matéria falimentar"],
  [/execu[çc][ãa]o fiscal/i, "matéria fiscal"],
  [/acidente de trabalho|acident[áa]ria/i, "acidente de trabalho"],
];
/** Juizado indicado no cabeçalho/unidade da minuta (ou na capa) com matéria que a Lei 9.099 exclui, ou sentença de Juizado que condena em custas/honorários. */
export function avisoJuizadoMateria(minuta: any, autos: string): { juizo: string; motivo: string } | null {
  const m: any = minuta && typeof minuta === "object" ? minuta : {};
  const unidade = [m.header, m.judicialUnit, m.vara, m.comarca].filter((x: any) => typeof x === "string").join(" ");
  const capa = String(autos || "").slice(0, 8000);
  if (!/juizado\s+especial|\bjec\b/i.test(unidade) && !/Ju[ií]zo:\s*[^\n]{0,80}juizado/i.test(capa)) return null;
  const juizo = ((unidade.match(/Juizado Especial[^\n,.;]{0,60}/i) || [])[0] || "Juizado Especial indicado na minuta").trim();
  const base = `${capa}\n${typeof m.title === "string" ? m.title : ""}\n${typeof m.relatorio === "string" ? m.relatorio.slice(0, 1800) : ""}`;
  const motivos: string[] = [];
  for (const [re, nome] of MATERIA_FORA_DO_JUIZADO) { const x = re.exec(base); if (x) { motivos.push(`a matéria (“${x[0].toLowerCase()}”) está fora da competência dos Juizados: ${nome} (Lei 9.099/1995, art. 3º, § 2º)`); break; } }
  const disp = typeof m.dispositivo === "string" ? m.dispositivo : "";
  if (/\b(?:condeno|condenar|arcar|pagamento)\b[^.\n]{0,80}\b(?:custas|honor[áa]rios)/i.test(disp) && !/recorrente|m[áa]-f[ée]|art(?:igo)?\.?\s*5[45]\b/i.test(disp)) motivos.push("o dispositivo condena em custas ou honorários, mas no Juizado não há essa condenação em primeiro grau (Lei 9.099/1995, arts. 54 e 55), salvo recorrente vencido ou litigância de má-fé");
  return motivos.length ? { juizo, motivo: motivos.join("; ") } : null;
}

export function avisoCompetencia(minuta: any, autos: string): { juizo: string; motivo: string } | null {
  { const j = avisoJuizadoMateria(minuta, autos); if (j) return j; }
  const a = String(autos || ""), capa = a.slice(0, 8000);
  const juizo = ((capa.match(/Ju[ií]zo:\s*([^\n]{5,140})/i) || [])[1] || "").trim();
  if (!/juizado/i.test(juizo) && !/Juizado Especial/i.test(capa)) return null;
  const naoMenor = /n[aã]o se trata de infra[cç][aã]o de menor potencial ofensivo/i.test(a);
  if (!naoMenor) return null;
  if (/incompet[eê]ncia|decl[ií]n/i.test(textoDe(minuta))) return null;
  return { juizo: juizo || "Juizado indicado na capa", motivo: "os autos afirmam que a infração não é de menor potencial ofensivo, mas a minuta não declina da competência" };
}

/** Junta todos os textos (valores string) da minuta, em linhas. */
const soTextos = (m: any, acc: string[] = []): string[] => { if (typeof m === "string") acc.push(m); else if (Array.isArray(m)) m.forEach((x) => soTextos(x, acc)); else if (m && typeof m === "object") Object.values(m).forEach((x) => soTextos(x, acc)); return acc; };

/** Frases que atribuem pedido/manifestação a uma parte sem Mov./Arq./Pág. no mesmo período. */
export function verificarPedidosSemPeca(minuta: any): string[] {
  const t = soTextos(minuta).join("\n").replace(/\b(Mov|Arq|P[aá]gs?|fls|arts?|n[ºo°]|Dr|Dra)\./gi, "$1\u0001");      // abreviaturas não encerram a frase
  const achados: string[] = [];
  for (const m of t.matchAll(/[^.\n]{0,160}\b(?:pugnou|requereu|manifestou-se|opinou|postulou)\b[^.\n]{0,200}\.?/gi)) {
    const frase = m[0].replace(/\u0001/g, ".").trim();
    if (!/Mov\.?\s*\d/i.test(frase) && !/n[aã]o consta/i.test(frase)) achados.push(frase.slice(0, 220));
  }
  return [...new Set(achados)].slice(0, 5);
}

const TITULOS_INTERNOS = /DA APLICA[CÇ][AÃ]O DAS? TESES|CADERNO DE TESES|TESES E DIRETRIZES DO GABINETE|CHECKLIST|MATRIZ DE|CONTROLE FINAL|ETAPA INTERNA/gi;
/** Títulos de etapas internas que vazaram para a minuta. */
export function avisoVazamentoInterno(minuta: any): string[] {
  return [...new Set([...textoDe(minuta).matchAll(TITULOS_INTERNOS)].map((m) => m[0].toUpperCase()))];
}

/** Citações "Mov. X, Arq. Y, Pág. Z" cujo arquivo ou página não existe nos carimbos dos autos ("Movimentacao N : ... Arquivo M: nome - Pag.K/T"). null = autos sem carimbos suficientes. */
export function citacoesInvalidas(minuta: any, autos: string): string[] | null {
  const mapa = new Map<string, number>(), movs = new Set<number>();
  for (const m of String(autos || "").matchAll(/Movimenta[cç][aã]o\s+(\d{1,4})\s*:[^\n]*?Arquivo\s+(\d{1,3})\s*:[^\n]*?Pag\.\s*(\d{1,4})\s*\/\s*(\d{1,4})/gi)) { mapa.set(`${m[1]}|${m[2]}`, Number(m[4])); movs.add(Number(m[1])); }
  if (movs.size < 3) return null;
  const invalidas = new Set<string>();
  for (const c of textoDe(minuta).matchAll(/Mov\.?\s*(\d{1,4})\s*,\s*Arq\.?\s*(\d{1,3})\s*,\s*P[aá]gs?\.?\s*(\d{1,4})/gi)) {
    if (!movs.has(Number(c[1]))) continue;      // movimentação inexistente já é tratada por verificarLocalizacoes
    const total = mapa.get(`${Number(c[1])}|${Number(c[2])}`);
    if (total === undefined || Number(c[3]) > total) invalidas.add(c[0].replace(/\s+/g, " "));
  }
  return [...invalidas].slice(0, 10);
}

const semAcentoM = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Pessoa que já morreu não pode aparecer como parte viva no cabeçalho: quando os autos (ou o relatório) tratam o nome como "espólio de NOME", o cabeçalho passa a "Espólio de NOME". Devolve os nomes ajustados. */
export function qualificarEspolios(minuta: any, autos: string): string[] {
  const ajustados: string[] = [];
  const p = minuta?.parties; if (!p || typeof p !== "object") return ajustados;
  const base = semAcentoM(`${String(autos || "").slice(0, 400000)}\n${typeof minuta.relatorio === "string" ? minuta.relatorio : ""}`).replace(/\s+/g, " ");
  for (const k of ["author", "defendant"] as const) {
    const nome = typeof p[k] === "string" ? p[k].trim() : ""; if (nome.length < 5 || /^esp[óo]lio/i.test(nome)) continue;
    const n = semAcentoM(nome).replace(/\s+/g, " ");
    const ancora = n.split(" ").slice(0, 3).join(" ");      // primeiros nomes bastam para achar "espólio de FULANO DA SILVA"
    if (ancora.length < 5) continue;
    const re = new RegExp(`esp[oó]lios?\\s+(?:de\\s+|dos?\\s+(?:falecid[oa]s?\\s+)?)?(?:[a-z ,]{0,120}\\s(?:e|,)\\s+)?(?:${ancora.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`);
    if (re.test(base)) { p[k] = `Espólio de ${nome}`; ajustados.push(nome); }
  }
  return ajustados;
}

/** Indeferimento da inicial: o fundamento completo é art. 321, p. único, c/c art. 330, IV, e art. 485, I; o art. 485, § 3º, não serve para o inciso I. */
export function avisoFundamentoIndeferimento(minuta: any): string[] {
  const t = soTextos(minuta).join("\n");
  const indeferiu = /\bindefiro\s+a\s+(?:peti[çc][ãa]o\s+)?inicial|\bindeferimento\s+da\s+(?:peti[çc][ãa]o\s+)?inicial|\bindeferir\s+a\s+peti[çc][ãa]o\s+inicial/i.test(t);
  if (!indeferiu) return [];
  const out: string[] = [];
  if (/art(?:igo)?s?\.?\s*485\s*,?\s*(?:do\s+CPC\s*,?\s*)?§\s*3[º°o]?/i.test(t)) out.push("O art. 485, § 3º, do CPC trata das matérias dos incisos IV, V, VI e IX; não fundamenta o indeferimento da inicial (inciso I). Fundamente em art. 321, parágrafo único, c/c art. 330, IV, e art. 485, I.");
  if (!/\b330\b[^.\n]{0,40}\bIV\b|\bIV\b[^.\n]{0,20}\bart(?:igo)?\.?\s*330/i.test(t) && /\b321\b/.test(t)) out.push("Indeferimento da inicial por descumprimento de emenda: falta citar o art. 330, IV, do CPC (inicial indeferida quando não atendido o art. 321).");
  return out;
}

export interface AvisosMecanica {
  avisoCompetencia?: { juizo: string; motivo: string };
  avisoPedidoSemPeca?: string[];
  avisoVazamento?: string[];
  avisoCitacao?: string[];
  espolioQualificado?: string[];
  avisoFundamentoLegal?: string[];
}
/** Roda todas as conferências sobre a minuta pronta; só devolve o que achou. Nunca lança erro. */
export function conferenciasMecanica(minuta: any, autos: string): AvisosMecanica {
  const out: AvisosMecanica = {};
  try { const f = avisoFundamentoIndeferimento(minuta); if (f.length) out.avisoFundamentoLegal = f; } catch { /* idem */ }
  try { const e = qualificarEspolios(minuta, autos); if (e.length) out.espolioQualificado = e; } catch { /* idem */ }
  try { const c = avisoCompetencia(minuta, autos); if (c) out.avisoCompetencia = c; } catch { /* a conferência nunca derruba a minuta */ }
  try { const p = verificarPedidosSemPeca(minuta); if (p.length) out.avisoPedidoSemPeca = p; } catch { /* idem */ }
  try { const v = avisoVazamentoInterno(minuta); if (v.length) out.avisoVazamento = v; } catch { /* idem */ }
  try { const i = citacoesInvalidas(minuta, autos); if (i && i.length) out.avisoCitacao = i; } catch { /* idem */ }
  return out;
}
