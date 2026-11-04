import React from "react";
import { Clock } from "lucide-react";

/** Aviso fixo, no canto de baixo à esquerda (acima do botão "Cadastros", do Super Admin), quando há minutas que serão apagadas do Histórico em até 1 dia. */
export const AvisoVencimentoFixo: React.FC<{ qtd: number; onVer: () => void; acimaDeCadastros: boolean }> = ({ qtd, onVer, acimaDeCadastros }) => {
  if (qtd <= 0) return null;
  return (
    <div data-testid="aviso-vencimento-fixo" role="alert"
      className={`fixed left-4 z-40 max-w-[220px] rounded-xl border border-red-300 bg-red-50 text-red-900 shadow-lg p-2.5 text-[11px] leading-snug ${acimaDeCadastros ? "bottom-16" : "bottom-4"}`}>
      <div className="flex items-start gap-1.5"><Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600" />
        <span><strong>{qtd} minuta{qtd > 1 ? "s" : ""}</strong> {qtd > 1 ? "serão apagadas" : "será apagada"} do Histórico em 1 dia ou menos. Baixe o que quiser guardar.</span></div>
      <button onClick={onVer} data-testid="aviso-vencimento-ver" className="mt-1.5 w-full rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold py-1 cursor-pointer">Ver no Histórico</button>
    </div>
  );
};
