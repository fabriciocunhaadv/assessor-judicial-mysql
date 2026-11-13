// Fase do processo no motor (itens 1–4 de 13/11/2026): dica de fase, filtro de teses por fase, conferência da minuta com UMA refeita e etiqueta do motor.
// Tudo depende de MOTORES_FASE (padrão: ligado). MOTORES_FASE=off no servidor volta ao comportamento anterior sem mexer em código.
import { detectarFase, blocoFaseParaMotor, filtrarTesesPorFase, nomeDaFase, type FaseDetectada } from "../src/utils/faseDoProcesso";
import { conferirMinutaComFase, type AvisoFase } from "../src/utils/conferenciaDaMinuta";

export const motoresFaseLigado = () => String(process.env.MOTORES_FASE || "on").toLowerCase() !== "off";
export type MotorDaMinuta = "principal" | "turbo" | "gigante";
const FASE_VAZIA: FaseDetectada = { fase: "indefinida", jaSentenciado: false, transitou: false, confianca: "baixa", sinais: [] };

/** Fase do processo para esta requisição (calculada uma vez por requisição). */
export function faseDaRequisicao(req: any, textoAutos: string): FaseDetectada {
  if (!motoresFaseLigado()) return FASE_VAZIA;
  if (req && req.__faseDet) return req.__faseDet;
  let f = FASE_VAZIA;
  try { f = detectarFase(String(textoAutos || "")); } catch { /* sem fase: o motor segue como antes */ }
  if (req) req.__faseDet = f;
  return f;
}
export const blocoFaseDaRequisicao = (req: any, textoAutos: string): string => { try { return blocoFaseParaMotor(faseDaRequisicao(req, textoAutos)); } catch { return ""; } };

/** Caderno de Teses sem os blocos de mérito quando o processo está em cumprimento/execução/embargos (com nota dizendo o que saiu). */
export function tesesPorFase(teses: string, f: FaseDetectada): { texto: string; omitidas: number } {
  if (!motoresFaseLigado() || !teses) return { texto: teses, omitidas: 0 };
  try {
    const r = filtrarTesesPorFase(teses, f);
    if (!r.removidos) return { texto: teses, omitidas: 0 };
    return { texto: `${r.texto}\n\n[NOTA DO SISTEMA: ${r.removidos} bloco(s) de tese de MÉRITO do Caderno (${r.titulos.map((t) => `“${t}”`).join("; ")}) não foram enviados porque o processo está em ${nomeDaFase(f.fase)}; o mérito já foi decidido. Se a questão pendente exigir alguma delas, use só na medida em que a lei permita na fase.]`, omitidas: r.removidos };
  } catch { return { texto: teses, omitidas: 0 }; }
}

export const motorDaRequisicao = (req: any, padrao: MotorDaMinuta): MotorDaMinuta => {
  const b = req?.body || {};
  if (padrao === "principal" && (b?.coberturaLeitura?.escolha === "gigante" || (typeof b?.mapaProcesso === "string" && b.mapaProcesso.startsWith("[MAPA DO PROCESSO") && b?.indiceArquivosCompleto !== undefined))) return "gigante";
  return padrao;
};

export interface ConferenciaFase { fase: string; confianca: string; sinais: string[]; avisos: string[]; refeita: boolean; resolvido: boolean; tesesOmitidas: number }
const SISTEMA_CORRECAO = `Você corrige UMA minuta judicial já pronta que invadiu a fase do processo. Faça a MENOR alteração possível: mantenha título, relatório (com as citações Mov./Arq./Pág.), partes, valores e datas; reescreva só a fundamentação e o dispositivo naquilo que a fase exige, sem inventar fatos. Texto corrido, em português claro, pronto para uso, sem comentários seus.
Responda SOMENTE com JSON válido: {"title":"...","relatorio":"...","fundamentacao":"...","dispositivo":"...","closing":"...","fullFormattedText":"..."} ("fullFormattedText" é o documento COMPLETO, do cabeçalho ao fecho, com as mesmas partes).`;

/**
 * Confere a minuta com a fase (por código). Achando invasão de fase, refaz UMA vez (chamarIA devolve o texto JSON da IA) e confere de novo.
 * Nunca derruba a minuta: qualquer falha devolve a original. Se persistir o problema, a minuta segue com o aviso em `conferenciaFase`.
 */
export async function conferirERefazerPorFase(minute: any, f: FaseDetectada, chamarIA: (sistema: string, usuario: string) => Promise<string>, tesesOmitidas = 0): Promise<{ minute: any; conferencia: ConferenciaFase | null }> {
  if (!motoresFaseLigado() || !minute) return { minute, conferencia: null };
  const base = (avisos: AvisoFase[], refeita: boolean, resolvido: boolean): ConferenciaFase => ({ fase: f.fase, confianca: f.confianca, sinais: f.sinais, avisos: avisos.map((a) => a.mensagem), refeita, resolvido, tesesOmitidas });
  let avisos: AvisoFase[] = [];
  try { avisos = conferirMinutaComFase(minute, f); } catch { return { minute, conferencia: null }; }
  if (!avisos.length) return { minute, conferencia: f.fase === "indefinida" && !tesesOmitidas ? null : base([], false, true) };
  try {
    const usuario = `${blocoFaseParaMotor(f)}\n\nPROBLEMAS A CORRIGIR:\n${avisos.map((a, i) => `${i + 1}. ${a.instrucao}`).join("\n")}\n\n[MINUTA A CORRIGIR]\nTÍTULO: ${minute.title || ""}\nRELATÓRIO:\n${minute.relatorio || ""}\n\nFUNDAMENTAÇÃO:\n${minute.fundamentacao || ""}\n\nDISPOSITIVO:\n${minute.dispositivo || ""}\n\nFECHO:\n${minute.closing || ""}\n\nDOCUMENTO COMPLETO:\n${minute.fullFormattedText || ""}`;
    const txt = await chamarIA(SISTEMA_CORRECAO, usuario);
    const q: any = JSON.parse(String(txt || "{}").replace(/^```(?:json)?|```$/gim, "").trim());
    const nova = { ...minute, title: String(q.title || minute.title || ""), relatorio: String(q.relatorio || ""), fundamentacao: String(q.fundamentacao || ""), dispositivo: String(q.dispositivo || ""), closing: String(q.closing || minute.closing || ""), fullFormattedText: String(q.fullFormattedText || "") };
    const completa = nova.relatorio.length >= 50 && nova.dispositivo.length >= 30 && nova.fullFormattedText.length >= 200;
    if (!completa) return { minute, conferencia: base(avisos, true, false) };
    const depois = conferirMinutaComFase(nova, f);
    if (depois.length) return { minute, conferencia: base(depois.length < avisos.length ? depois : avisos, true, false) };      // a refeita não resolveu: mantém a original, com o aviso
    return { minute: nova, conferencia: base(avisos, true, true) };
  } catch { return { minute, conferencia: base(avisos, false, false) }; }
}
