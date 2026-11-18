import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "../../src/components/Sidebar";
import { AssistenteBoasVindas } from "../../src/components/AssistenteBoasVindas";
(window as any).acoes = [];
createRoot(document.getElementById("root")!).render(<div style={{ display: "flex", minHeight: "100vh" }}><Toaster /><Sidebar onGoHome={() => {}} onOpenHistory={() => {}} /><main style={{ flex: 1, padding: 24 }}>área de trabalho do Studio</main><AssistenteBoasVindas aoAcao={(a) => (window as any).acoes.push(a)} /></div>);
(window as any).pronto = true;
