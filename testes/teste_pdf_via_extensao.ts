// Quem trata o PDF inserido no Studio. Rodar: npx tsx testes/teste_pdf_via_extensao.ts
import { decidirCaminho, LINK_EXTENSAO } from "../src/utils/pdfViaExtensao";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const E = (o: any = {}) => ({ automatico: false, versao: "", recursos: "", aparelho: "computador" as const, ...o });
ok(decidirCaminho(E({ versao: "1.0.99", recursos: "pdf" })) === "extensao", "computador com a extensão nova: trata na extensão");
ok(decidirCaminho(E()) === "instalar", "computador sem extensão: bloqueia e pede a instalação");
ok(decidirCaminho(E({ versao: "1.0.90" })) === "atualizar", "extensão antiga (sem o recurso): pede atualização");
ok(decidirCaminho(E({ aparelho: "android" })) === "studio" && decidirCaminho(E({ aparelho: "ios" })) === "studio", "celular sem extensão: o Studio lê sozinho");
ok(decidirCaminho(E({ aparelho: "android", versao: "1.0.90" })) === "studio", "celular com extensão antiga: o Studio lê sozinho");
ok(decidirCaminho(E({ aparelho: "android", versao: "1.0.99", recursos: "pdf" })) === "extensao", "celular com extensão nova (ex.: navegador com extensões): usa a extensão");
ok(decidirCaminho(E({ automatico: true })) === "studio" && decidirCaminho(E({ automatico: true, versao: "1.0.99", recursos: "pdf" })) === "studio", "esteira da extensão (automático): não trata de novo");
ok(decidirCaminho(E({ recursos: "pdf, ocr" , versao: "2.0"})) === "extensao", "lista de recursos com vários itens");
ok(LINK_EXTENSAO === "https://chromewebstore.google.com/detail/conclus%C3%B5es-projudi/ioiadaafdnannofgkoioefhejkpmlgpe?hl=pt-BR", "link da loja é o informado pelo usuário");
if (falhas) process.exit(1); console.log("TUDO OK");
