import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { MonitorPanel } from "../../src/components/MonitorPanel";
createRoot(document.getElementById("root")!).render(<div style={{ background: "#020617", minHeight: "100vh", padding: 16 }}><MonitorPanel /></div>);
(window as any).pronto = true;
