import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { DockLateral, NoDock } from "../../src/components/DockLateral";
import { AvisoVencimentoFixo } from "../../src/components/AvisoVencimentoFixo";
const Pilula = ({ id, cor, texto }: { id: string; cor: string; texto: string }) => <button data-testid={id} className={`px-3 py-2 rounded-full text-white text-xs font-bold ${cor}`}>{texto}</button>;
const App = () => {
  const [mapa, setMapa] = useState(true);
  (window as any).__alternarMapa = () => setMapa((v) => !v);
  return (
    <>
      {/* menu lateral de mentira, igual ao real: rolagem própria e folga no fim pela variável --dock-h */}
      <aside data-testid="menu" className="fixed left-0 top-0 bottom-0 w-52 bg-white border-r flex flex-col">
        <div data-testid="menu-rolagem" className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto" style={{ paddingBottom: "calc(var(--dock-h, 0px) + 1rem)" }}>
          {Array.from({ length: 22 }, (_, i) => <button key={i} data-testid={`item-${i}`} className="text-left text-sm">Item do menu {i}</button>)}
        </div>
      </aside>
      <DockLateral />
      <AvisoVencimentoFixo qtd={3} onVer={() => {}} acimaDeCadastros={true} />
      {mapa && <NoDock ordem={3}><Pilula id="p-mapa" cor="bg-violet-700" texto="🗺️ Mapa 1 em andamento · 40%" /></NoDock>}
      <NoDock ordem={4}><Pilula id="p-gig" cor="bg-sky-700" texto="📚 Gigantes 2 em andamento · 10%" /></NoDock>
      <NoDock ordem={5}><Pilula id="p-cad" cor="bg-indigo-700" texto="Cadastros (3 pendentes)" /></NoDock>
    </>
  );
};
createRoot(document.getElementById("root")!).render(<App />);
(window as any).pronto = true;
