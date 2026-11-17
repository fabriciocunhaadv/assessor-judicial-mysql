import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
const paragrafos = Array.from({ length: 30 }, (_, i) => `Parágrafo ${i + 1} da fundamentação: ${"texto da minuta ".repeat(30)}`).join("\n\n");
const minute: any = { title: "SENTENÇA", header: "PODER JUDICIÁRIO", processNumber: "5914870-27.2025.8.09.0166", parties: { author: "A", defendant: "B" },
  relatorio: "Relatório de teste.", fundamentacao: paragrafos, dispositivo: "Julgo procedente.", fullFormattedText: "SENTENÇA\n\nI - RELATÓRIO\nRelatório de teste.\n\nII - FUNDAMENTAÇÃO\n" + paragrafos + "\n\nIII - DISPOSITIVO\nJulgo procedente." };
const matriz = [
  { parte: "reu", argumento: "ilegitimidade passiva", localizacao: "Mov. 31, Arq. 1, Pág. 2", resultado: "rejeitado", trechoNaMinuta: "A preliminar é rejeitada" },
  { parte: "reu", argumento: "prescrição da pretensão", localizacao: "Mov. 31, Arq. 1, Pág. 4", resultado: "nao_enfrentado", trechoNaMinuta: "" },
];
const result: any = {
  minute, usage: { totalTokenCount: 10 },
  auditAnalysis: { argumentoVsResposta: matriz, fatoVsProva: [], alertasProcessuais: [], normasAplicadas: [] },
  conferenciaArgumentos: { total: 2, respondidos: 1, semResposta: [matriz[1]], naoLocalizados: [] },
  alertaInjecao: { verificado: true, total: 0, alto: 0, medio: 0, achados: [] },
  fontesConsultadas: { legislacao: ["CPC, art. 489"], naoLocalizados: [], indisponiveis: [], locais: [], precedentes: [], consultado: true },
  avisoCitacao: ["Mov. 9, Arq. 99, Pág. 1: a movimentação não tem o Arq. 99"],
  groundingStatus: "desligado",
  conferenciaFase: { fase: "cumprimento", confianca: "alta", sinais: [], avisos: ["A minuta decide o mérito"], refeita: true, resolvido: false, tesesOmitidas: 0 },
};
if (new URLSearchParams(location.search).get("prof") === "1") result.avisoProfundidade = ["O Google estava sobrecarregado e só o modelo mais leve respondeu. Esta minuta ficou abaixo do nível de profundidade esperado."];
(window as any).__vezes = { lancado: 0 };
function App() {
  const [m, setM] = useState<any>(minute);
  return <div style={{ maxWidth: 1100, margin: "0 auto" }}><MinuteViewer isSuperAdmin={new URLSearchParams(location.search).get("super") === "1"} result={{ ...result, minute: m }} onUpdateMinute={(n: any) => setM(n)} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} onGoHome={() => {}} onOpenXRay={() => {}} onDeleteMinute={() => {}} onInjectTextAsParadigm={() => {}} currentAnalysisId="a1" /></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
(window as any).pronto = true;
