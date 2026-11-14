import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MutiraoPrevidenciarioView } from "../../src/components/MutiraoPrevidenciarioView";
import { sessaoMutirao } from "../../src/utils/mutiraoSessao";
import { gerenteGigantes } from "../../src/utils/gigantes/gerente";
// começa já no passo 2 (mídia): autos lidos e ata pronta
sessaoMutirao.definir("step", "ata");
sessaoMutirao.definir("ataText", "TERMO PRELIMINAR\nOBJETO DA LIDE: ação de cobrança.");
sessaoMutirao.definir("pdfFullText", "Petição inicial. ".repeat(60));
sessaoMutirao.definir("processInfo", { processNumber: "5079130-20.2025.8.09.0076", author: "LINDOMAR", defendant: "STEFANY" });
sessaoMutirao.definir("selectedPromptId", "p1");
(window as any).sessao = sessaoMutirao;
(window as any).gerente = gerenteGigantes;
(window as any).__abriu = 0; window.addEventListener("gigantes:abrir", () => { (window as any).__abriu++; });
createRoot(document.getElementById("root")!).render(<MutiraoPrevidenciarioView />);
(window as any).pronto = true;
