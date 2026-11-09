// Chamado pelo celular (lado do navegador): reduz o print antes de enviar, envia os anexos ao servidor e abre um anexo com a sessão do usuário.
import { getApiHeaders } from "./apiKeyManager";
import { TAMANHO_MAX, type AnexoChamado } from "./chamadoRegras";

/** Print/foto de celular costuma ter vários MB: reduz para no máximo 1600 px de lado (JPEG) para o envio ser rápido e caber no limite. PDF e imagens já pequenas não são mexidos. */
export async function prepararArquivo(f: File): Promise<Blob> {
  if (!/^image\//.test(f.type) || f.type === "image/gif") return f;
  try {
    if (f.size <= 1_200_000) return f;
    const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b: Blob | null = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    return b && b.size < f.size ? b : f;
  } catch { return f; }
}
export async function enviarAnexo(b: Blob, nome: string): Promise<AnexoChamado> {
  if (b.size > TAMANHO_MAX) throw new Error(`“${nome}” tem mais de ${Math.round(TAMANHO_MAX / 1048576)} MB`);
  const r = await fetch("/api/chamados/anexos", { method: "POST", headers: getApiHeaders({ "Content-Type": b.type || "application/octet-stream", "X-Nome": encodeURIComponent(nome) }) as any, body: b });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.erro || `HTTP ${r.status}`); return j;
}
/** Abre o anexo numa aba (o endereço exige login, por isso baixa com a sessão e abre como arquivo local). */
export async function abrirAnexo(id: string): Promise<void> {
  const r = await fetch(`/api/chamados/anexos/${id}`, { headers: getApiHeaders() as any });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.erro || `HTTP ${r.status}`); }
  const url = URL.createObjectURL(await r.blob()); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function apagarAnexo(id: string): Promise<void> { try { await fetch(`/api/chamados/anexos/${id}`, { method: "DELETE", headers: getApiHeaders() as any }); } catch { /* o servidor apaga sozinho em 90 dias */ } }
