import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Sidebar } from "../../src/components/Sidebar";
import { HearingWorkbenchModal } from "../../src/components/HearingWorkbenchModal";
// ligado como no App: "Audiências" abre a Mesa; "Sentença da audiência" abre a Mesa já no Mutirão Expresso
function App() {
  const [aberta, setAberta] = useState(false), [token, setToken] = useState(0);
  return <div style={{ display: "flex", height: "100vh" }}>
    <Sidebar isSuperAdmin={false} isJudge={false} onOpenHearingWorkbench={() => setAberta(true)} onOpenSentencaAudiencia={() => { setToken((n) => n + 1); setAberta(true); }} onOpenMinuteAuditor={() => {}} />
    <HearingWorkbenchModal isOpen={aberta} onClose={() => setAberta(false)} abrirNoMutirao={token} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<App />);
(window as any).pronto = true;
