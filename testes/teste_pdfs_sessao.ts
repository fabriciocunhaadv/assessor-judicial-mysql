// PDFs já lidos sobrevivem a atualização/recarga: texto, OCR, páginas sem texto e o arquivo para visualizar.
import "fake-indexeddb/auto";
import { guardarPdfsDaSessao, lerPdfsDaSessao } from "../src/utils/pdfsDaSessao";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
(async () => {
  const pdf: any = { id: "a1", name: "processo.pdf", size: 5000, mimeType: "application/pdf", base64: "AAAA", previewUrl: "blob:x", extractedText: "[Página 1 de 2]\nTEXTO COM OCR", pageCount: 2, paginasSemTexto: [2], paginasNaoLidas: [], paginasOcr: [2], isExtracting: false };
  const lendo: any = { id: "a2", name: "lendo.pdf", size: 10, mimeType: "application/pdf", previewUrl: "blob:y", extractedText: "", isExtracting: true };
  await guardarPdfsDaSessao("u1", [pdf, lendo], async () => new Blob([new Uint8Array(5000).fill(9)], { type: "application/pdf" }));
  const volta = await lerPdfsDaSessao("u1", () => "blob:novo");
  ok(volta.length === 1 && volta[0].name === "processo.pdf", "volta o PDF já lido; o que ainda estava sendo lido não é guardado");
  ok(volta[0].extractedText.includes("TEXTO COM OCR") && volta[0].pageCount === 2 && volta[0].paginasOcr?.[0] === 2 && volta[0].paginasSemTexto?.[0] === 2, "texto, páginas e OCR preservados");
  ok(volta[0].previewUrl === "blob:novo" && !(volta[0] as any).base64, "o arquivo ganha novo endereço de visualização; base64 pesado não é guardado");
  ok((await lerPdfsDaSessao("u2")).length === 0, "outro usuário não vê os PDFs");
  await guardarPdfsDaSessao("u1", []);
  ok((await lerPdfsDaSessao("u1")).length === 0, "lista vazia (Limpar) apaga o guardado");
  process.exit(falhas ? 1 : 0);
})();
