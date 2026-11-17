import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { UtilizacaoPanel } from "../../src/components/UtilizacaoPanel";
createRoot(document.getElementById("root")!).render(<div style={{ maxWidth: 900, margin: "0 auto", background: "#020617", padding: 12 }}><UtilizacaoPanel /></div>);
(window as any).pronto = true;
