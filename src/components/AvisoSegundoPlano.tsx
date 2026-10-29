import React, { useEffect, useState } from "react";

export interface AvisoDoSegundoPlano { titulo: string; texto: string }
/** Dispara o aviso (usado quando o Turbo entrega o processo ao segundo plano e se fecha). */
export const avisarSegundoPlano = (a: AvisoDoSegundoPlano) => { try { window.dispatchEvent(new CustomEvent("segundoplano:aviso", { detail: a })); } catch { /* sem janela */ } };

// Aviso no centro da tela: diz o que aconteceu e o usuário clica em OK e segue trabalhando no sistema.
export function AvisoSegundoPlano() {
  const [aviso, setAviso] = useState<AvisoDoSegundoPlano | null>(null);
  useEffect(() => {
    const ouvir = (e: Event) => setAviso((e as CustomEvent).detail || null);
    window.addEventListener("segundoplano:aviso", ouvir);
    return () => window.removeEventListener("segundoplano:aviso", ouvir);
  }, []);
  if (!aviso) return null;
  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/50 p-4" data-testid="aviso-segundo-plano" role="dialog" aria-modal="true">
      <div className="w-[min(96vw,30rem)] bg-white text-slate-800 rounded-2xl shadow-2xl border border-violet-300 p-5 space-y-3">
        <h3 className="text-base font-black text-violet-900">🗺️ {aviso.titulo}</h3>
        <p className="text-sm leading-relaxed whitespace-pre-line">{aviso.texto}</p>
        <div className="flex justify-end"><button autoFocus onClick={() => setAviso(null)} className="px-5 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-bold cursor-pointer" data-testid="aviso-segundo-plano-ok">OK</button></div>
      </div>
    </div>
  );
}
