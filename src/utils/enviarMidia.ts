// Envia o vídeo/áudio da audiência ao servidor em PARTES (cada uma com nova tentativa): arquivos de centenas de MB não passam de uma vez por proxies e navegadores.
export const TAMANHO_PARTE = 8 * 1024 * 1024;
export async function enviarMidiaEmPartes(file: File, aoProgresso: (feitas: number, total: number) => void = () => {}, fetchFn: typeof fetch = fetch): Promise<{ midiaId: string; partes: number; tamanho: number }> {
  const midiaId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");
  const partes = Math.max(1, Math.ceil(file.size / TAMANHO_PARTE));
  for (let n = 0; n < partes; n++) {
    const fatia = file.slice(n * TAMANHO_PARTE, (n + 1) * TAMANHO_PARTE);
    let ultimo: any = null;
    for (let t = 0; t < 4; t++) {
      try {
        const r = await fetchFn(`/api/mutirao-midia/parte?id=${encodeURIComponent(midiaId)}&n=${n}&total=${partes}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: fatia });
        if (r.ok) { ultimo = null; break; }
        const j = await r.json().catch(() => ({} as any)); ultimo = new Error(j.erro || `erro ${r.status} ao enviar a parte ${n + 1}`);
        if (r.status === 401 || r.status === 400) break;
      } catch (e) { ultimo = e; }
      await new Promise((ok) => setTimeout(ok, 1500 * (t + 1)));
    }
    if (ultimo) throw new Error(`Não consegui enviar a mídia (parte ${n + 1} de ${partes}): ${String(ultimo?.message || ultimo)}. Confira a internet e tente de novo.`);
    aoProgresso(n + 1, partes);
  }
  return { midiaId, partes, tamanho: file.size };
}
