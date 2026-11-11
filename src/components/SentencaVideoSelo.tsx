import React, { useSyncExternalStore } from "react";
import { filaSentencaVideo } from "../utils/sentencaComVideo";

/** Quadro fixo (canto inferior esquerdo) com o andamento das sentenças com vídeo que a esteira da extensão entregou ao Studio: a fila roda sem tela. */
export function SentencaVideoSelo({ aoAbrirHistorico }: { aoAbrirHistorico?: () => void }) {
  const itens = useSyncExternalStore(filaSentencaVideo.assinar, filaSentencaVideo.lista, filaSentencaVideo.lista);
  if (!itens.length) return null;
  return (
    <div className="fixed left-3 bottom-16 z-[60] w-80 max-w-[calc(100vw-1.5rem)] space-y-2" data-testid="selo-sentenca-video">
      {itens.map((i) => (
        <div key={i.reqId} className={`rounded-xl border shadow-lg p-3 text-xs bg-white text-slate-800 ${i.estado === "erro" ? "border-red-300" : i.estado === "ok" ? "border-emerald-300" : "border-indigo-300"}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="font-bold">{i.estado === "ok" ? "✅" : i.estado === "erro" ? "⚠" : "🎙"} Sentença com vídeo · <span className="font-mono">{i.processo || "processo"}</span></div>
            {i.estado !== "rodando" && <button className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Fechar" onClick={() => filaSentencaVideo.remover(i.reqId)}>✕</button>}
          </div>
          <div className="mt-1 text-slate-600">{i.estado === "erro" ? i.erro : i.texto}</div>
          {i.estado === "rodando" && <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.max(5, Math.min(100, i.pct))}%` }} /></div>}
          {i.estado === "ok" && aoAbrirHistorico && <button onClick={aoAbrirHistorico} className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">Abrir Histórico</button>}
        </div>
      ))}
    </div>
  );
}
