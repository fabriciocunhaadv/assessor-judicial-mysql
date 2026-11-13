// De onde veio cada minuta (usado no Histórico e na Linha do Tempo): Agaia/colada (feita fora do Studio), sentença com vídeo, ou Studio.
/** Minutas que vieram prontas de fora do Studio (Agaia ou coladas à mão): a etiqueta do Histórico mostra de onde veio. */
export const origemExterna = (a: any): { rotulo: string; dica: string } | null => {
  const o = a?.result?.origemExterna; if (!o) return null;
  const colada = /colada/i.test(String(o.sistema || ""));
  const sistema = String(o.sistema || "Agaia"), agaia = /agaia/i.test(sistema);
  return { rotulo: colada ? "✍ Colada" : `🤖 ${sistema.slice(0, 18)}`, dica: colada ? "Minuta feita fora do Studio e colada à mão no Histórico" : agaia ? `Analisado pelo Agaia${o.promptAgaia ? ` (prompt “${o.promptAgaia}”)` : ""}: a minuta não foi gerada pelo Studio` : `Analisada em ${sistema} (IA externa), com o prompt do Studio${o.promptAgaia ? ` “${o.promptAgaia}”` : ""}: a minuta não foi gerada pelo Studio` };
};

/** Sentença feita pela esteira da extensão com o VÍDEO da audiência: etiqueta própria no Histórico. */
export const origemVideo = (a: any): { rotulo: string; dica: string } | null => {
  const o = a?.result?.origemVideo; if (!o) return null;
  const n = Array.isArray(o.videos) ? o.videos.length : 0;
  return { rotulo: "🎙 Sentença c/ vídeo", dica: `Sentença feita com o vídeo da audiência (${n} mídia(s): ${(o.videos || []).join(", ").slice(0, 160)}). A degravação foi usada como prova oral e não está na minuta.` };
};


/** Motor do Studio que gerou a minuta (Principal, Turbo ou Gigante). Minutas antigas não têm etiqueta. */
export const motorDaMinuta = (a: any): { rotulo: string; dica: string } | null => {
  const m = String(a?.result?.motor || ""); if (!m) return null;
  if (m === "turbo") return { rotulo: "⚡ Turbo", dica: "Gerada pelo motor Turbo (rápido)." };
  if (m === "gigante") return { rotulo: "🐘 Gigante", dica: "Gerada pelo motor de autos gigantes (leitura em lotes, mapa do processo e dossiê)." };
  return { rotulo: "🧠 Principal", dica: "Gerada pelo motor principal (duas etapas: análise probatória e redação)." };
};

export type OrigemDoAto = "agaia" | "colada" | "video" | "studio";
/** Classifica o ato para o destaque visual: vídeo > externa (Agaia/colada) > Studio. */
export function origemDoAto(a: any): { tipo: OrigemDoAto; rotulo: string; dica: string } {
  const v = origemVideo(a); if (v) return { tipo: "video", ...v };
  const e = origemExterna(a); if (e) return { tipo: /colada/i.test(String(a?.result?.origemExterna?.sistema || "")) ? "colada" : "agaia", ...e };
  const mo = motorDaMinuta(a);
  if (mo) return { tipo: "studio", rotulo: `✨ Studio · ${mo.rotulo.replace(/^\S+\s/, "")}`, dica: mo.dica };
  return { tipo: "studio", rotulo: "✨ Studio", dica: "Minuta gerada pelo Studio (motor do Assessor Judicial)" };
}
