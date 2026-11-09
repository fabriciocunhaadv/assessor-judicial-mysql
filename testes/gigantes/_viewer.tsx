import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
const minute: any = { title: "DECISÃO INTERLOCUTÓRIA", header: "VARA ÚNICA", processNumber: "5500003-10.2025.8.09.0166", parties: { author: "AUTOR 3 DA SILVA", defendant: "ESTADO DE GOIÁS" }, relatorio: "Relatório do caso.", fundamentacao: "Fundamentação do caso.", dispositivo: "Defiro.", closing: "Documento assinado." };
const result: any = { minute, originalMinute: minute, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] } };
const id = new URLSearchParams(location.search).get("id");
createRoot(document.getElementById("root")!).render(<><Toaster /><MinuteViewer result={result} onUpdateMinute={() => {}} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} currentAnalysisId={id} onInjectTextAsParadigm={() => {}} /></>);
