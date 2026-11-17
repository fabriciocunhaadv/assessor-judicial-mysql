import React, { useCallback, useEffect, useRef, useState } from "react";
import { Scissors, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { pedirRefazerParcial, extensaoInstalada, extensaoTemRefazerParcial } from "../utils/refazerParcial";
import { SeletorServentia } from "./SeletorServentia";

// “Refazer só com alguns eventos”: abre o Projudi (pela extensão) na serventia e no processo, até a janela “Gerar PDF”. O assessor marca as movimentações e devolve; a nova minuta chega como versão 2.
export function RefazerParcialModal({ processo, idDaMinuta, prompt, aoFechar }: { processo: string; idDaMinuta: string; prompt: string; aoFechar: () => void }) {
  const [fase, setFase] = useState<"abrindo" | "aberto" | "erro">("abrindo");
  const [andamento, setAndamento] = useState("Pedindo à extensão…");
  const [erro, setErro] = useState(""), [precisaServentia, setPrecisaServentia] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  const rodar = useCallback(async (serventiaUrl?: string) => {
    setFase("abrindo"); setErro(""); setPrecisaServentia(false); setAndamento("Pedindo à extensão…");
    if (!extensaoInstalada()) { setErro("Instale a extensão Conclusões Projudi e deixe o Projudi aberto e logado."); setFase("erro"); return; }
    if (!extensaoTemRefazerParcial()) { setErro("Atualize a extensão Conclusões Projudi (precisa da versão 4.0.0 ou mais nova) e recarregue esta página."); setFase("erro"); return; }
    ctl.current = new AbortController();
    const r = await pedirRefazerParcial({ processo, de: idDaMinuta, prompt, serventiaUrl }, setAndamento, ctl.current.signal);
    if (r.ok) { setFase("aberto"); setAndamento(r.texto || ""); return; }
    setErro(r.erro || "Não consegui abrir o Projudi."); setPrecisaServentia(!!r.precisaServentia); setFase("erro");
  }, [processo, idDaMinuta, prompt]);

  useEffect(() => { void rodar(undefined); return () => ctl.current?.abort(); }, [rodar]);

  return (
    <div className="fixed inset-0 z-[100002] bg-black/70 flex items-start sm:items-center justify-center p-3 overflow-y-auto" data-testid="modal-refazer-parcial">
      <div className="w-full max-w-xl my-2 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <Scissors className="w-5 h-5 text-amber-300" /><h2 className="font-black text-sm">Refazer só com alguns eventos</h2>
          <span className="text-[11px] text-slate-400 truncate">{processo}</span>
          <button onClick={aoFechar} className="ml-auto p-1 rounded-lg hover:bg-slate-800" aria-label="Fechar" data-testid="refazer-fechar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {fase === "abrindo" && (
            <div className="flex items-start gap-2" data-testid="refazer-abrindo"><Loader2 className="w-4 h-4 animate-spin text-amber-300 mt-0.5 shrink-0" /><div><p className="font-bold">Abrindo o Projudi…</p><p className="text-xs text-slate-400" data-testid="refazer-andamento">{andamento}</p></div></div>
          )}
          {fase === "aberto" && (
            <div className="space-y-2" data-testid="refazer-aberto">
              <p className="flex items-center gap-2 font-bold text-emerald-300"><CheckCircle2 className="w-4 h-4" />A janela “Gerar PDF” do Projudi está aberta.</p>
              <ol className="list-decimal pl-5 text-xs text-slate-300 space-y-1">
                <li>Na janela do Projudi, marque só as movimentações que importam (por exemplo, as últimas).</li>
                <li>Aperte o botão verde <b>“Devolver ao Studio e refazer a minuta”</b>.</li>
                <li>A extensão baixa só o que você marcou, faz o OCR e o Studio gera a <b>nova minuta (versão 2)</b>. A minuta atual continua guardada no Histórico.</li>
              </ol>
              <p className="text-[11px] text-amber-200/90">Atenção: uma análise com poucos eventos pode deixar de fora um fato antigo importante. A nova versão traz o aviso de quais movimentações foram usadas.</p>
              <button onClick={aoFechar} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold" data-testid="refazer-ok">Entendi</button>
            </div>
          )}
          {fase === "erro" && (
            <div className="space-y-2" data-testid="refazer-erro">
              <p className="flex items-start gap-2 text-rose-200"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span data-testid="refazer-erro-texto">{erro}</span></p>
              {precisaServentia && <SeletorServentia processo={processo} aoTentar={(url) => void rodar(url)} />}
              {!precisaServentia && <button onClick={() => void rodar(undefined)} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold" data-testid="refazer-tentar">Tentar de novo</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
