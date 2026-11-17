import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { CalibragemEnvioHost } from "../../src/components/CalibragemEnvioHost";
import { pedirEnvioCalibragem, type PedidoCalibragem } from "../../src/utils/calibragemEnvio";
const GERADO = "DESPACHO\nI - RELATÓRIO\nTrata-se de ação de exoneração de alimentos movida por Dirceu em face de Isabelly, com histórico detalhado das movimentações.\nII - FUNDAMENTAÇÃO\nO acordo foi homologado por sentença e a serventia expediu ofício à fonte pagadora conforme a ordem judicial.\nIII - DISPOSITIVO\nArquive-se.";
(window as any).pedir = (modo: "lancado" | "excluir", id = "ana-1") => { const p: PedidoCalibragem = { modo, analysisId: id, processo: "5574437-20.2026.8.09.0166", ato: "DESPACHO", promptTitulo: "Despacho padrão", motor: "turbo", cabecalho: "Montes Claros de Goiás - Vara de Família e Sucessões", textoGerado: GERADO }; return pedirEnvioCalibragem(p).then((d) => { (window as any).__desfechos = [...((window as any).__desfechos || []), d]; return d; }); };
createRoot(document.getElementById("root")!).render(<div style={{ background: "#020617", minHeight: "100vh", padding: 16, color: "#fff" }}>página de teste<CalibragemEnvioHost /></div>);
(window as any).pronto = true;
