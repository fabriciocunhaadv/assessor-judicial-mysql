import React, { useEffect, useState } from "react";
import { entradasExternas, type EntradaExterna } from "../utils/entradaExterna";

const ROTULO: Record<EntradaExterna["status"], string> = { recebida: "Recebida", gravando: "Gravando no Histórico…", gravada: "✔ No Histórico", tentando: "⚠ Tentando de novo" };

// Selo discreto (canto inferior esquerdo) com as minutas que chegaram do Agaia e estão sendo gravadas em segundo plano. Não interrompe o que a pessoa está fazendo.
export function EntradaAgaia({ onVerHistorico }: { onVerHistorico?: () => void }) {
  const [lista, setLista] = useState<EntradaExterna[]>([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { void entradasExternas.carregar(); return entradasExternas.inscrever(setLista); }, []);
  if (lista.length === 0) return null;
  const pendentes = lista.filter((e) => e.status !== "gravada").length;
  return (
    <>
      <button onClick={() => setAberto((v) => !v)} className="fixed bottom-[5.5rem] left-3 z-[8998] px-3 py-2 rounded-full bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-lg border border-teal-400 cursor-pointer flex items-center gap-2" data-testid="agaia-selo" title="Minutas que chegaram do Agaia">
        <span>🤖 Agaia</span>
        <span className="px-1.5 rounded-full bg-white/20">{pendentes > 0 ? `${pendentes} gravando` : `${lista.length} no Histórico`}</span>
      </button>
      {aberto && (
        <div className="fixed bottom-[8.5rem] left-3 z-[9000] w-[min(96vw,28rem)] max-h-[60vh] overflow-y-auto bg-white text-slate-800 rounded-2xl shadow-2xl border border-teal-300 p-3 space-y-2" data-testid="agaia-painel">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-teal-900">🤖 Minutas do Agaia</h3><button onClick={() => setAberto(false)} className="text-xs text-slate-500 cursor-pointer">fechar</button></div>
          <p className="text-[11px] text-slate-600 leading-snug">As minutas feitas no Agaia chegam pela esteira e são gravadas no Histórico em segundo plano, na unidade da serventia e com o prompt usado. Você não precisa esperar: continue trabalhando e abra o Histórico depois. Se a internet cair ou a página for atualizada, a gravação continua sozinha quando voltar.</p>
          {lista.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-200 p-2 text-[11px] space-y-0.5" data-testid="agaia-item">
              <div className="flex items-center justify-between gap-2"><span className="font-bold truncate">{e.processo}</span><span className={`px-1.5 rounded-full text-[10px] font-bold ${e.status === "gravada" ? "bg-emerald-100 text-emerald-800" : e.status === "tentando" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>{ROTULO[e.status]}</span></div>
              <div className="text-slate-500 truncate">{e.prompt || ""}</div>
              {e.erro && e.status !== "gravada" && <div className="text-amber-700">{e.erro}</div>}
              <div className="flex gap-2 pt-0.5">
                {e.status === "gravada" && onVerHistorico && <button onClick={onVerHistorico} className="px-2 py-0.5 rounded bg-teal-700 text-white font-bold cursor-pointer">Abrir o Histórico</button>}
                {e.status === "tentando" && <button onClick={() => void entradasExternas.retomar()} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Tentar agora</button>}
                {e.status === "gravada" && <button onClick={() => void entradasExternas.remover(e.id)} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Remover da lista</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
