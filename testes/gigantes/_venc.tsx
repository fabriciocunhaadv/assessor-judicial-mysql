import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { AvisoVencimentoFixo } from "../../src/components/AvisoVencimentoFixo";
import { avisarVencimentos } from "../../src/utils/retencaoDb";
import { definirConfigRetencao, normalizarConfigRetencao, resumirValidade } from "../../src/utils/retencaoRegras";
const AGORA = Date.now(), DIA = 86_400_000;
definirConfigRetencao(normalizarConfigRetencao({ ativa: true, dias: 7, ativadaEm: AGORA - 20 * DIA }));
const atos = [{ date: AGORA - 6.5 * DIA, createdBy: "u1" }, { date: AGORA - 5 * DIA, createdBy: "u1" }, { date: AGORA - 1 * DIA, createdBy: "u1" }, { date: AGORA - 6.6 * DIA, createdBy: "outro" }];
(window as any).__cliques = 0;
const App = () => {
  const [n] = useState(() => resumirValidade(atos.filter((a) => a.createdBy === "u1"), { ativa: true, dias: 7, ativadaEm: AGORA - 20 * DIA, corteAntigas: 0 }).ate1);
  React.useEffect(() => { avisarVencimentos(atos, "u1", () => { (window as any).__cliques++; }); }, []);
  return <><Toaster /><AvisoVencimentoFixo qtd={n} onVer={() => { (window as any).__cliques += 10; }} acimaDeCadastros={true} /></>;
};
createRoot(document.getElementById("root")!).render(<App />);
