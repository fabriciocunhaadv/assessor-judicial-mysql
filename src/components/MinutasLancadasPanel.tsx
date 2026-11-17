import React, { useCallback, useEffect, useRef, useState } from "react";
import { GitCompare, RefreshCw, Loader2, AlertTriangle, Sparkles, FileUp, Copy, Trash2, FlaskConical, Download, Check } from "lucide-react";
import { compararMinutas } from "../utils/compararMinutas";
import { extractTextFromPdf } from "../utils/pdfExtractor";
import { montarPacoteCalibragem } from "../utils/pacoteCalibragem";

// Aba "Minutas lançadas" do Super Admin: padrões do que o juiz/assessor mantém, corta e acrescenta; comparação com o documento ASSINADO (PDF) e resumo por IA com sugestões de prompt (só sugere; nada é alterado sozinho).
interface Grupo { nome: string; n: number; aproveitamentoPct: number; dispositivoAlteradoPct: number }
interface Padroes {
  total: number; aproveitamentoMedioPct: number; coberturaMediaPct: number; dispositivoAlteradoPct: number; porSecao: { secao: string; n: number; aproveitamentoPct: number }[];
  porPrompt: Grupo[]; porMotor: Grupo[]; porAto: Grupo[]; maisCortados: { trecho: string; vezes: number; secao: string }[]; maisAcrescentados: { trecho: string; vezes: number; secao: string }[];
  assinados: { n: number; aproveitamentoLancadaPct: number; aproveitamentoGeradaPct: number | null; dispositivoMudouPct: number };
}
interface Linha { id: string; origem?: string; motivo?: string; por?: string; nomeUsuario?: string; processo: string; ato?: string; geradoEm: number; promptTitulo?: string; motor?: string; aproveitamentoPct: number; dispositivoMudou: boolean; mudancas?: { tipo: string; secao: string; original?: string; lancado?: string }[]; assinado?: { aproveitamentoLancadaPct: number; aproveitamentoGeradaPct: number | null; dispositivoMudouDaLancada: boolean; arquivo?: string } }
interface Resumo { base: number; resumo: string; padroes: string[]; sugestoes: { titulo: string; secao: string; instrucao: string; motivo: string; confianca: string }[] }

