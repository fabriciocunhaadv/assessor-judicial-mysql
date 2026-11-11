import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { saveJudgeParadigms } from "../../src/utils/judgeParadigmsDb";
import { AdaptarParadigmoModal } from "../../src/components/AdaptarParadigmoModal";
const minuta: any = { title: "SENTENÇA", header: "PODER JUDICIÁRIO", processNumber: "5656408-27.2026.8.09.0166", parties: { author: "A", defendant: "B" },
  relatorio: "Ação declaratória de inexistência de débito com indenização por danos morais por negativação indevida no SPC e SERASA. " + "texto ".repeat(40), fundamentacao: "A negativação indevida gera dano moral in re ipsa. " + "z".repeat(300), dispositivo: "JULGO PROCEDENTE. Condeno em R$ 5.000,00. " + "w".repeat(300), closing: "Intimem-se.", fullFormattedText: "" };
const mk = (id: string, title: string, category: string, fullText: string) => ({ id, title, category, decisionType: "procedencia", fullText: fullText.padEnd(400, "."), createdAt: 1, updatedAt: 1 });
const ready = saveJudgeParadigms([
  mk("p1", "Negativação indevida - dano moral (procedência)", "Direito do Consumidor", "SENTENÇA negativação indevida SPC SERASA dano moral in re ipsa inscrição indevida"),
  mk("p2", "Cartão consignado RMC", "Direito Bancário", "RMC reserva de margem consignável cartão de crédito consignado saque complementar"),
  mk("p3", "Cumprimento de sentença JEC", "Processual Civil", "DECISÃO cumprimento de sentença Juizado Especial Cível contadoria"),
] as any, false).catch(() => {});
function App() {
  const [aberto, setAberto] = useState(true);
  return <><button id="abrir" onClick={() => setAberto(true)}>abrir</button><AdaptarParadigmoModal aberto={aberto} aoFechar={() => setAberto(false)} minuta={minuta} aoAplicar={(n, t, a) => { (window as any).aplicado = { n, t, a }; }} /></>;
}
ready.then(() => { createRoot(document.getElementById("root")!).render(<App />); (window as any).pronto = true; });
