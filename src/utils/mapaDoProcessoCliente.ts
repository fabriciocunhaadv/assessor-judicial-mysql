// Chamada do mapa do processo a partir da tela: só para autos extensos (por volume de tokens). O trabalho roda em segundo plano
// (src/utils/mapaEmSegundoPlano.ts): grava cada parte lida, aparece no painel "Mapa do processo" e retoma depois de atualizar a página.
// Se falhar, a análise segue normalmente, sem o mapa.
import { toast } from "react-hot-toast";
import { gerenteMapas } from "./mapaEmSegundoPlano";
import { precisaDeMapa, resumirMovimentacoes, estimarTokens, type MapaProcesso } from "./mapaDoProcesso";

/** Autos que precisam do mapa e ainda não o têm: a montagem demora minutos, então o Turbo e a Etapa 1 não ficam esperando; o pedido segue em segundo plano (mapa + minuta + Histórico). */
export async function precisaDeSegundoPlano(autos: string): Promise<boolean> {
  try { return autos.length >= 2000 && precisaDeMapa(autos) && !(await gerenteMapas.pronto(autos)); } catch { return false; }
}

export interface MapaDaExecucao { mapa: MapaProcesso; bloco: string }

/** `forcar`: monta o mapa mesmo abaixo do tamanho mínimo (usado na leitura em lotes, onde o texto já é o dossiê). */
export async function prepararMapaDoProcesso(autos: string, _progId: string, opcoes: { forcar?: boolean } = {}): Promise<MapaDaExecucao | null> {
  let toastId: string | undefined;
  let desinscrever = () => {};
  try {
    const r = resumirMovimentacoes(autos);
    if (autos.length < 2000 || (!opcoes.forcar && !precisaDeMapa(autos))) return null;
    toastId = toast.loading(`Autos extensos (~${Math.round(estimarTokens(autos) / 1000)} mil tokens): montando o mapa do processo. Pode navegar por outras telas: o andamento aparece no selo "🗺️ Mapa" e continua se você atualizar a página.`, { duration: 600000 });
    const id = toastId;
    desinscrever = gerenteMapas.inscrever((ts) => { const t = ts.find((x) => ["planejando", "lendo", "consolidando"].includes(x.status) && x.texto === autos); if (t && t.partesTotal) toast.loading(`Mapa do processo: ${t.etapa} Pode navegar por outras telas; o selo "🗺️ Mapa" mostra o andamento.`, { id, duration: 600000 }); });
    const res = await gerenteMapas.garantir(autos);
    if (!res) { console.warn("[Mapa do processo] indisponível; a análise segue sem o mapa."); return null; }
    toast.success(`Mapa do processo pronto${r.movs ? ` (${r.movs} movimentações, até a Mov. ${r.ultima})` : ""}.`, { id: toastId, duration: 4000 }); toastId = undefined;
    return res;
  } catch (e) {
    console.warn("[Mapa do processo] falhou; a análise segue sem o mapa:", e); return null;
  } finally { desinscrever(); if (toastId) toast.dismiss(toastId); }
}
