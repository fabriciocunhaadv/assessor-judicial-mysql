import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
const paragrafos = Array.from({ length: 40 }, (_, i) => `Parágrafo ${i + 1} da fundamentação: ${"texto da minuta ".repeat(30)}`).join("\n\n");
const minute: any = { title: "DECISÃO INTERLOCUTÓRIA", header: "PODER JUDICIÁRIO", processNumber: "5914870-27.2025.8.09.0166", parties: { author: "A", defendant: "B" },
  relatorio: "Relatório de teste.", fundamentacao: paragrafos, dispositivo: "Defiro.", fullFormattedText: "DECISÃO\n\n" + paragrafos };
const result: any = { minute, audit: null, usage: { totalTokenCount: 10 } };
createRoot(document.getElementById("root")!).render(<div style={{ maxWidth: 900, margin: "0 auto" }}><MinuteViewer result={result} onUpdateMinute={() => {}} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} currentAnalysisId="t1" /></div>);
