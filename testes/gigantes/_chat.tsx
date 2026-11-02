import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
const paragrafos = Array.from({ length: 40 }, (_, i) => `Parágrafo ${i + 1} da fundamentação: ${"texto da minuta ".repeat(30)}`).join("\n\n");
const minute: any = { title: "DECISÃO INTERLOCUTÓRIA", header: "PODER JUDICIÁRIO", processNumber: "5914870-27.2025.8.09.0166", parties: { author: "A", defendant: "B" },
  relatorio: "Relatório de teste.", fundamentacao: paragrafos, dispositivo: "Defiro.", fullFormattedText: "DECISÃO\n\n" + paragrafos };
(window as any).__salvos = [];
function App() {
  const [m, setM] = useState<any>(minute);
  const result: any = { minute: m, auditAnalysis: null, usage: { totalTokenCount: 10 } };
  (window as any).__minuta = m;
  return <div style={{ maxWidth: 900, margin: "0 auto" }}><MinuteViewer result={result} onUpdateMinute={(n: any) => { (window as any).__salvos.push(n); setM(n); }} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} /></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
