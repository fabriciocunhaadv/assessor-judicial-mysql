import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { PdfUploadZone } from "../../src/components/PdfUploadZone";
(window as any).__adicionados = [];
createRoot(document.getElementById("root")!).render(<><Toaster /><PdfUploadZone pdfFiles={[]} onAddPdf={(p) => (window as any).__adicionados.push(p)} onRemovePdf={() => {}} onClearAll={() => {}} /></>);
