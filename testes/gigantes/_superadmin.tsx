import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { SuperAdminPanel } from "../../src/components/SuperAdminPanel";
createRoot(document.getElementById("root")!).render(<SuperAdminPanel isOpen onClose={() => {}} onOpenTicketsModal={() => {}} />);
