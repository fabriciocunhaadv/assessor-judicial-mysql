import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { InitialPetitionPanel } from "../../src/components/InitialPetitionPanel";
createRoot(document.getElementById("root")!).render(<InitialPetitionPanel isOpen={true} onClose={() => {}} currentUserEmail="teste@tjgo.jus.br" />);
