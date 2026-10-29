import React, { useEffect, useState } from "react";
import { gerenteMapas, VALIDADE_MAPA_MS, type TarefaMapa } from "../utils/mapaEmSegundoPlano";
import { useUmAbertoPorVez, CLASSE_PAINEL_FLUTUANTE } from "../utils/flutuantes";

const ATIVO = (s: TarefaMapa["status"]) => ["planejando", "lendo", "consolidando"].includes(s);
const ROTULO: Record<TarefaMapa["status"], string> = { planejando: "Preparando", lendo: "Lendo os autos", consolidando: "Amarrando", concluido: "Pronto", erro: "Erro", cancelado: "Cancelado" };

// Selo fixo (canto inferior esquerdo, acima do dos Gigantes) com o andamento do mapa do processo, que roda em segundo plano e retoma depois de atualizar a página.
export function MapaSegundoPlano() {
  const [tarefas, setTarefas] = useState<TarefaMapa[]>([]);
  const [aberto, setAberto] = useState(false);
  useUmAbertoPorVez("mapa", aberto, () => setAberto(false));
  useEffect(() => { void gerenteMapas.carregar(); return gerenteMapas.inscrever(setTarefas); }, []);
  // resumo legível pela extensão: enquanto o app monta o mapa, a esteira não conta esse tempo nos limites de espera da análise
  useEffect(() => {
    try { document.documentElement.dataset.mapas = JSON.stringify(tarefas.map((t) => ({ id: t.id, processo: t.numeroProcesso || "", status: t.status, feitas: t.partesFeitas, total: t.partesTotal }))); } catch { /* ignora */ }
  }, [tarefas]);
  const visiveis = tarefas.filter((t) => t.status !== "cancelado");
  const ativos = visiveis.filter((t) => ATIVO(t.status));
  if (visiveis.length === 0) return null;
  const pct = (t: TarefaMapa) => (t.status === "consolidando" ? 95 : t.partesTotal ? Math.round((t.partesFeitas / t.partesTotal) * 90) : 2);
  return (
    <>
      <button onClick={() => setAberto((v) => !v)} className="fixed bottom-[3.75rem] left-3 z-[8999] px-3 py-2 rounded-full bg-violet-700 hover:bg-violet-600 text-white text-xs font-bold shadow-lg border border-violet-400 cursor-pointer flex items-center gap-2" data-testid="mapa-selo" title="Mapa do processo, em segundo plano">
        <span>🗺️ Mapa</span>
        {ativos.length > 0 ? <span className="px-1.5 rounded-full bg-white/20">{ativos.length} em andamento · {pct(ativos[0])}%</span> : <span className="px-1.5 rounded-full bg-white/20">{visiveis.length}</span>}
      </button>
      {aberto && (
        <div className={`${CLASSE_PAINEL_FLUTUANTE} w-[min(96vw,28rem)] overflow-y-auto bg-white text-slate-800 rounded-2xl shadow-2xl border border-violet-300 p-3 space-y-2`} data-testid="mapa-painel">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-violet-900">🗺️ Mapa do processo (segundo plano)</h3><button onClick={() => setAberto(false)} className="text-xs text-slate-500 cursor-pointer">fechar</button></div>
          <p className="text-[11px] text-slate-600 leading-snug">A leitura completa dos autos continua se você navegar por outras telas ou atualizar a página: cada parte lida fica guardada neste navegador. Quando o mapa fica pronto, rode o Turbo ou a Etapa 1 de novo: o mapa pronto é reaproveitado na hora. <strong>Este histórico temporário é removido automaticamente 24 horas depois de pronto</strong>; se o processo voltar depois disso, o mapa é refeito.</p>
          {visiveis.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 p-2 text-[11px] space-y-1" data-testid="mapa-item">
              <div className="flex items-center justify-between gap-2"><span className="font-bold truncate">{t.numeroProcesso || t.nome}</span><span className={`px-1.5 rounded-full text-[10px] font-bold ${t.status === "concluido" ? "bg-emerald-100 text-emerald-800" : t.status === "erro" ? "bg-red-100 text-red-800" : "bg-violet-100 text-violet-800"}`}>{ROTULO[t.status]}</span></div>
              <div className="text-slate-600">{t.etapa}{t.partesFalhas > 0 && t.status !== "concluido" ? ` (${t.partesFalhas} parte(s) com falha)` : ""}</div>
              {ATIVO(t.status) && <div className="h-1.5 bg-slate-200 rounded"><div className="h-1.5 bg-violet-600 rounded" style={{ width: `${pct(t)}%` }} /></div>}
              {t.erro && <div className="text-red-700">{t.erro}</div>}
              {!ATIVO(t.status) && <div className="text-[10px] text-slate-500">{(() => { const h = Math.max(0, Math.ceil((t.atualizadoEm + VALIDADE_MAPA_MS - Date.now()) / 3600_000)); return h <= 1 ? "Será removido automaticamente em menos de 1 hora." : `Será removido automaticamente em cerca de ${h} horas.`; })()}</div>}
              <div className="flex gap-2">
                {t.status === "erro" && t.texto && <button onClick={() => void gerenteMapas.tentarDeNovo(t.id)} className="px-2 py-0.5 rounded bg-violet-700 text-white font-bold cursor-pointer">Tentar de novo</button>}
                {ATIVO(t.status) && <button onClick={() => void gerenteMapas.cancelarTarefa(t.id)} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Cancelar</button>}
                {!ATIVO(t.status) && <button onClick={() => void gerenteMapas.remover(t.id)} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Remover</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
