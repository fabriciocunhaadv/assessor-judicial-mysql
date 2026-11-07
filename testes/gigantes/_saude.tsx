import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { SaudePanel } from "../../src/components/SaudePanel";
createRoot(document.getElementById("root")!).render(<SaudePanel />);
