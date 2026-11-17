import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MinutasLancadasPanel } from "../../src/components/MinutasLancadasPanel";
createRoot(document.getElementById("root")!).render(<div style={{ background: "#020617", minHeight: "100vh", padding: 16 }}><MinutasLancadasPanel /></div>);
(window as any).pronto = true;
