import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { GigantesPanel } from "../../src/components/GigantesPanel";
import { salvarJob, type JobGig } from "../../src/utils/gigantes/db";
const base = (id: string, unitName?: string): JobGig => ({ id, nome: `Autos ${id}.pdf`, numeroProcesso: `5097642-14.2021.8.09.0166`, criadoEm: Date.now() - (id === "a" ? 0 : 1000), atualizadoEm: Date.now(), status: "concluido", etapa: "Minuta pronta e salva no Histórico.", progresso: { feitas: 3, total: 3 }, arquivos: [], totalPaginas: 372, totalTokensEstimados: 197000, lotes: [], fichas: {}, nivelAtual: 0, injecao: { verificado: true, caracteres: 0, total: 0, alto: 0, medio: 0, achados: [] }, triagem: {} as any, config: { promptText: "", promptTitle: "P", actType: "sentenca", ...(unitName ? { unitId: "palmeiras", unitName } : {}) } } as any);
(async () => {
  await salvarJob(base("a", "Palmeiras de Goiás / Vara Única")); await salvarJob(base("b"));
  createRoot(document.getElementById("root")!).render(<GigantesPanel config={{ promptText: "", promptTitle: "P", actType: "sentenca", unitName: "Montes Claros / Vara Única" } as any} />);
  setTimeout(() => { window.dispatchEvent(new Event("gigantes:abrir")); (window as any).pronto = true; }, 400);
})();
