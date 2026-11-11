import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
import { salvarPreferenciaIA } from "../../src/utils/provedorIA";
// no teste o chat usa a "chave Claude" (basta existir; a rede é simulada): assim ele não bloqueia pedindo chave
try { localStorage.setItem("assessor_claude_key_anon", "sk-ant-chave-falsa-de-teste-1234567890"); localStorage.setItem("assessor_provedor_chat_anon", "claude"); } catch { /* sem armazenamento */ }
void salvarPreferenciaIA;
const mk = (n: string, txt: string): any => ({ title: "DECISÃO INTERLOCUTÓRIA", header: "VARA ÚNICA", processNumber: n, parties: { author: "AUTOR", defendant: "RÉU" }, relatorio: `Relatório ${txt}. ` + "texto ".repeat(40), fundamentacao: "Fundamentação " + "z".repeat(300), dispositivo: "Dispositivo " + "w".repeat(300), closing: "Intimem-se.", fullFormattedText: "" });
const resA: any = { minute: mk("5000001-00.2026.8.09.0166", "A"), originalMinute: mk("5000001-00.2026.8.09.0166", "A"), auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] } };
const resB: any = { ...resA, minute: mk("5000002-00.2026.8.09.0166", "B"), originalMinute: mk("5000002-00.2026.8.09.0166", "B") };
(window as any).atualizacoes = [];
const SEM_MENSAGENS: any[] = [];      // estável: um [] novo a cada render faz o MinuteViewer repetir o efeito que sincroniza o chat
function App() {
  const [id, setId] = useState("A");
  (window as any).trocar = () => setId("B");
  return <><Toaster /><MinuteViewer result={id === "A" ? resA : resB} onUpdateMinute={(m: any, ) => { (window as any).atualizacoes.push(m.relatorio); }} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} currentAnalysisId={id} initialChatMessages={SEM_MENSAGENS} onInjectTextAsParadigm={() => {}} /></>;
}
createRoot(document.getElementById("root")!).render(<App />);
(window as any).pronto = true;
