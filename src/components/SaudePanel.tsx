import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { HeartPulse, RefreshCw, Copy, Loader2, AlertTriangle, Download, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { pedidoDeCorrecaoSaude, type GrupoSaude, type AlertaSaude, type Semaforo } from "../utils/saudeRegras";

interface Resumo {
  horas: number; geradoEm: number; passo: number; totalEventos: number;
  tipos: { tipo: string; semaforo: Semaforo; total: number }[];
  serie: { ts: number; erro: number; aviso: number }[];
  grupos: GrupoSaude[]; alertas: AlertaSaude[];
  ia: { horaAtual: { chamadas: number; ok: number; f503: number; f429: number; timeout: number; auth: number; outro: number; tokens: number }; ultimas24h: number };
  rotas: { rota: string; n: number; erros: number; mediaMs: number; p95Ms: number; maxMs: number }[];
  retencao: { dias: number; maisAntigoTs: number | null; total: number; nivelAviso: 7 | 3 | 1 | null; expiram: { d7: number; d3: number; d1: number }; ultimaLimpeza: { ts: number; eventos: number; erros: number; operacoes: number } | null };
}
const ROTULO: Record<string, string> = { servidor: "Servidor", banco: "Banco de dados", ia: "IA (Google)", retomada: "Retomadas", extensao: "Extensão", cliente: "Tela", sistema: "Reinícios", versao: "Atualizações" };
const COR: Record<Semaforo, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-rose-500" };
const COR_SEV: Record<string, string> = { erro: "text-rose-300", aviso: "text-amber-300", info: "text-slate-300" };
const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const PERIODOS = [{ h: 24, r: "24 horas" }, { h: 168, r: "7 dias" }, { h: 720, r: "30 dias" }];
const chaveDispensa = (n: number) => `saude_aviso_${n}_${new Date().toISOString().slice(0, 10)}`;
const lerLS = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function SaudePanel() {
  const [horas, setHoras] = useState(24);
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<any[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dispensado, setDispensado] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const resp = await fetch(`/api/saude/resumo?horas=${horas}`); const j = await resp.json(); if (!resp.ok) throw new Error(j?.erro || `HTTP ${resp.status}`); setR(j); setErro(""); }
    catch (e: any) { setErro(String(e?.message || e)); } finally { setCarregando(false); }
  }, [horas]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (!auto) return; const t = setInterval(() => { if (!document.hidden) void carregar(); }, 30_000); return () => clearInterval(t); }, [auto, carregar]);

  const abrir = async (g: GrupoSaude) => {
    if (aberto === g.assinatura) { setAberto(null); return; }
    setAberto(g.assinatura); setDetalhe([]);
    try { const resp = await fetch(`/api/saude/eventos?assinatura=${g.assinatura}&horas=${horas}&limite=30`); setDetalhe((await resp.json()).eventos || []); } catch { /* sem detalhe */ }
  };
  const copiar = async (gs: GrupoSaude[]) => { try { await navigator.clipboard.writeText(pedidoDeCorrecaoSaude(gs)); toast.success("Pedido copiado. Cole no chat com o Claude."); } catch { toast.error("Não consegui copiar."); } };
  const exportar = async () => {
    try {
      const resp = await fetch("/api/saude/exportar"); const j = await resp.json(); if (!resp.ok) throw new Error(j?.erro || "falha");
      const url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" })), a = document.createElement("a");
      a.href = url; a.download = `saude-do-sistema-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { toast.error("Não consegui exportar: " + String(e?.message || e)); }
  };

  const grupos = useMemo(() => (r?.grupos || []).filter((g) => filtroTipo === "todos" || g.tipo === filtroTipo), [r, filtroTipo]);
  const maxBarra = useMemo(() => Math.max(1, ...(r?.serie || []).map((s) => s.erro + s.aviso)), [r]);
  const nivel = r?.retencao.nivelAviso || null, mostrarAviso = nivel && !lerLS(chaveDispensa(nivel)) && dispensado !== nivel;
  const exp = r?.retencao.expiram;

  return (
    <div className="space-y-5" data-testid="painel-saude">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"><HeartPulse className="w-5 h-5" /></div>
          <h2 className="text-base font-black text-white">Saúde do sistema</h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} data-testid="saude-periodo" className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5">{PERIODOS.map((p) => <option key={p.h} value={p.h}>Últimas {p.r}</option>)}</select>
            <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Atualizar sozinho (30 s)</label>
            <button type="button" onClick={carregar} disabled={carregando} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">Junta, num só lugar, o que o servidor, o banco de dados, a IA do Google, as retomadas automáticas, a extensão e as atualizações de versão registraram. Os eventos iguais ficam agrupados e os alertas aparecem sozinhos. Os registros ficam guardados por {r?.retencao.dias || 30} dias e depois são apagados automaticamente.</p>
        {erro && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2" data-testid="saude-erro">Não consegui carregar: {erro}</div>}
        {r && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="saude-semaforos">
          {r.tipos.map((t) => <button key={t.tipo} type="button" onClick={() => setFiltroTipo(filtroTipo === t.tipo ? "todos" : t.tipo)} className={`text-left bg-slate-950/60 border rounded-xl p-3 cursor-pointer ${filtroTipo === t.tipo ? "border-emerald-400" : "border-slate-800"}`}>
            <div className="flex items-center gap-2 text-xs text-slate-300"><span className={`w-2.5 h-2.5 rounded-full ${COR[t.semaforo]}`} aria-label={t.semaforo} />{ROTULO[t.tipo] || t.tipo}</div>
            <div className="text-lg font-black text-white" data-testid={`saude-total-${t.tipo}`}>{t.total}</div><div className="text-[10px] text-slate-500">{t.semaforo === "verde" ? "tudo certo" : t.semaforo === "amarelo" ? "atenção" : "erro recente"}</div>
          </button>)}
        </div>}
      </div>

      {mostrarAviso && r && (
        <div className={`rounded-2xl p-4 border text-xs flex flex-wrap items-center gap-3 ${nivel === 1 ? "bg-rose-500/10 border-rose-500/40 text-rose-100" : nivel === 3 ? "bg-amber-500/10 border-amber-500/40 text-amber-100" : "bg-sky-500/10 border-sky-500/40 text-sky-100"}`} data-testid="saude-aviso-retencao" role="alert">
          <Clock className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-[220px]"><strong>{nivel === 1 ? "Falta 1 dia" : `Faltam ${nivel} dias`} para o apagamento automático dos registros mais antigos</strong> (guardamos {r.retencao.dias} dias). {exp && `Vão embora: ${nivel === 1 ? exp.d1 : nivel === 3 ? exp.d3 : exp.d7} registro(s) nesse prazo.`} Se quiser guardá-los, exporte agora.</span>
          <button type="button" onClick={exportar} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/30 font-bold flex items-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" /> Exportar (JSON)</button>
          <button type="button" onClick={() => { try { localStorage.setItem(chaveDispensa(nivel!), "1"); } catch { /* sem armazenamento */ } setDispensado(nivel!); }} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 font-bold cursor-pointer">Lembrar amanhã</button>
        </div>
      )}

      {r && r.alertas.length > 0 && (
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-2" data-testid="saude-alertas">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /><h3 className="text-sm font-bold text-white">Alertas automáticos ({r.alertas.length})</h3></div>
          <ul className="space-y-1.5">{r.alertas.map((a, i) => <li key={i} className={`text-xs rounded-lg px-3 py-2 border ${a.gravidade === "alta" ? "bg-rose-500/10 border-rose-500/30 text-rose-100" : "bg-amber-500/10 border-amber-500/30 text-amber-100"}`}>{a.texto}</li>)}</ul>
        </div>
      )}

      {r && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Erros e avisos ao longo do tempo</h3>
          <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Gráfico de erros e avisos" data-testid="saude-grafico">
            {r.serie.map((s) => <div key={s.ts} className="flex-1 flex flex-col justify-end h-full min-w-[3px]" title={`${quando(s.ts)} — ${s.erro} erro(s), ${s.aviso} aviso(s)`}>
              <div className="bg-amber-400/80" style={{ height: `${(s.aviso / maxBarra) * 100}%` }} /><div className="bg-rose-500" style={{ height: `${(s.erro / maxBarra) * 100}%` }} /></div>)}
          </div>
          <div className="flex gap-4 text-[10px] text-slate-400"><span><i className="inline-block w-2 h-2 bg-rose-500 mr-1" />erro</span><span><i className="inline-block w-2 h-2 bg-amber-400/80 mr-1" />aviso</span><span className="ml-auto">{r.totalEventos} eventos no período</span></div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-bold text-white">Problemas agrupados ({grupos.length})</h3>
          {filtroTipo !== "todos" && <button type="button" onClick={() => setFiltroTipo("todos")} className="text-[11px] text-emerald-300 underline cursor-pointer">limpar filtro “{ROTULO[filtroTipo] || filtroTipo}”</button>}
          {grupos.length > 0 && <button type="button" onClick={() => copiar(grupos.slice(0, 10))} data-testid="saude-copiar" className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Copy className="w-3.5 h-3.5" /> Copiar pedido para o Claude</button>}
        </div>
        {grupos.length === 0 && <p className="text-xs text-slate-400" data-testid="saude-vazio">Nenhum problema neste período. 🎉</p>}
        <ul className="space-y-1.5">
          {grupos.map((g) => <li key={g.assinatura} className="bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
            <button type="button" onClick={() => abrir(g)} className="w-full text-left p-3 flex items-start gap-2 cursor-pointer">
              {aberto === g.assinatura ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
              <span className="flex-1 min-w-0"><span className={`font-bold ${COR_SEV[g.severidade]}`}>{g.severidade}</span> <span className="text-slate-400">· {ROTULO[g.tipo] || g.tipo}/{g.modulo}</span><br /><span className="text-slate-200 break-words">{g.mensagem}</span></span>
              <span className="text-right shrink-0 text-slate-400">{g.total}× {g.tendencia === "subindo" ? "↑" : g.tendencia === "caindo" ? "↓" : "→"}<br />{g.usuarios} usuário(s)<br />{quando(g.ultimo)}</span>
            </button>
            {aberto === g.assinatura && <div className="px-3 pb-3 space-y-1 border-t border-slate-800 pt-2">
              {detalhe.length === 0 && <div className="text-slate-500">Carregando ocorrências…</div>}
              {detalhe.map((d) => <div key={d.id} className="text-[11px] text-slate-300"><span className="text-slate-500">{quando(d.ts)}</span> {d.email || ""} {d.duracaoMs ? `· ${Math.round(d.duracaoMs / 1000)}s` : ""}{d.detalhe ? <span className="text-slate-500"> · {String(d.detalhe).slice(0, 220)}</span> : null}</div>)}
              <button type="button" onClick={() => copiar([g])} className="mt-1 text-[11px] text-amber-300 underline cursor-pointer">copiar só este</button>
            </div>}
          </li>)}
        </ul>
      </div>

      {r && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 text-xs" data-testid="saude-ia">
            <h3 className="text-sm font-bold text-white">IA (Google) desde a última hora cheia</h3>
            <div className="grid grid-cols-3 gap-2 text-slate-300">
              {([["Chamadas", r.ia.horaAtual.chamadas], ["Deram certo", r.ia.horaAtual.ok], ["Alta demanda (503)", r.ia.horaAtual.f503], ["Cota (429)", r.ia.horaAtual.f429], ["Tempo esgotado", r.ia.horaAtual.timeout], ["Tokens", r.ia.horaAtual.tokens]] as const).map(([k, v]) => <div key={k} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2"><div className="text-slate-500">{k}</div><div className="font-black text-white">{v}</div></div>)}
            </div>
            <p className="text-slate-500">Valores do servidor atual: zeram quando ele reinicia.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 text-xs" data-testid="saude-rotas">
            <h3 className="text-sm font-bold text-white">Rotas mais lentas (p95)</h3>
            {r.rotas.length === 0 ? <p className="text-slate-500">Ainda sem medições.</p> : <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-slate-500"><tr><th className="pr-2">Rota</th><th className="pr-2">Pedidos</th><th className="pr-2">Erros</th><th className="pr-2">p95</th><th>Máx.</th></tr></thead><tbody className="text-slate-300">
              {r.rotas.map((x) => <tr key={x.rota}><td className="pr-2 break-all">{x.rota}</td><td className="pr-2">{x.n}</td><td className={`pr-2 ${x.erros ? "text-rose-300" : ""}`}>{x.erros}</td><td className="pr-2">{(x.p95Ms / 1000).toFixed(1)}s</td><td>{(x.maxMs / 1000).toFixed(1)}s</td></tr>)}</tbody></table></div>}
          </div>
        </div>
      )}

      {r && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 flex flex-wrap items-center gap-3" data-testid="saude-retencao">
          <Clock className="w-4 h-4" />
          <span className="flex-1 min-w-[220px]">Guardamos {r.retencao.dias} dias · {r.retencao.total} registros · mais antigo: {quando(r.retencao.maisAntigoTs || 0)} · última limpeza automática: {r.retencao.ultimaLimpeza ? `${quando(r.retencao.ultimaLimpeza.ts)} (${r.retencao.ultimaLimpeza.eventos + r.retencao.ultimaLimpeza.erros + r.retencao.ultimaLimpeza.operacoes} apagados)` : "ainda não rodou"}. Avisos aos 7, 3 e 1 dia antes.</span>
          <button type="button" onClick={exportar} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" /> Exportar</button>
        </div>
      )}
    </div>
  );
}
