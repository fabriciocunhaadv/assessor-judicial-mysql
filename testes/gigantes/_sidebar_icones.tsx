import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Sidebar } from "../../src/components/Sidebar";
const nada = () => {};
const q = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<div style={{ display: "flex", minHeight: "100vh" }}>
  <Sidebar onGoHome={nada} onOpenMinuteAuditor={nada} onOpenPresentation={nada} onOpenXRay={nada} onOpenHistory={nada} onOpenTeses={nada} onOpenBindingPrecedents={nada} onOpenLegislativeLookup={nada} onOpenProjudiGuide={nada} onOpenCalendar={nada} onOpenHearingWorkbench={nada} onOpenSentencaAudiencia={nada} onOpenPromptManager={nada} onOpenChangePassword={nada} tesesCount={9} isSuperAdmin={q.get("super") === "1"} />
  <main style={{ flex: 1, padding: 24 }}>área de trabalho</main></div>);
(window as any).pronto = true;
