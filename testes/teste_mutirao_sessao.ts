// Sessão do Mutirão: sobrevive a "desmontar" a tela (a tarefa em andamento continua gravando no mesmo lugar) e a recarregar a página (IndexedDB).
import "fake-indexeddb/auto";
import { sessaoMutirao } from "../src/utils/mutiraoSessao";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sessaoMutirao.carregar("u1");
  // tarefa longa começa com a tela montada...
  sessaoMutirao.definir("isProcessingPdf", true); sessaoMutirao.definir("progressoPdf", "OCR: 3/10");
  const tarefa = (async () => { await espera(100); sessaoMutirao.definir("progressoPdf", "OCR: 10/10"); sessaoMutirao.definir("pdfFullText", "TEXTO DOS AUTOS"); sessaoMutirao.definir("processInfo", { processNumber: "5128-88", author: "A", defendant: "INSS" }); sessaoMutirao.definir("ataText", "ATA"); sessaoMutirao.definir("step", "ata"); sessaoMutirao.definir("isProcessingPdf", false); })();
  // ...a tela é desmontada (troca para Pauta Normal): nada é zerado e a tarefa termina sozinha
  ok(sessaoMutirao.ler("isProcessingPdf") === true && sessaoMutirao.ler("progressoPdf") === "OCR: 3/10", "durante a tarefa, quem volta à tela vê o andamento");
  await tarefa;
  ok(sessaoMutirao.ler("step") === "ata" && sessaoMutirao.ler("pdfFullText") === "TEXTO DOS AUTOS" && sessaoMutirao.ler("isProcessingPdf") === false, "a tarefa terminou com a tela fora de cena e o resultado está lá");
  const v = new File([new Uint8Array(1000).fill(3)], "testemunha1.mp4", { type: "video/mp4" });
  sessaoMutirao.definir("videoFiles", (l: File[]) => [...l, v]);
  await sessaoMutirao.vaiGravar();
  // "recarregar a página": estado novo na memória, mesma base
  sessaoMutirao._resetar();
  ok(sessaoMutirao.ler("pdfFullText") === "", "página nova começa vazia");
  const aviso = await sessaoMutirao.carregar("u1");
  ok(/recuperada/.test(String(aviso)) && sessaoMutirao.ler("step") === "ata" && sessaoMutirao.ler("ataText") === "ATA" && (sessaoMutirao.ler("processInfo") as any).processNumber === "5128-88", "ao recarregar, volta de onde parou (etapa, ata, processo)");
  const vs = sessaoMutirao.ler<File[]>("videoFiles");
  ok(vs.length === 1 && vs[0].size === 1000, "o vídeo anexado também volta");
  ok(sessaoMutirao.ler("isProcessingPdf") === false && sessaoMutirao.ler("isProcessingVideo") === false, "tarefa que estava no meio da recarga não volta como 'processando'");
  // outro usuário no mesmo navegador não vê a sessão
  sessaoMutirao._resetar(); const aviso2 = await sessaoMutirao.carregar("u2");
  ok(!aviso2 && sessaoMutirao.ler("pdfFullText") === "", "outro usuário não recebe a sessão alheia");
  // quem já começou algo antes de a restauração terminar não é sobrescrito
  sessaoMutirao._resetar(); sessaoMutirao.definir("ataText", "NOVA ATA"); await sessaoMutirao.carregar("u1");
  ok(sessaoMutirao.ler("ataText") === "NOVA ATA", "não sobrescreve o que a pessoa já começou");
  process.exit(falhas ? 1 : 0);
})();
