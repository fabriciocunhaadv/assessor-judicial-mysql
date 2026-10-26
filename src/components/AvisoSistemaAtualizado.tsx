import React, { useState } from "react";

const CHAVE = "assessor_aviso_sistema_atualizado_v1";
const jaFechado = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } };

/** Faixa simples no topo: avisa que esta é a versão atualizada do sistema, com a nova conexão ao banco de dados. Não mostra nome de banco nem de servidor. Pode ser fechada (fica lembrado neste navegador). */
export const AvisoSistemaAtualizado: React.FC = () => {
  const [fechado, setFechado] = useState(jaFechado);
  if (fechado) return null;
  const fechar = () => { setFechado(true); try { localStorage.setItem(CHAVE, "1"); } catch { /* sem armazenamento: vale até recarregar */ } };
  return (
    <div role="status" data-testid="aviso-sistema-atualizado" className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 text-xs sm:text-[13px] font-semibold bg-emerald-50 text-emerald-900 border-b border-emerald-200">
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      <span className="text-center">Você está navegando no sistema atualizado, com a nova conexão ao banco de dados.</span>
      <button onClick={fechar} aria-label="Fechar aviso" className="shrink-0 px-2 text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
    </div>
  );
};
