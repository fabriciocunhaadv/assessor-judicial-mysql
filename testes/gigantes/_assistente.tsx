import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AssistenteBoasVindas } from "../../src/components/AssistenteBoasVindas";
(window as any).acoes = [];
createRoot(document.getElementById("root")!).render(<div style={{ minHeight: "100vh" }}><AssistenteBoasVindas aoAcao={(a) => (window as any).acoes.push(a)} /></div>);
(window as any).pronto = true;
