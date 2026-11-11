import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
const minute: any = { title: "DECISÃO INTERLOCUTÓRIA", header: "VARA ÚNICA", processNumber: "5500003-10.2025.8.09.0166", parties: { author: "AUTOR", defendant: "RÉU" }, relatorio: "Trata-se de pedido. " + "texto ".repeat(60), fundamentacao: "Fundamentação " + "z".repeat(300), dispositivo: "Dispositivo " + "w".repeat(300), closing: "Intimem-se.", fullFormattedText: "" };
const result: any = { minute, originalMinute: minute, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] } };
// simula "Carregar minuta": a tela do resultado começa SEM resultado e depois recebe a minuta (mesmo componente, mais ganchos não podem aparecer)
function App() { const [r, setR] = useState<any>(null); return <><Toaster /><button id="carregar" onClick={() => setR(result)}>carregar</button><MinuteViewer result={r} onUpdateMinute={() => {}} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} currentAnalysisId={null} onInjectTextAsParadigm={() => {}} /></>; }
createRoot(document.getElementById("root")!).render(<App />);
(window as any).pronto = true;
