import React, { useEffect, useState } from "react";
import { listarServentiasProjudi, extensaoTemSeletorDeServentia, type ServentiaProjudi } from "../utils/minutaLancada";

// Caixa de seleção para o usuário indicar em QUAL serventia do Projudi procurar o processo (quando a extensão não o achou na serventia que tentou) e tentar de novo.
export function SeletorServentia({ processo, rotuloBotao = "Tentar de novo nesta serventia", aoTentar }: { processo: string; rotuloBotao?: string; aoTentar: (url: string) => void }) {
  const [lista, setLista] = useState<ServentiaProjudi[] | null>(null), [escolhida, setEscolhida] = useState("");
  useEffect(() => {
    let vivo = true;
    if (!extensaoTemSeletorDeServentia()) { setLista([]); return; }
    void listarServentiasProjudi(processo).then((r) => { if (!vivo) return; setLista(r.serventias); setEscolhida(r.sugerida || ""); });
    return () => { vivo = false; };
  }, [processo]);
  if (lista === null) return <p className="text-[11px] text-slate-400" data-testid="serventia-carregando">Carregando as serventias…</p>;
  if (!lista.length) return null;      // extensão antiga ou sem serventias conhecidas: só o "Tentar de novo" comum
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/60 p-2.5 space-y-1.5" data-testid="seletor-serventia">
      <label className="block text-[11px] text-slate-300 font-bold" htmlFor="sel-serventia-projudi">O processo pode estar em outra serventia. Escolha onde procurar no Projudi:</label>
      <div className="flex flex-wrap gap-2">
        <select id="sel-serventia-projudi" value={escolhida} onChange={(e) => setEscolhida(e.target.value)} data-testid="sel-serventia" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100">
          <option value="">Escolha a serventia…</option>
          {lista.map((x) => <option key={x.url} value={x.url}>{x.serventia}{x.perfil ? ` — ${x.perfil}` : ""}</option>)}
        </select>
        <button onClick={() => escolhida && aoTentar(escolhida)} disabled={!escolhida} data-testid="btn-tentar-serventia" className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">{rotuloBotao}</button>
      </div>
    </div>
  );
}
