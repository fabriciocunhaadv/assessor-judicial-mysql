// Prêmio TJGO de Produtividade 2027 (Goianão), Edital 01/2026: apoio do Studio. NÃO calcula a pontuação oficial (que sai do DataJud, no painel do TJGO);
// mostra o que o gabinete produziu pelo Studio (inclusive as minutas do Agaia) no período avaliado e se o ato conta como julgamento no Anexo III.
import { TPU_POR_CATEGORIA, type CategoriaGoianao } from "../data/goianaoAnexoIII";

export const PERIODO_GOIANAO = { inicio: Date.parse("2026-08-01T00:00:00-03:00"), fim: Date.parse("2027-07-31T23:59:59-03:00") };
export const ROTULO_CATEGORIA: Record<CategoriaGoianao | "semMovimento" | "naoContaComoJulgamento", string> = {
  casoNovo: "Caso novo", suspensao: "Suspensão/sobrestamento", saidaSuspensao: "Saída de suspensão", arquivamentoProvisorio: "Arquivamento provisório",
  julgamentoMerito: "Julgamento com resolução do mérito", julgamentoSemMerito: "Julgamento sem resolução do mérito", homologatorio: "Julgamento homologatório (acordo)",
  medidaProtetiva: "Medida protetiva de urgência", magistradoH1: "Movimento de magistrado (hierarquia 1)", semMovimento: "Sem movimento TPU identificado", naoContaComoJulgamento: "Não é julgamento",
};
const CONTA_JULGAMENTO: CategoriaGoianao[] = ["julgamentoMerito", "julgamentoSemMerito", "homologatorio"];
// ordem de precedência quando o mesmo código aparece em mais de uma categoria
const ORDEM: CategoriaGoianao[] = ["julgamentoMerito", "julgamentoSemMerito", "homologatorio", "suspensao", "saidaSuspensao", "arquivamentoProvisorio", "medidaProtetiva", "casoNovo", "magistradoH1"];
export function categoriaDoTpu(codigo: number | string | null | undefined): CategoriaGoianao | null {
  const n = Number(String(codigo ?? "").replace(/\D/g, "")); if (!n) return null;
  return ORDEM.find((c) => TPU_POR_CATEGORIA[c].includes(n)) || null;
}

const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export interface AtoClassificado {
  id: string; processo: string; titulo: string; origem: string; tipoAto: "sentenca" | "decisao" | "despacho" | "outro";
  tpu: number | null; estimado: boolean; categoria: CategoriaGoianao | "semMovimento"; contaComoJulgamento: boolean;
  data: number; lancado: boolean; mes: string;
}
/** Classifica um ato do Histórico (gerado no Studio ou vindo do Agaia, pela extensão ou colado). Sem TPU gravado, estima pelo dispositivo (marcado como "estimado"). */
export function classificarAto(ato: any): AtoClassificado {
  const r = ato?.result || {}, m = r.minute || {};
  const titulo = String(m.title || ato?.promptTitle || "");
  const tpuObj = m.indicacaoTpuCnj || r.indicacaoTpuCnj || r.auditAnalysis?.indicacaoTpuCnj || null;
  const disp = semAcento(m.dispositivo || ""), t = semAcento(titulo + " " + (ato?.actType || ""));
  const ehSentenca = /senten/.test(t) || /\bjulgo\b|\bjulgo[- ]se\b|extingo o processo|homologo o acordo|homologo a transacao/.test(disp);
  const tipoAto: AtoClassificado["tipoAto"] = ehSentenca ? "sentenca" : /decis/.test(t) ? "decisao" : /despach/.test(t) ? "despacho" : "outro";
  let tpu: number | null = Number(String(tpuObj?.codigoTpu ?? "").replace(/\D/g, "")) || null, estimado = false;
  if (!tpu && ehSentenca) {      // estimativa pelo dispositivo, só para sentenças
    estimado = true;
    if (/parcialmente procedente|procedencia parcial|procedente em parte/.test(disp)) tpu = 221;
    else if (/improcedente|improcedencia|rejeito o pedido/.test(disp)) tpu = 220;
    else if (/homologo (o|a) (acordo|transacao)|homologo, por sentenca/.test(disp)) tpu = 466;
    else if (/julgo procedente|procedentes? os pedidos|procedencia/.test(disp)) tpu = 219;
    else if (/sem resolucao (do )?merito|extingo o processo|indefiro a (peticao )?inicial/.test(disp)) tpu = 459;
  }
  const cat = tpu ? categoriaDoTpu(tpu) : null;
  const categoria: AtoClassificado["categoria"] = cat || "semMovimento";
  const lancadoEm = Number(ato?.lancadoProjudi) || 0, data = lancadoEm || Number(ato?.date) || 0;
  const d = new Date(data - 3 * 3600_000);      // mês no horário de Brasília
  return {
    id: String(ato?.id || ""), processo: String(ato?.processNumber || m.processNumber || ""), titulo, origem: r.origemExterna ? `Agaia${r.origemExterna.sistema && !/agaia/i.test(r.origemExterna.sistema) ? ` (${r.origemExterna.sistema})` : ""}` : "Studio",
    tipoAto, tpu, estimado, categoria, contaComoJulgamento: !!cat && CONTA_JULGAMENTO.includes(cat),
    data, lancado: !!lancadoEm, mes: data ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "",
  };
}

export interface ResumoGoianao {
  periodo: { inicio: number; fim: number }; totalAtos: number; lancados: number;
  porOrigem: Record<string, number>; porTipo: Record<string, number>; porCategoria: Record<string, number>; porMes: Record<string, { atos: number; julgamentos: number }>;
  processosComJulgamento: number; julgamentosEstimados: number; semClassificacao: { processo: string; titulo: string; origem: string }[];
}
/** Resume os atos do período. "processosComJulgamento" conta cada processo uma vez (o edital só considera o primeiro julgamento ou baixa do processo). */
export function resumirGoianao(atos: any[], periodo = PERIODO_GOIANAO): ResumoGoianao {
  const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] || 0) + 1; };
  const R: ResumoGoianao = { periodo, totalAtos: 0, lancados: 0, porOrigem: {}, porTipo: {}, porCategoria: {}, porMes: {}, processosComJulgamento: 0, julgamentosEstimados: 0, semClassificacao: [] };
  const processos = new Set<string>();
  for (const a of atos) {
    const c = classificarAto(a);
    if (!c.data || c.data < periodo.inicio || c.data > periodo.fim) continue;
    R.totalAtos++; if (c.lancado) R.lancados++;
    inc(R.porOrigem, c.origem); inc(R.porTipo, c.tipoAto); inc(R.porCategoria, c.categoria);
    const mes = (R.porMes[c.mes] ||= { atos: 0, julgamentos: 0 }); mes.atos++;
    if (c.contaComoJulgamento) {
      mes.julgamentos++; if (c.estimado) R.julgamentosEstimados++;
      const chave = c.processo.replace(/\D/g, "") || c.id; if (!processos.has(chave)) processos.add(chave);
    } else if (c.tipoAto === "sentenca" && c.categoria === "semMovimento" && R.semClassificacao.length < 50) R.semClassificacao.push({ processo: c.processo, titulo: c.titulo, origem: c.origem });
  }
  R.processosComJulgamento = processos.size;
  return R;
}
