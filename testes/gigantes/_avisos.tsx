import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AvisosDaMinuta } from "../../src/components/AvisosDaMinuta";
const matriz = [
  { parte: "reu", argumento: "ilegitimidade passiva", localizacao: "Mov. 31, Arq. 1, Pág. 2", resultado: "rejeitado", trechoNaMinuta: "A preliminar é rejeitada" },
  { parte: "reu", argumento: "prescrição da pretensão", localizacao: "Mov. 31, Arq. 1, Pág. 4", resultado: "nao_enfrentado", trechoNaMinuta: "" },
  { parte: "autor", argumento: "inversão do ônus da prova", localizacao: "Mov. 1", resultado: "acolhido", trechoNaMinuta: "inverto o ônus" },
];
const comFalha: any = { auditAnalysis: { argumentoVsResposta: matriz }, conferenciaArgumentos: { total: 3, respondidos: 1, semResposta: [matriz[1]], naoLocalizados: [matriz[2]] } };
const completo: any = { auditAnalysis: { argumentoVsResposta: [matriz[0]] }, conferenciaArgumentos: { total: 1, respondidos: 1, semResposta: [], naoLocalizados: [] } };
const caso = new URLSearchParams(location.search).get("caso") || "falha";
createRoot(document.getElementById("root")!).render(<div style={{ padding: 16 }}>
  {caso === "falha" && <AvisosDaMinuta result={comFalha} />}
  {caso === "completo" && <AvisosDaMinuta result={completo} />}
  {caso === "vazio" && <AvisosDaMinuta result={{ conferenciaFase: undefined } as any} />}
  <p id="marcador">caso {caso}</p>
</div>);
(window as any).pronto = true;
