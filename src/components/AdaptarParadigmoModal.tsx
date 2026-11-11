// "Adaptar a um paradigma": depois que a minuta está pronta, o usuário escolhe um modelo do juiz (o sugerido já vem marcado) e o sistema reorganiza SÓ a estrutura e o estilo,
// sem reler os autos. Mostra o antes e o depois lado a lado; só substitui se o usuário aceitar. A minuta original continua guardada nas versões.
import React, { useEffect, useMemo, useState } from "react";
import { X, Gavel, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { MinuteData } from "../types";
import { getJudgeParadigms, PARADIGMS_UPDATE_EVENT } from "../utils/judgeParadigmsDb";
import { detectMatchingParadigms } from "../utils/paradigmMatcher";
import { getApiHeaders } from "../utils/apiKeyManager";

const textoDaMinuta = (m: MinuteData) => (m.fullFormattedText && m.fullFormattedText.trim().length > 200 ? m.fullFormattedText : [m.header, m.title, m.relatorio && `I - RELATÓRIO\n${m.relatorio}`, m.fundamentacao && `II - FUNDAMENTAÇÃO\n${m.fundamentacao}`, m.dispositivo && `III - DISPOSITIVO\n${m.dispositivo}`, m.closing].filter(Boolean).join("\n\n")).replace(/\\n/g, "\n");

interface Props { aberto: boolean; aoFechar: () => void; minuta: MinuteData; tituloDoPrompt?: string; aoAplicar: (nova: MinuteData, tituloModelo: string, avisos: string[]) => void }

export const AdaptarParadigmoModal: React.FC<Props> = ({ aberto, aoFechar, minuta, tituloDoPrompt, aoAplicar }) => {
  const [modelos, setModelos] = useState(() => getJudgeParadigms());
  const [escolhido, setEscolhido] = useState<string>("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const [proposta, setProposta] = useState<{ minute: any; avisos: string[] } | null>(null);

  useEffect(() => { const f = () => setModelos(getJudgeParadigms()); window.addEventListener(PARADIGMS_UPDATE_EVENT, f); return () => window.removeEventListener(PARADIGMS_UPDATE_EVENT, f); }, []);
  const sugestoes = useMemo(() => {
    try { return detectMatchingParadigms([textoDaMinuta(minuta), tituloDoPrompt || ""].join(" "), modelos, minuta.processNumber); } catch { return []; }
  }, [minuta, modelos, tituloDoPrompt]);
  const sugerido = sugestoes[0]?.paradigm.id || "";
  useEffect(() => { if (aberto) { setProposta(null); setErro(""); setEscolhido((x) => x || sugerido); } }, [aberto, sugerido]);
  if (!aberto) return null;

  const modelo = modelos.find((p) => p.id === escolhido);
  const rodar = async () => {
    if (!modelo) return;
    setRodando(true); setErro(""); setProposta(null);
    try {
      const r = await fetch("/api/reestruturar-minuta", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ minute: minuta, paradigmText: modelo.fullText, paradigmTitle: modelo.title }) });
      const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { throw new Error("O servidor não devolveu a resposta (a conexão pode ter caído). Tente de novo."); }
      if (!r.ok || !j.success) throw new Error(j.error || "Não foi possível reorganizar a minuta.");
      setProposta({ minute: j.minute, avisos: Array.isArray(j.avisos) ? j.avisos : [] });
    } catch (e: any) { setErro(e?.message || String(e)); } finally { setRodando(false); }
  };
  const aceitar = () => {
    if (!proposta || !modelo) return;
    const n = proposta.minute;
    const nova: MinuteData = { ...minuta, title: n.title || minuta.title, relatorio: n.relatorio || minuta.relatorio, fundamentacao: n.fundamentacao || minuta.fundamentacao, dispositivo: n.dispositivo || minuta.dispositivo, closing: n.closing || minuta.closing, fullFormattedText: n.fullFormattedText || "" };
    if (!nova.fullFormattedText) nova.fullFormattedText = textoDaMinuta(nova);
    aoAplicar(nova, modelo.title, proposta.avisos); aoFechar();
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-900/60 flex items-center justify-center p-3" role="dialog" aria-modal="true" data-testid="adaptar-paradigma">
      <div className="bg-white text-slate-800 rounded-2xl shadow-2xl border border-amber-300 w-[min(98vw,72rem)] max-h-[94vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 bg-amber-50">
          <h3 className="text-sm font-black text-amber-900 flex items-center gap-2"><Gavel className="w-4 h-4" /> Adaptar a minuta a um paradigma</h3>
          <button onClick={aoFechar} className="text-slate-500 hover:text-slate-800 cursor-pointer" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-600">O sistema reorganiza <strong>só a estrutura e o estilo</strong> desta minuta conforme o modelo escolhido, <strong>sem reler os autos</strong>. Fatos, partes, datas, valores, citações e o resultado ficam como estão. Você vê o antes e o depois e só então decide.</p>
          {modelos.length === 0 ? <div className="text-xs text-red-700 bg-red-50 rounded p-2">Nenhum modelo cadastrado. Cadastre em Teses & Modelos → “Modelos de Decisões”.</div> : (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700" htmlFor="par-esc">Modelo (paradigma)</label>
              <select id="par-esc" value={escolhido} onChange={(e) => { setEscolhido(e.target.value); setProposta(null); }} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" data-testid="adaptar-select">
                <option value="">— escolha um modelo —</option>
                {modelos.map((p) => <option key={p.id} value={p.id}>{p.id === sugerido ? "★ Sugerido: " : ""}{p.title}{p.category ? ` · ${p.category}` : ""}</option>)}
              </select>
              {!sugerido && <div className="text-[11px] text-slate-500">O sistema não achou um modelo claramente parecido: escolha o que preferir.</div>}
              {sugerido && escolhido === sugerido && <div className="text-[11px] text-emerald-700">Sugerido pelo sistema ({sugestoes[0].confidenceScore}% de semelhança: {sugestoes[0].reason}).</div>}
            </div>
          )}
          <button onClick={rodar} disabled={!modelo || rodando} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center gap-2" data-testid="adaptar-rodar">
            {rodando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reorganizando…</> : "Reestruturar"}
          </button>
          {erro && <div className="text-xs text-red-700 bg-red-50 rounded p-2" data-testid="adaptar-erro">{erro}</div>}
          {proposta && (
            <div className="space-y-2" data-testid="adaptar-resultado">
              {proposta.avisos.length > 0
                ? <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded p-2 space-y-1"><div className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Confira antes de aceitar:</div><ul className="list-disc pl-4">{proposta.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                : <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Valores, datas e citações da minuta original foram conferidos e estão na versão reorganizada.</div>}
              <div className="grid md:grid-cols-2 gap-2">
                <div className="min-w-0"><div className="text-[11px] font-bold text-slate-600 mb-1">Antes (minuta atual)</div><pre className="whitespace-pre-wrap break-words text-[11px] leading-snug bg-slate-50 border border-slate-200 rounded p-2 max-h-[48vh] overflow-y-auto font-sans">{textoDaMinuta(minuta)}</pre></div>
                <div className="min-w-0"><div className="text-[11px] font-bold text-amber-800 mb-1">Depois (no modelo “{modelo?.title}”)</div><pre className="whitespace-pre-wrap break-words text-[11px] leading-snug bg-amber-50/50 border border-amber-200 rounded p-2 max-h-[48vh] overflow-y-auto font-sans" data-testid="adaptar-depois">{(proposta.minute.fullFormattedText || textoDaMinuta(proposta.minute)).replace(/\\n/g, "\n")}</pre></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={aoFechar} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer" data-testid="adaptar-descartar">Descartar</button>
                <button onClick={aceitar} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer" data-testid="adaptar-aceitar">Aceitar e substituir a minuta</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
