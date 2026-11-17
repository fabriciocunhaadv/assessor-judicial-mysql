import React, { useCallback, useEffect, useRef, useState } from "react";
import { GitCompare, X, Loader2, AlertTriangle, Copy } from "lucide-react";
import { buscarMinutaLancada, estadoDaExtensaoParaMinutaLancada } from "../utils/minutaLancada";
import { compararMinutas, textoDeHtml, type ResultadoComp, type BlocoComp } from "../utils/compararMinutas";

// Mostra o que mudou entre a minuta que o Studio gerou e a que ficou salva (lançada) na pré-análise do Projudi. Só Super Admin (o botão só aparece para ele; o servidor também confere).
export function ComparacaoMinutaModal({ processo, textoGerado, cabecalho, ato, promptTitulo, aoFechar }: { processo: string; textoGerado: string; cabecalho?: string; ato: string; promptTitulo?: string; aoFechar: () => void }) {
  const [fase, setFase] = useState<"lendo" | "pronto" | "erro">("lendo");
  const [andamento, setAndamento] = useState("Pedindo o texto à extensão…");
  const [erro, setErro] = useState(""), [tela, setTela] = useState("");
  const [res, setRes] = useState<ResultadoComp | null>(null);
  const [guardado, setGuardado] = useState<"" | "sim" | "nao">("");
  const [verIguais, setVerIguais] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  const rodar = useCallback(async () => {
    setFase("lendo"); setErro(""); setTela(""); setRes(null); setGuardado("");
    const est = estadoDaExtensaoParaMinutaLancada();
    if (est !== "ok") { setErro(est === "antiga" ? "Atualize a extensão Conclusões Projudi (precisa da versão 3.0.6 ou mais nova)." : "Instale a extensão Conclusões Projudi e deixe o Projudi aberto e logado."); setFase("erro"); return; }
    ctl.current = new AbortController();
    const r = await buscarMinutaLancada(processo, setAndamento, ctl.current.signal, ((cabecalho || "") + "\n" + textoGerado).slice(0, 1500));
    if (!r.ok) { setErro(r.erro || "Não consegui ler a minuta no Projudi."); setTela(r.tela || ""); setFase("erro"); return; }
    const texto = textoDeHtml(r.html || "");
    if (texto.replace(/\s+/g, " ").length < 120) { setErro("O editor da pré-análise veio quase vazio (só o modelo-padrão?). Salve o texto parcial no Projudi e tente de novo."); setTela(r.tela || ""); setFase("erro"); return; }
    const c = compararMinutas(textoGerado, texto);
    setRes(c); setFase("pronto");
    try {      // guarda para a calibragem (só números, trechos curtos do que mudou e o texto lançado)
      const mudancas = c.blocos.filter((b) => b.tipo !== "igual").slice(0, 80).map((b) => ({ tipo: b.tipo, secao: b.secao, original: b.original, lancado: b.lancado }));
      const resp = await fetch("/api/comparacoes-minuta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processo, ato, promptTitulo, ...c, blocos: undefined, mudancas, textoLancado: texto, textoGerado }) });
      setGuardado(resp.ok ? "sim" : "nao");
    } catch { setGuardado("nao"); }
  }, [processo, textoGerado, cabecalho, ato, promptTitulo]);

  useEffect(() => { void rodar(); return () => ctl.current?.abort(); }, [rodar]);

  const cor = (p: number) => (p >= 85 ? "text-emerald-300" : p >= 60 ? "text-amber-300" : "text-rose-300");
  const bloco = (b: BlocoComp, i: number) => {
    if (b.tipo === "igual") return verIguais ? <p key={i} className="text-xs text-slate-400 leading-relaxed">{b.original}</p> : null;
    if (b.tipo === "removido") return <p key={i} className="text-xs leading-relaxed rounded-lg bg-rose-950/50 border border-rose-700/50 text-rose-100 px-2 py-1"><span className="font-bold mr-1">CORTADO ({b.secao}):</span><span className="line-through decoration-rose-400/70">{b.original}</span></p>;
    if (b.tipo === "adicionado") return <p key={i} className="text-xs leading-relaxed rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-100 px-2 py-1"><span className="font-bold mr-1">ACRESCENTADO ({b.secao}):</span>{b.lancado}</p>;
    return <p key={i} className="text-xs leading-relaxed rounded-lg bg-slate-800/70 border border-slate-600 px-2 py-1"><span className="font-bold mr-1 text-amber-300">ALTERADO ({b.secao}):</span>{(b.partes || []).map((p, k) => p.t === "=" ? <span key={k}>{p.s} </span> : p.t === "-" ? <span key={k} className="bg-rose-900/60 text-rose-200 line-through">{p.s} </span> : <span key={k} className="bg-emerald-900/60 text-emerald-200">{p.s} </span>)}</p>;
  };

  return (
    <div className="fixed inset-0 z-[100002] bg-black/70 flex items-start sm:items-center justify-center p-3 overflow-y-auto" data-testid="modal-comparacao-minuta">
      <div className="w-full max-w-4xl my-2 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <GitCompare className="w-5 h-5 text-sky-300" /><h2 className="font-black text-sm">Minuta gerada × minuta lançada no Projudi</h2>
          <span className="text-[11px] text-slate-400 truncate">{processo}</span>
          <button onClick={aoFechar} aria-label="Fechar" className="ml-auto p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {fase === "lendo" && <div className="flex items-center gap-2 text-xs text-sky-200" data-testid="comparacao-lendo"><Loader2 className="w-4 h-4 animate-spin" /> {andamento}</div>}
          {fase === "erro" && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs text-rose-100 space-y-2" data-testid="comparacao-erro">
              <div className="flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{erro}</span></div>
              {tela && <details><summary className="cursor-pointer text-[11px] text-rose-300">O que a extensão viu na tela (para diagnóstico)</summary><p className="mt-1 text-[11px] text-slate-300 break-words">{tela}</p><button onClick={() => { try { void navigator.clipboard.writeText(tela); } catch { /* sem cópia */ } }} className="mt-1 inline-flex items-center gap-1 text-[11px] underline cursor-pointer"><Copy className="w-3 h-3" /> copiar</button></details>}
              <button onClick={() => void rodar()} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer">Tentar de novo</button>
            </div>
          )}
          {fase === "pronto" && res && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="comparacao-resumo">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase text-slate-400 font-bold">Aproveitamento</div><div className={`text-2xl font-black ${cor(res.aproveitamentoPct)}`}>{res.aproveitamentoPct}%</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase text-slate-400 font-bold">Mantidas</div><div className="text-2xl font-black">{res.mantidas.toLocaleString("pt-BR")}</div><div className="text-[10px] text-slate-400">palavras</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase text-slate-400 font-bold">Cortadas</div><div className="text-2xl font-black text-rose-300">{res.removidas.toLocaleString("pt-BR")}</div><div className="text-[10px] text-slate-400">palavras</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase text-slate-400 font-bold">Acrescentadas</div><div className="text-2xl font-black text-emerald-300">{res.acrescentadas.toLocaleString("pt-BR")}</div><div className="text-[10px] text-slate-400">palavras</div></div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs" data-testid="comparacao-secoes">
                {res.porSecao.map((s) => <span key={s.secao} className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900/70">{s.secao}: <strong className={cor(s.aproveitamentoPct)}>{s.aproveitamentoPct}%</strong></span>)}
                {res.dispositivoMudou && <span className="px-2 py-1 rounded-lg border border-amber-500/60 bg-amber-950/50 text-amber-200 font-bold" data-testid="comparacao-dispositivo-mudou">⚠ O dispositivo (resultado) foi alterado</span>}
              </div>
              <div className="text-[11px] text-slate-400">{guardado === "sim" ? "Comparação guardada para a calibragem." : guardado === "nao" ? "Não consegui guardar a comparação (o resultado abaixo continua válido)." : "Guardando…"} O cabeçalho e a assinatura padrão do Projudi não entram na conta.</div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer"><input type="checkbox" checked={verIguais} onChange={(e) => setVerIguais(e.target.checked)} /> mostrar também os trechos que ficaram iguais</label>
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1" data-testid="comparacao-blocos">{res.blocos.map(bloco)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
