import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { ProcessTimelineModal } from "../../src/components/ProcessTimelineModal";
const ato = (id: string, extra: any, t: number) => ({ id, promptTitle: "Outros Área Judicial - Juizado Especial Cível", date: t, processNumber: "5271363-31.2026.8.09.0166", createdBy: "u1", chatMessages: [], result: { minute: { title: "DECISÃO INTERLOCUTÓRIA", relatorio: "r", fundamentacao: "f", dispositivo: "d", parties: { author: "A", defendant: "B" } }, ...extra } });
const dossier: any = { id: "d1", processNumber: "5271363-31.2026.8.09.0166", normalizedNumber: "5271363312026809166", parties: { author: "IRANY DA SILVA", defendant: "BANCO BMG S.A" }, analyses: [ato("a1", { origemExterna: { sistema: "Agaia", promptAgaia: "JEC" } }, 1), ato("a2", {}, 2), ato("a3", { origemVideo: { videos: ["v1.mp4"] } }, 3)] };
createRoot(document.getElementById("root")!).render(<ProcessTimelineModal isOpen={true} onClose={() => {}} dossier={dossier} onLoadAnalysis={() => {}} onDeleteAnalysis={() => {}} />);
(window as any).pronto = true;
