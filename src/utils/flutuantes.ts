import { useEffect } from "react";
// Os painéis flutuantes (Gigantes, Mapa, Agaia) abrem um de cada vez, ao lado do menu (não por cima dele nem uns sobre os outros).
export function useUmAbertoPorVez(nome: string, aberto: boolean, fechar: () => void) {
  useEffect(() => { if (aberto) window.dispatchEvent(new CustomEvent("flutuante:abriu", { detail: nome })); }, [aberto, nome]);
  useEffect(() => {
    const f = (e: Event) => { if ((e as CustomEvent).detail !== nome) fechar(); };
    window.addEventListener("flutuante:abriu", f);
    return () => window.removeEventListener("flutuante:abriu", f);
  }, [nome]);      // eslint-disable-line react-hooks/exhaustive-deps
}
/** Posição comum dos painéis: ao lado do menu lateral (16 rem) em telas largas; acima dos selos em telas estreitas. */
export const CLASSE_PAINEL_FLUTUANTE = "fixed left-3 bottom-[10.5rem] md:left-[17rem] md:bottom-3 z-[9001] max-h-[70vh] md:max-h-[92vh]";
