// Leitura de PDF dos autos nas telas Mesa de Audiência e Mutirão Expresso: igual ao upload principal do Studio.
// Com a extensão (computador): ela confere página por página, faz OCR nas páginas de imagem e devolve o TEXTO. Sem a extensão no computador: lança ExtensaoNecessaria
// (a tela mostra o aviso com o link da loja). Celular/tablet: o Studio lê sozinho.
import { extractTextFromPdf, textoOcultoDoArquivo, limparTextoDaExtensao } from "./pdfExtractor";
import { caminhoAtual, tratarPdfNaExtensao } from "./pdfViaExtensao";

export class ExtensaoNecessaria extends Error {
  tipo: "instalar" | "atualizar";
  constructor(tipo: "instalar" | "atualizar") { super(tipo === "atualizar" ? "Atualize a extensão Conclusões Projudi." : "Instale a extensão Conclusões Projudi."); this.tipo = tipo; this.name = "ExtensaoNecessaria"; }
}
export type AutosLidos = Awaited<ReturnType<typeof extractTextFromPdf>> & { paginasOcr?: number[] };

export async function lerAutosPdf(file: File, aoProgresso: (texto: string, feitas: number, total: number) => void = () => {}): Promise<AutosLidos> {
  const caminho = await caminhoAtual();
  if (caminho === "instalar" || caminho === "atualizar") throw new ExtensaoNecessaria(caminho);
  if (caminho === "extensao") {
    try {
      const r = await tratarPdfNaExtensao(file, { aoProgresso: (etapa, feitas, total) => aoProgresso(etapa, feitas, total || 0) });
      const oculto = await textoOcultoDoArquivo(file);      // proteção contra texto escondido (prompt injection)
      const texto = (r.quadro || "") + (await limparTextoDaExtensao(r.texto)) + oculto;
      return { text: texto, pageCount: r.paginas, hasText: texto.length > 30, paginasSemTexto: [...new Set([...(r.puladas || []), ...(r.vazias || [])])], paginasNaoLidas: [], paginasOcr: r.paginasOcr } as AutosLidos;
    } catch (e: any) {
      console.warn("[autos] a extensão não conseguiu tratar o PDF; o Studio lê sozinho:", e?.message || e);
    }
  }
  return extractTextFromPdf(file, (c, t) => aoProgresso("Lendo o PDF", c, t));
}
