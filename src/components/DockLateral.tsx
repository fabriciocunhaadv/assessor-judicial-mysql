// Faixa única, no canto inferior esquerdo, onde ficam os botões e avisos flutuantes (Cadastros, Gigantes, Mapa, aviso de vencimento, sentenças com vídeo).
// Antes cada um era "fixed" por conta própria, na mesma coordenada, e eles se sobrepunham entre si e aos botões do menu lateral. Agora empilham em ordem, sem se cobrir,
// e a altura da faixa vai para a variável CSS --dock-h: o menu lateral usa essa altura como folga no fim da rolagem, então nenhum item fica escondido atrás dela.
// Uso: <DockLateral /> uma vez na tela; cada botão/aviso vai dentro de <NoDock ordem={n}> (n menor fica mais acima).
import React, { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

let elemento: HTMLElement | null = null;
const ouvintes = new Set<() => void>();
const definir = (el: HTMLElement | null) => { if (elemento === el) return; elemento = el; ouvintes.forEach((f) => f()); };
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const ler = () => elemento;

export const DockLateral: React.FC = () => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    definir(el);
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--dock-h", `${el.offsetHeight}px`);
    medir();
    let ro: ResizeObserver | null = null;
    try { ro = new ResizeObserver(medir); ro.observe(el); } catch { /* sem ResizeObserver: mede só uma vez */ }
    return () => { ro?.disconnect(); raiz.style.setProperty("--dock-h", "0px"); definir(null); };
  }, []);
  return <div ref={ref} data-testid="dock-lateral" className="fixed left-3 bottom-3 z-[9000] flex flex-col items-start gap-2 max-w-[calc(100vw-1.5rem)] pointer-events-none [&>*]:pointer-events-auto" />;
};

/** Coloca o conteúdo na faixa. Sem a faixa na tela (tela de teste isolada), mostra no mesmo canto, sem empilhar. */
export const NoDock: React.FC<{ ordem: number; children: React.ReactNode }> = ({ ordem, children }) => {
  const el = useSyncExternalStore(assinar, ler, ler);
  const [semFaixa, setSemFaixa] = React.useState(false);
  useEffect(() => { const t = setTimeout(() => setSemFaixa(!elemento), 800); return () => clearTimeout(t); }, [el]);
  const no = <div style={{ order: ordem }}>{children}</div>;
  if (el) return createPortal(no, el);
  return semFaixa ? <div className="fixed left-3 bottom-3 z-[9000]">{no}</div> : null;
};
