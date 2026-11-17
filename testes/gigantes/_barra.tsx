import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { BarraEspera } from "../../src/components/BarraEspera";
import { PainelProgresso } from "../../src/components/PainelProgresso";
const q = new URLSearchParams(location.search);
(window as any).ate = Date.now() + 20_000;
createRoot(document.getElementById("root")!).render(<div style={{ maxWidth: 560, margin: "20px auto", padding: 16, background: "#fff" }}>
  {q.get("modo") === "painel" ? <PainelProgresso ativo progId="prog-x" titulo="Executando prompt no processo" /> : <BarraEspera ate={(window as any).ate} total={20_000} />}
</div>);
(window as any).pronto = true;
