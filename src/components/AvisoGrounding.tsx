import React from "react";

export interface InfoGrounding { status?: string; fontes?: { title?: string; url: string }[]; mensagem?: string }
const TEXTO: Record<string, string> = {
  ok: "A pesquisa ao vivo foi executada e trouxe fontes (links abaixo). Os precedentes encontrados foram oferecidos à IA na fundamentação; confira cada um no site oficial antes de assinar.",
  sem_fontes: "A pesquisa respondeu, mas sem links de fontes para conferir. O texto encontrado foi oferecido à IA, mas não há como verificar a origem: confira antes de citar.",
  sem_resultado: "A pesquisa ao vivo foi pedida, mas não trouxe resultado. A minuta foi feita só com os autos e a base interna.",
  falhou: "A pesquisa ao vivo falhou. A minuta foi feita só com os autos e a base interna.",
  desligado: "A pesquisa ao vivo (Grounding) está desligada. A minuta foi feita com os autos, a base interna e a legislação conferida. O Super Admin liga a opção em “Súmulas, Teses e Informativos”.",
};
/** Rótulo curto do botão do aviso, para o usuário saber de relance se a pesquisa ao vivo foi executada. */
export const rotuloGrounding = (status?: string, n = 0): string =>
  status === "ok" ? `🔎 Pesquisa ao vivo · ${n} fonte(s)` : status === "desligado" ? "🔎 Pesquisa ao vivo desligada" : status === "falhou" ? "🔎 Pesquisa ao vivo falhou" : status === "sem_fontes" ? "🔎 Pesquisa ao vivo · sem links" : "🔎 Pesquisa ao vivo · sem resultado";

export function AvisoGrounding({ info }: { info: InfoGrounding }) {
  const s = info.status || "desligado", cor = s === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : s === "desligado" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <div data-testid="aviso-grounding" className={`max-w-4xl mx-auto rounded-lg border px-3 py-2 text-xs space-y-1.5 ${cor}`}>
      <div><strong>Pesquisa ao vivo (Grounding)</strong> — {TEXTO[s] || TEXTO.sem_resultado}</div>
      {s === "falhou" && info.mensagem && <div className="text-[11px] opacity-80">Motivo: {info.mensagem}. Pode ser limite ou plano da chave do Google.</div>}
      {(info.fontes || []).length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5">
          {(info.fontes || []).map((f, i) => <li key={i}><a href={f.url} target="_blank" rel="noopener noreferrer" className="underline break-all">{f.title || f.url}</a></li>)}
        </ul>
      )}
    </div>
  );
}
