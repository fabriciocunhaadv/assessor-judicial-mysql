import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { MinuteViewer } from "../../src/components/MinuteViewer";
import { globalTenantId } from "../../src/lib/firestoreUtils";
// Minuta aberta na tela + o registro dela no Histórico local (o que a tela lê para decidir o botão “Refazer só com alguns eventos” e o aviso de versão).
// Parâmetros: motor = principal | turbo | gigante | agaia ; versao = 2 (já é uma nova versão, com faixa 77–83)
const q = new URLSearchParams(location.search), motor = q.get("motor") || "principal", versao = q.get("versao");
const minute: any = { title: "SENTENÇA", header: "PODER JUDICIÁRIO", processNumber: "5914870-27.2025.8.09.0166", parties: { author: "A", defendant: "B" }, relatorio: "Relatório de teste.", fundamentacao: "Fundamentação de teste.", dispositivo: "Julgo procedente.", fullFormattedText: "SENTENÇA\n\nI - RELATÓRIO\nRelatório de teste.\n\nII - FUNDAMENTAÇÃO\nFundamentação de teste.\n\nIII - DISPOSITIVO\nJulgo procedente." };
const result: any = { minute, originalMinute: minute, usage: { totalTokenCount: 10 }, auditAnalysis: { fatoVsProva: [], regularidadeDocumental: {}, competenciaCheck: {}, normasAplicadas: [], alertasProcessuais: [] }, ...(motor === "turbo" || motor === "gigante" ? { motor } : {}), ...(motor === "agaia" ? { origemExterna: { sistema: "Agaia", promptAgaia: "x" } } : {}) };
const ato: any = { id: "ana-1", unitId: "montes_claros", promptTitle: "Outros Área Judicial - Família e Sucessões", promptId: "p1", promptCategory: "familia", promptScope: "judicial", date: Date.now(), processNumber: minute.processNumber, result, processTextContext: "autos", createdBy: "u1", creatorName: "Assessor", creatorEmail: "a@b.c", chatMessages: [],
  ...(versao ? { versao: +versao, refazerDe: "ana-0", faixaMovimentos: { min: 77, max: 83, n: 7, arquivos: 9 } } : {}) };
try { localStorage.setItem(`assessor_fabricio_history_cache_v3_montes_claros_${globalTenantId}`, JSON.stringify([ato])); } catch { /* sem armazenamento */ }
createRoot(document.getElementById("root")!).render(<><Toaster /><div style={{ maxWidth: 1100, margin: "0 auto" }}><MinuteViewer result={result} onUpdateMinute={() => {}} originalProcessText="" isFormCollapsed={false} onToggleCollapseForm={() => {}} currentAnalysisId="ana-1" onInjectTextAsParadigm={() => {}} /></div></>);
(window as any).pronto = true;
