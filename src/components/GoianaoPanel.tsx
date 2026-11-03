import React, { useEffect, useState } from "react";
import { X, Trophy, RefreshCw } from "lucide-react";
import { getApiHeaders } from "../utils/apiKeyManager";
import { ROTULO_CATEGORIA, type ResumoGoianao } from "../utils/goianao";

/** Prêmio TJGO de Produtividade 2027 (Goianão): o que o gabinete produziu pelo Studio (inclusive minutas do Agaia) no período avaliado. Não é a pontuação oficial. */
export const GoianaoPanel: React.FC<{ isOpen: boolean; onClose: () => void; unitId: string }> = ({ isOpen, onClose, unitId }) => {
  const [r, setR] = useState<(ResumoGoianao & { ok?: boolean }) | null>(null);
  const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(false);
  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const resp = await fetch(`/api/db/history/goianao/resumo?unit=${encodeURIComponent(unitId || "montes_claros")}`, { headers: getApiHeaders() });
      const j = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(j.erro || `erro ${resp.status}`); setR(j);
    } catch (e: any) { setErro(e?.message || "não consegui carregar"); } finally { setCarregando(false); }
  };
  useEffect(() => { if (isOpen) void carregar(); }, [isOpen, unitId]);
  if (!isOpen) return null;
  const data = (t: number) => new Date(t).toLocaleDateString("pt-BR");
  const linhas = (o: Record<string, number>, rot?: (k: string) => string) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
    <div key={k} className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800 text-xs"><span>{rot ? rot(k) : k}</span><strong>{v}</strong></div>));
  return (
    <div className="fixed inset-0 z-[100000] flex items-start sm:items-center justify-center p-3 bg-black/60 overflow-y-auto" data-testid="goianao-painel">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-3xl p-5 my-2 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Prêmio TJGO de Produtividade 2027 (Goianão)</h2>
            <p className="text-[11px] text-slate-500">Período avaliado: {data(r?.periodo.inicio ?? Date.parse("2026-08-01T12:00:00-03:00"))} a {data(r?.periodo.fim ?? Date.parse("2027-07-31T12:00:00-03:00"))} · Edital 01/2026</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => void carregar()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Atualizar"><RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} /></button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Fechar" data-testid="goianao-fechar"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="text-[11px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
          Este painel mostra só o que passou pelo Studio (inclusive as minutas do Agaia, pela extensão ou coladas). <strong>Não é a pontuação oficial</strong>: ela sai do DataJud, no painel do TJGO (Gestão à Vista). Quando o ato foi marcado como lançado no Projudi, vale a data do lançamento; senão, a da minuta. Onde o Studio não tinha o movimento TPU, o julgamento é <strong>estimado</strong> pelo dispositivo.
        </div>
        {erro && <p className="text-xs text-red-600" data-testid="goianao-erro">Não consegui carregar: {erro}</p>}
        {r && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="goianao-totais">
              {[["Atos no período", r.totalAtos], ["Lançados no Projudi", r.lancados], ["Processos com julgamento", r.processosComJulgamento], ["Julgamentos estimados", r.julgamentosEstimados]].map(([t, v]) => (
                <div key={String(t)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center"><div className="text-2xl font-black">{v as number}</div><div className="text-[10px] text-slate-500 font-semibold">{t}</div></div>))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><h3 className="text-xs font-black mb-1">Por origem</h3>{linhas(r.porOrigem)}</div>
              <div><h3 className="text-xs font-black mb-1">Por tipo de ato</h3>{linhas(r.porTipo, (k) => ({ sentenca: "Sentença", decisao: "Decisão", despacho: "Despacho", outro: "Outro" } as any)[k] || k)}</div>
              <div><h3 className="text-xs font-black mb-1">Pelo Anexo III do edital</h3>{linhas(r.porCategoria, (k) => (ROTULO_CATEGORIA as any)[k] || k)}</div>
              <div><h3 className="text-xs font-black mb-1">Por mês (atos / julgamentos)</h3>
                {Object.entries(r.porMes).sort().map(([m, v]) => <div key={m} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-xs"><span>{m}</span><strong>{v.atos} / {v.julgamentos}</strong></div>)}
              </div>
            </div>
            {r.semClassificacao.length > 0 && (
              <div data-testid="goianao-sem-classificacao">
                <h3 className="text-xs font-black mb-1">Sentenças sem movimento identificado ({r.semClassificacao.length}): confira o movimento no Projudi</h3>
                <div className="max-h-40 overflow-y-auto text-[11px] space-y-0.5">{r.semClassificacao.map((x, i) => <div key={i}>{x.processo || "(sem número)"} · {x.origem} · {x.titulo}</div>)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
