// Chamada do mapa do processo a partir da tela: só para autos com 130 movimentações ou mais. Se falhar, a análise segue normalmente, sem o mapa.
import { toast } from "react-hot-toast";
import { getApiHeaders } from "./apiKeyManager";
import { MOVIMENTACOES_PARA_MAPA, resumirMovimentacoes, type MapaProcesso } from "./mapaDoProcesso";

export interface MapaDaExecucao { mapa: MapaProcesso; bloco: string }

export async function prepararMapaDoProcesso(autos: string, progId: string): Promise<MapaDaExecucao | null> {
  let toastId: string | undefined;
  try {
    const r = resumirMovimentacoes(autos);
    if (r.movs < MOVIMENTACOES_PARA_MAPA || autos.length < 2000) return null;
    toastId = toast.loading(`Processo com ${r.movs} movimentações: montando o mapa do processo (leitura completa, pode levar alguns minutos)…`, { duration: 600000 });
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25 * 60_000);
    let txt = "";
    try {
      const resp = await fetch("/api/mapa-processo", { method: "POST", headers: getApiHeaders({ "x-progresso-id": progId }), body: JSON.stringify({ processText: autos }), signal: ctl.signal });
      txt = await resp.text();
    } finally { clearTimeout(to); }
    let j: any = {}; try { j = JSON.parse(txt.trim()); } catch { /* resposta incompleta */ }
    if (!j?.mapa || typeof j.bloco !== "string") { console.warn("[Mapa do processo] indisponível:", j?.error || txt.slice(0, 200)); return null; }
    toast.success(`Mapa do processo pronto (${r.movs} movimentações, até a Mov. ${r.ultima}).`, { id: toastId, duration: 4000 }); toastId = undefined;
    return { mapa: j.mapa, bloco: j.bloco };
  } catch (e) {
    console.warn("[Mapa do processo] falhou; a análise segue sem o mapa:", e); return null;
  } finally { if (toastId) toast.dismiss(toastId); }
}