const quando = (t: number) => { try { return new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const diasRestantes = (t: number) => Math.max(0, 30 - Math.floor((Date.now() - t) / 86_400_000));
const cor = (p: number) => (p >= 85 ? "text-emerald-300" : p >= 60 ? "text-amber-300" : "text-rose-300");
async function api<T>(rota: string, corpo?: any): Promise<T> {
  const r = await fetch(rota, corpo === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  let j: any = {}; try { j = await r.json(); } catch { /* corpo vazio */ }
  if (!r.ok) throw new Error(j?.erro || `erro ${r.status}`);
  return j as T;
}

export function MinutasLancadasPanel() {
  const [pad, setPad] = useState<Padroes | null>(null), [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false), [erro, setErro] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null), [resumindo, setResumindo] = useState(false), [erroResumo, setErroResumo] = useState("");
  const [aberta, setAberta] = useState<string>(""), [msgAssinado, setMsgAssinado] = useState<Record<string, string>>({}), [lendo, setLendo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null), alvo = useRef("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set()), [confirmar, setConfirmar] = useState<"" | "marcadas" | "todas" | string>(""), [apagando, setApagando] = useState(false), [msgApagar, setMsgApagar] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { const [p, l] = await Promise.all([api<{ padroes: Padroes }>("/api/comparacoes-minuta/padroes"), api<{ comparacoes: Linha[] }>("/api/comparacoes-minuta")]); setPad(p.padroes); setLinhas(l.comparacoes); }
    catch (e: any) { setErro(e.message); }
    setCarregando(false);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const gerarResumo = async () => {
    setResumindo(true); setErroResumo(""); setResumo(null);
    try { setResumo(await api<Resumo>("/api/comparacoes-minuta/resumo", {})); } catch (e: any) { setErroResumo(e.message); }
    setResumindo(false);
  };

  const anexar = async (arq: File, id: string) => {
    setLendo(id); setMsgAssinado((m) => ({ ...m, [id]: "Lendo o PDF…" }));
    try {
      const pdf = await extractTextFromPdf(arq);
      if (!pdf.hasText || pdf.text.replace(/\s+/g, " ").length < 200) throw new Error("O PDF não tem texto legível (escaneado?). Rode o OCR e tente de novo.");
      const t = await api<{ textoGerado: string; textoLancado: string }>(`/api/comparacoes-minuta/${encodeURIComponent(id)}/textos`);
      if (!t.textoLancado) throw new Error("Esta comparação não guardou o texto lançado.");
      const dl = compararMinutas(t.textoLancado, pdf.text);
      const dg = t.textoGerado ? compararMinutas(t.textoGerado, pdf.text) : null;
      const mudancas = dl.blocos.filter((b) => b.tipo !== "igual").slice(0, 60).map((b) => ({ tipo: b.tipo, secao: b.secao, original: b.original, lancado: b.lancado }));
      await api(`/api/comparacoes-minuta/${encodeURIComponent(id)}/assinado`, { aproveitamentoLancadaPct: dl.aproveitamentoPct, aproveitamentoGeradaPct: dg ? dg.aproveitamentoPct : null, dispositivoMudouDaLancada: dl.dispositivoMudou, arquivo: arq.name, mudancas });
      setMsgAssinado((m) => ({ ...m, [id]: `Guardado: a assinada manteve ${dl.aproveitamentoPct}% da lançada${dg ? ` e ${dg.aproveitamentoPct}% da gerada` : ""}${dl.dispositivoMudou ? " — ⚠ o dispositivo mudou na assinatura" : ""}.` }));
      void carregar();
    } catch (e: any) { setMsgAssinado((m) => ({ ...m, [id]: `Erro: ${e.message}` })); }
    setLendo("");
  };

  // Pacote para o laboratório (conversa com o Claude): arquivo geral INTEIRO, com os textos gerado e lançado de cada comparação (as marcadas, ou todas se nenhuma estiver marcada)
  const [pacote, setPacote] = useState<{ texto: string; n: number } | null>(null), [montando, setMontando] = useState(false), [msgPacote, setMsgPacote] = useState("");
  const prepararPacote = async () => {
    setMontando(true); setMsgPacote(""); setPacote(null);
    try {
      const r = await api<{ comparacoes: any[]; geradoEm: number }>("/api/comparacoes-minuta/exportar", { ids: [...marcadas] });
      setPacote({ texto: montarPacoteCalibragem(r.comparacoes, r.geradoEm), n: r.comparacoes.length });
    } catch (e: any) { setMsgPacote(`Erro ao montar o pacote: ${e.message}`); }
    setMontando(false);
  };
  const copiarPacote = async () => {
    if (!pacote) return;
    try { await navigator.clipboard.writeText(pacote.texto); setMsgPacote("Copiado para a área de transferência. Cole na conversa com o Claude."); }
    catch { setMsgPacote("O navegador bloqueou a cópia automática: use “Baixar arquivo” e anexe o arquivo na conversa."); }
  };
  const baixarPacote = () => {
    if (!pacote) return;
    try {
      const url = URL.createObjectURL(new Blob([pacote.texto], { type: "text/markdown;charset=utf-8" })), a = document.createElement("a");
      a.href = url; a.download = `pacote-calibragem-${new Date().toISOString().slice(0, 10)}.md`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsgPacote("Arquivo baixado. Anexe na conversa com o Claude.");
    } catch { setMsgPacote("Não consegui baixar o arquivo: use “Copiar”."); }
  };
  const alternar = (id: string) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const apagar = async (modo: "marcadas" | "todas" | string) => {
    setApagando(true); setMsgApagar("");
    try {
      const corpo = modo === "todas" ? { todas: true } : { ids: modo === "marcadas" ? [...marcadas] : [modo] };
      const r = await api<{ apagadas: number }>("/api/comparacoes-minuta/apagar", corpo);
      setMsgApagar(`${r.apagadas} comparação(ões) apagada(s).`); setMarcadas(new Set()); setResumo(null); await carregar();
    } catch (e: any) { setMsgApagar(`Erro ao apagar: ${e.message}`); }
    setApagando(false); setConfirmar("");
  };
  const copiar = (t: string) => { try { void navigator.clipboard.writeText(t); } catch { /* sem cópia */ } };
  const card = (t: string, v: React.ReactNode, sub?: string) => <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase text-slate-400 font-bold">{t}</div><div className="text-2xl font-black">{v}</div>{sub && <div className="text-[10px] text-slate-400">{sub}</div>}</div>;
  const tabela = (titulo: string, g: Grupo[]) => g.length > 0 && (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="text-xs font-black mb-1.5">{titulo}</div>
      {g.map((x) => <div key={x.nome} className="flex items-center gap-2 text-[11px] py-0.5"><span className="min-w-0 flex-1 truncate">{x.nome}</span><span className="text-slate-400">{x.n}×</span><span className={`font-bold ${cor(x.aproveitamentoPct)}`}>{x.aproveitamentoPct}%</span><span className="text-slate-500" title="minutas em que o dispositivo mudou">disp. {x.dispositivoAlteradoPct}%</span></div>)}
    </div>);

  return (
    <div className="p-4 space-y-4 text-slate-100" data-testid="painel-minutas-lancadas">
      <div className="flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-sky-300" /><h2 className="font-black">Minutas lançadas — calibragem</h2>
        <button onClick={() => void carregar()} disabled={carregando} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs cursor-pointer disabled:opacity-50">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
      </div>
      <p className="text-[11px] text-slate-400">A minuta <strong>lançada no Projudi é a referência</strong> (o que vale). O Studio é medido por quanto chega perto dela: <em>cobertura</em> = quanto da lançada ele já tinha; <em>aproveitamento</em> = quanto do que ele escreveu sobrou. <strong>As comparações (com as minutas guardadas) são apagadas sozinhas depois de 30 dias.</strong></p>
      {erro && <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs flex gap-2" data-testid="minutas-erro"><AlertTriangle className="w-4 h-4 shrink-0" />{erro}</div>}
      {pad && pad.total === 0 && <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300" data-testid="minutas-vazio">Ainda não há comparações. Na minuta pronta, use <strong>“Buscar minuta lançada”</strong> (precisa da extensão 3.0.6) depois que o assessor lançar o texto no Projudi.</div>}
      {pad && pad.total > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="minutas-cartoes">
            {card("Comparações", pad.total)}
            {card("Cobertura da lançada", <span className={cor(pad.coberturaMediaPct || 0)}>{pad.coberturaMediaPct || 0}%</span>, "da referência que o Studio já tinha")}
            {card("Aproveitamento médio", <span className={cor(pad.aproveitamentoMedioPct)}>{pad.aproveitamentoMedioPct}%</span>, "do Studio que ficou na lançada")}
            {card("Dispositivo alterado", <span className={pad.dispositivoAlteradoPct > 20 ? "text-amber-300" : ""}>{pad.dispositivoAlteradoPct}%</span>, "das minutas")}
            {card("Com documento assinado", pad.assinados.n, pad.assinados.n ? `manteve ${pad.assinados.aproveitamentoLancadaPct}% da lançada` : "anexe o PDF abaixo")}
          </div>
          <div className="flex flex-wrap gap-2 text-xs" data-testid="minutas-secoes">{pad.porSecao.map((s) => <span key={s.secao} className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900/70">{s.secao}: <strong className={cor(s.aproveitamentoPct)}>{s.aproveitamentoPct}%</strong> <span className="text-slate-500">({s.n})</span></span>)}</div>
          <div className="grid md:grid-cols-3 gap-2">{tabela("Por prompt", pad.porPrompt)}{tabela("Por motor", pad.porMotor)}{tabela("Por tipo de ato", pad.porAto)}</div>
          {(pad.maisCortados.length > 0 || pad.maisAcrescentados.length > 0) && (
            <div className="grid md:grid-cols-2 gap-2" data-testid="minutas-frequentes">
              <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-3"><div className="text-xs font-black mb-1.5 text-rose-200">Trechos que mais se repetem entre os CORTADOS</div>{pad.maisCortados.map((x, i) => <p key={i} className="text-[11px] py-0.5"><span className="text-rose-300 font-bold">{x.vezes}×</span> ({x.secao}) {x.trecho}</p>)}{!pad.maisCortados.length && <p className="text-[11px] text-slate-500">Nada repetido ainda.</p>}</div>
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3"><div className="text-xs font-black mb-1.5 text-emerald-200">Trechos que mais se repetem entre os ACRESCENTADOS</div>{pad.maisAcrescentados.map((x, i) => <p key={i} className="text-[11px] py-0.5"><span className="text-emerald-300 font-bold">{x.vezes}×</span> ({x.secao}) {x.trecho}</p>)}{!pad.maisAcrescentados.length && <p className="text-[11px] text-slate-500">Nada repetido ainda.</p>}</div>
            </div>
          )}

          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3 space-y-2" data-testid="minutas-laboratorio">
            <div className="flex flex-wrap items-center gap-2"><FlaskConical className="w-4 h-4 text-emerald-300" /><span className="text-sm font-black">Levar para o laboratório</span>
              <button onClick={() => void prepararPacote()} disabled={montando} data-testid="btn-preparar-pacote" className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{montando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />} {montando ? "Montando…" : marcadas.size ? `Montar pacote (${marcadas.size} marcadas)` : "Montar pacote (todas)"}</button></div>
            <p className="text-[11px] text-slate-400">Um arquivo geral e inteiro: padrões, o que mudou e os textos completos da minuta gerada e da lançada (referência) de cada comparação. Copie e cole na conversa com o Claude (ou baixe e anexe) para calibrar os prompts e o Studio. Marque comparações na lista para levar só algumas.</p>
            {pacote && (
              <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="pacote-pronto">
                <span className="text-emerald-200"><Check className="w-3.5 h-3.5 inline" /> Pacote com {pacote.n} comparação(ões) · {Math.max(1, Math.round(pacote.texto.length / 1024)).toLocaleString("pt-BR")} KB</span>
                <button onClick={() => void copiarPacote()} data-testid="btn-copiar-pacote" className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 cursor-pointer"><Copy className="w-3.5 h-3.5" /> Copiar para a área de transferência</button>
                <button onClick={baixarPacote} data-testid="btn-baixar-pacote" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 cursor-pointer"><Download className="w-3.5 h-3.5" /> Baixar arquivo (.md)</button>
              </div>
            )}
            {msgPacote && <div className="text-[11px] text-sky-200" data-testid="msg-pacote">{msgPacote}</div>}
          </div>

          <div className="rounded-xl border border-violet-700/50 bg-violet-950/20 p-3 space-y-2" data-testid="minutas-resumo-ia">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-300" /><span className="text-sm font-black">Resumo por IA e sugestões de prompt</span>
              <button onClick={() => void gerarResumo()} disabled={resumindo} data-testid="btn-gerar-resumo" className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{resumindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {resumindo ? "Gerando…" : "Gerar resumo"}</button></div>
            <p className="text-[11px] text-slate-400">A IA lê só os números e trechos curtos do que mudou (não as minutas inteiras) e SUGERE instruções. Nada é aplicado sozinho: você copia e cola onde quiser.</p>
            {erroResumo && <div className="text-xs text-rose-200" data-testid="resumo-erro">{erroResumo}</div>}
            {resumo && (
              <div className="space-y-2" data-testid="resumo-resultado">
                <p className="text-sm leading-relaxed">{resumo.resumo}</p>
                {resumo.padroes.length > 0 && <ul className="list-disc pl-5 text-xs space-y-0.5">{resumo.padroes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                {resumo.sugestoes.map((s, i) => (
                  <div key={i} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-2"><strong>{s.titulo}</strong><span className="text-slate-400">{s.secao}</span><span className={`ml-auto text-[10px] font-bold ${s.confianca === "alta" ? "text-emerald-300" : s.confianca === "media" ? "text-amber-300" : "text-slate-400"}`}>confiança {s.confianca}</span></div>
                    <p className="bg-slate-950 rounded p-1.5 text-slate-200">{s.instrucao}</p>
                    <p className="text-slate-400">Por quê: {s.motivo}</p>
                    <button onClick={() => copiar(s.instrucao)} className="inline-flex items-center gap-1 text-[11px] underline cursor-pointer"><Copy className="w-3 h-3" /> copiar instrução</button>
                  </div>
                ))}
                <p className="text-[10px] text-slate-500">Baseado nas {resumo.base} comparações mais recentes.</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5" data-testid="minutas-lista">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-black">Comparações guardadas</div>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer"><input type="checkbox" data-testid="marcar-todas" checked={linhas.length > 0 && marcadas.size === linhas.length} onChange={(e) => setMarcadas(e.target.checked ? new Set(linhas.map((l) => l.id)) : new Set())} /> marcar todas</label>
              <button onClick={() => setConfirmar("marcadas")} disabled={!marcadas.size || apagando} data-testid="btn-apagar-marcadas" className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-600/60 text-rose-200 hover:bg-rose-950/50 text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3" /> Apagar marcadas ({marcadas.size})</button>
              <button onClick={() => setConfirmar("todas")} disabled={!linhas.length || apagando} data-testid="btn-apagar-todas" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-600/60 text-rose-200 hover:bg-rose-950/50 text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3" /> Apagar todas</button>
            </div>
            {confirmar && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-3 text-xs flex flex-wrap items-center gap-2" data-testid="confirmar-apagar">
                <span className="flex-1 min-w-[200px]">{confirmar === "todas" ? `Apagar TODAS as ${linhas.length} comparações guardadas` : confirmar === "marcadas" ? `Apagar as ${marcadas.size} comparações marcadas` : "Apagar esta comparação"}, com as minutas guardadas? Não dá para desfazer.</span>
                <button onClick={() => void apagar(confirmar)} disabled={apagando} data-testid="btn-confirmar-apagar" className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50">{apagando ? "Apagando…" : "Sim, apagar"}</button>
                <button onClick={() => setConfirmar("")} disabled={apagando} className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 cursor-pointer">Cancelar</button>
              </div>
            )}
            {msgApagar && <div className="text-[11px] text-sky-200" data-testid="msg-apagar">{msgApagar}</div>}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" data-testid="input-pdf-assinado" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && alvo.current) void anexar(f, alvo.current); }} />
            {linhas.map((l) => (
              <div key={l.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="checkbox" checked={marcadas.has(l.id)} onChange={() => alternar(l.id)} aria-label={`marcar ${l.processo}`} data-testid={`marcar-${l.id}`} />
                  <button onClick={() => setAberta(aberta === l.id ? "" : l.id)} className="font-bold underline-offset-2 hover:underline cursor-pointer text-left">{l.processo}</button>
                  <span className="text-slate-400">{quando(l.geradoEm)}{l.ato ? ` · ${l.ato}` : ""}{l.promptTitulo ? ` · ${l.promptTitulo}` : ""}</span>
                  <span className={`font-black ${cor(l.aproveitamentoPct)}`}>{l.aproveitamentoPct}%</span><span className="text-slate-500 text-[10px]" title="a comparação e as minutas guardadas somem sozinhas depois de 30 dias">apaga em {diasRestantes(l.geradoEm)} d</span>
                  {l.origem === "usuario" && <span className="px-1.5 rounded border border-sky-600/60 text-sky-200 text-[10px] font-bold" title={l.por || ""}>enviada por {l.nomeUsuario || l.por || "usuário"} ({l.motivo === "excluir" ? "ao excluir" : "ao lançar"})</span>}
                  {l.dispositivoMudou && <span className="px-1.5 rounded border border-amber-500/60 text-amber-200 text-[10px] font-bold">dispositivo alterado</span>}
                  {l.assinado && <span className="px-1.5 rounded border border-emerald-600/60 text-emerald-200 text-[10px] font-bold" title={l.assinado.arquivo}>assinada: {l.assinado.aproveitamentoLancadaPct}% da lançada{l.assinado.dispositivoMudouDaLancada ? " · dispositivo mudou" : ""}</span>}
                  <button onClick={() => { alvo.current = l.id; fileRef.current?.click(); }} disabled={lendo === l.id} data-testid={`btn-anexar-assinado-${l.id}`} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-600 hover:bg-slate-800 cursor-pointer text-[11px] disabled:opacity-50">{lendo === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />} {l.assinado ? "Trocar documento assinado" : "Anexar documento assinado (PDF)"}</button>
                  <button onClick={() => setConfirmar(l.id)} disabled={apagando} aria-label={`apagar ${l.processo}`} title="Apagar esta comparação" data-testid={`apagar-${l.id}`} className="p-1 rounded-lg border border-slate-700 hover:bg-rose-950/50 text-rose-300 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                </div>
                {msgAssinado[l.id] && <div className="mt-1 text-[11px] text-sky-200" data-testid="msg-assinado">{msgAssinado[l.id]}</div>}
                {aberta === l.id && <div className="mt-2 space-y-1">{(l.mudancas || []).length === 0 ? <p className="text-slate-500">Nada mudou.</p> : (l.mudancas || []).map((m, i) => <p key={i} className="text-[11px] leading-relaxed"><strong className={m.tipo === "removido" ? "text-rose-300" : m.tipo === "adicionado" ? "text-emerald-300" : "text-amber-300"}>{m.tipo === "removido" ? "CORTADO" : m.tipo === "adicionado" ? "ACRESCENTADO" : "ALTERADO"} ({m.secao}):</strong> {m.original ? <span className="line-through text-slate-400">{m.original}</span> : null} {m.lancado}</p>)}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
