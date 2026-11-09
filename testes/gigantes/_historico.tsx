import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { HistoryModal } from "../../src/components/HistoryModal";
const aberta = new URLSearchParams(location.search).get("aberta");
createRoot(document.getElementById("root")!).render(<HistoryModal isOpen onClose={() => {}} onLoadAnalysis={() => {}} analiseAbertaId={aberta} processoAberto={aberta ? "5500003-10.2025.8.09.0166" : ""} />);
