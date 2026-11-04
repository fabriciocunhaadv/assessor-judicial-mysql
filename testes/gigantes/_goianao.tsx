import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { GoianaoPanel } from "../../src/components/GoianaoPanel";
const R = { ok: true, periodo: { inicio: Date.parse("2026-08-01T12:00:00-03:00"), fim: Date.parse("2027-07-31T12:00:00-03:00") }, totalAtos: 14, lancados: 9, porOrigem: { Studio: 8, Agaia: 6 }, porTipo: { sentenca: 7, decisao: 5, despacho: 2 }, porCategoria: { julgamentoMerito: 4, homologatorio: 3, semMovimento: 1, naoContaComoJulgamento: 6 }, porMes: { "2026-09": { atos: 6, julgamentos: 3 }, "2026-10": { atos: 8, julgamentos: 4 } }, processosComJulgamento: 7, processosHomologatorios: 3, julgamentosEstimados: 2, semClassificacao: [{ processo: "5111111-11.2026.8.09.0166", titulo: "SENTENÇA", origem: "Agaia" }] };
const f = window.fetch.bind(window);
window.fetch = (async (i: any, o?: any) => String(i).includes("goianao/resumo") ? new Response(JSON.stringify(R), { status: 200, headers: { "Content-Type": "application/json" } }) : f(i, o)) as any;
createRoot(document.getElementById("root")!).render(<GoianaoPanel isOpen={true} onClose={() => {}} unitId="montes_claros" />);
