import React, { useEffect, useState } from "react";
import { entradasExternas, type EntradaExterna } from "../utils/entradaExterna";
import { useAuth } from "../lib/AuthContext";
import { useUmAbertoPorVez, CLASSE_PAINEL_FLUTUANTE } from "../utils/flutuantes";

const ROTULO: Record<EntradaExterna["status"], string> = { recebida: "Recebida", gravando: "Gravando no Histórico…", gravada: "✔ No Histórico", tentando: "⚠ Tentando de novo" };

// Selo discreto (canto inferior esquerdo) com as minutas que chegaram do Agaia e estão sendo gravadas em segundo plano. Não interrompe o que a pessoa está fazendo.
export function EntradaAgaia({ onVerHistorico }: { onVerHistorico?: () => void }) {
  const { allowedUnits, activeUnit } = useAuth() as any;
  const [lista, setLista] = useState<EntradaExterna[]>([]);
  const [aberto, setAberto] = useState(false);
  useUmAbertoPorVez("agaia", aberto, () => setAberto(false));
  const [colar, setColar] = useState({ processo: "", unidadeId: "", prompt: "", texto: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { void entradasExternas.carregar(); return entradasExternas.inscrever(setLista); }, []);
  useEffect(() => { const abrir = () => setAberto(true); window.addEventListener("agaia:abrir", abrir); return () => window.removeEventListener("agaia:abrir", abrir); }, []);
  const unidades: { id: string; name: string }[] = allowedUnits || [];
  const unidadeEscolhida = colar.unidadeId || activeUnit?.id || unidades[0]?.id || "";
  const gravarColada = async () => {
    const cnj = (colar.processo.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || colar.texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [""])[0];
    if (!cnj) return setMsg({ ok: false, t: "Informe o número do processo completo (ex.: 5189520-44.2026.8.09.0166)." });
    if (colar.texto.trim().length < 100) return setMsg({ ok: false, t: "Cole o texto da minuta (muito curto)." });
    setEnviando(true);
    const un = unidades.find((u) => u.id === unidadeEscolhida);
    const r = await entradasExternas.receber({ processo: cnj, serventia: un?.name || "", unidadeId: unidadeEscolhida, prompt: colar.prompt.trim(), minutaTexto: colar.texto, origem: "Colada manualmente" }).catch((e: any) => ({ ok: false, erro: String(e?.message || e) }));
    setEnviando(false);
    if (r.ok) { setMsg({ ok: true, t: "Minuta recebida: está sendo gravada no Histórico em segundo plano. Você pode continuar trabalhando." }); setColar({ processo: "", unidadeId: colar.unidadeId, prompt: colar.prompt, texto: "" }); }
    else setMsg({ ok: false, t: r.erro || "Não consegui receber a minuta." });
  };
  if (lista.length === 0 && !aberto) return null;
  const pendentes = lista.filter((e) => e.status !== "gravada").length;
  return (
    <>
      {lista.length > 0 && <button onClick={() => setAberto((v) => !v)} className="fixed bottom-[6.75rem] left-3 z-[8998] px-3 py-2 rounded-full bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-lg border border-teal-400 cursor-pointer flex items-center gap-2" data-testid="agaia-selo" title="Minutas que chegaram do Agaia">
        <span>🤖 Agaia</span>
        <span className="px-1.5 rounded-full bg-white/20">{pendentes > 0 ? `${pendentes} gravando` : `${lista.length} no Histórico`}</span>
      </button>}
      {aberto && (
        <div className={`${CLASSE_PAINEL_FLUTUANTE} w-[min(96vw,28rem)] overflow-y-auto bg-white text-slate-800 rounded-2xl shadow-2xl border border-teal-300 p-3 space-y-2`} data-testid="agaia-painel">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-teal-900">🤖 Minutas do Agaia</h3><button onClick={() => setAberto(false)} className="text-xs text-slate-500 cursor-pointer">fechar</button></div>
          <p className="text-[11px] text-slate-600 leading-snug">As minutas feitas no Agaia chegam pela esteira e são gravadas no Histórico em segundo plano, na unidade da serventia e com o prompt usado. Você não precisa esperar: continue trabalhando e abra o Histórico depois. Se a internet cair ou a página for atualizada, a gravação continua sozinha quando voltar.</p>
          <details className="rounded-lg border border-teal-200 bg-teal-50/50 p-2 text-[11px]" data-testid="agaia-colar">
            <summary className="font-bold text-teal-900 cursor-pointer">➕ Colar uma minuta feita fora do Studio</summary>
            <div className="mt-2 space-y-1.5">
              <p className="text-slate-600 leading-snug">Para a minuta que você fez à mão no Agaia (ou em outro sistema): ela é gravada no Histórico, na unidade escolhida, como as demais.</p>
              <input value={colar.processo} onChange={(e) => setColar({ ...colar, processo: e.target.value })} placeholder="Número do processo (5189520-44.2026.8.09.0166)" className="w-full px-2 py-1 rounded border border-slate-300" data-testid="agaia-colar-processo" />
              <select value={unidadeEscolhida} onChange={(e) => setColar({ ...colar, unidadeId: e.target.value })} className="w-full px-2 py-1 rounded border border-slate-300">{unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <input value={colar.prompt} onChange={(e) => setColar({ ...colar, prompt: e.target.value })} placeholder="Prompt usado (opcional)" className="w-full px-2 py-1 rounded border border-slate-300" />
              <textarea value={colar.texto} onChange={(e) => setColar({ ...colar, texto: e.target.value })} rows={6} placeholder="Cole aqui o texto da minuta" className="w-full px-2 py-1 rounded border border-slate-300" data-testid="agaia-colar-texto" />
              <div className="flex items-center gap-2"><button disabled={enviando} onClick={() => void gravarColada()} className="px-3 py-1 rounded bg-teal-700 text-white font-bold cursor-pointer disabled:opacity-50" data-testid="agaia-colar-gravar">Gravar no Histórico</button>{msg && <span className={msg.ok ? "text-emerald-700" : "text-red-700"}>{msg.t}</span>}</div>
            </div>
          </details>
          {lista.length === 0 && <div className="text-[11px] text-slate-500">Nenhuma minuta do Agaia recebida ainda.</div>}
          {lista.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-200 p-2 text-[11px] space-y-0.5" data-testid="agaia-item">
              <div className="flex items-center justify-between gap-2"><span className="font-bold truncate">{e.processo}</span><span className={`px-1.5 rounded-full text-[10px] font-bold ${e.status === "gravada" ? "bg-emerald-100 text-emerald-800" : e.status === "tentando" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>{ROTULO[e.status]}</span></div>
              <div className="text-slate-500 truncate">{e.prompt || ""}</div>
              {e.erro && e.status !== "gravada" && <div className="text-amber-700">{e.erro}</div>}
              <div className="flex gap-2 pt-0.5">
                {e.status === "gravada" && onVerHistorico && <button onClick={onVerHistorico} className="px-2 py-0.5 rounded bg-teal-700 text-white font-bold cursor-pointer">Abrir o Histórico</button>}
                {e.status === "tentando" && <button onClick={() => void entradasExternas.retomar()} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Tentar agora</button>}
                {e.status === "gravada" && <button onClick={() => void entradasExternas.remover(e.id)} className="px-2 py-0.5 rounded border border-slate-300 cursor-pointer">Remover da lista</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
