import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { CentralDecisoesPanel } from "../../src/components/CentralDecisoesPanel";
(window as any).__aba = "";
createRoot(document.getElementById("root")!).render(<CentralDecisoesPanel irParaAba={(a) => { (window as any).__aba = a; }} />);
