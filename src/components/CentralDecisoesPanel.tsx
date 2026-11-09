import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Compass, RefreshCw, Copy, Loader2, Download, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import type { GrupoSaude } from "../utils/saudeRegras";
import { montarDecisoes, pedidoDeCorrecaoCentral, statusEfetivo, estaAberto, ROTULO_STATUS, type Decisao, type EstadoGrupo, type StatusGrupo, type StatusEfetivo } from "../utils/centralRegras";

type Grupo = GrupoSaude & { estado?: EstadoGrupo | null };
interface Resumo { horas: number; geradoEm: number; grupos: Grupo[]; decisoes: Decisao[]; retencaoDias: number }
const COR_PRI: Record<number, string> = { 1: "border-rose-500/50 bg-rose-500/10", 2: "border-amber-500/40 bg-amber-500/10", 3: "border-slate-700 bg-slate-800/60" };
const ROT_PRI: Record<number, string> = { 1: "Urgente", 2: "Atenção", 3: "Quando puder" };
const COR_ST: Record<StatusEfetivo, string> = { novo: "text-sky-300", investigando: "text-amber-300", resolvido: "text-emerald-300", ignorado: "text-slate-400", reincidente: "text-rose-300" };
const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const post = async (url: string, corpo: unknown) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.erro || `HTTP ${r.status}`); return j; };

export function CentralDecisoesPanel({ irParaAba }: { irParaAba?: (aba: string) => void }) {
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<any[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const resp = await fetch("/api/central/resumo?horas=168"); const j = await resp.json(); if (!resp.ok) throw new Error(j?.erro || `HTTP ${resp.status}`); setR(j); setErro(""); }
    catch (e: any) { setErro(String(e?.message || e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) void carregar(); }, 60_000); return () => clearInterval(t); }, [carregar]);

  const marcar = async (g: Grupo, status: StatusGrupo) => {
    try { await post("/api/central/grupo", { assinatura: g.assinatura, status, nota: notas[g.assinatura] ?? g.estado?.nota ?? "" }); await carregar(); } catch (e: any) { toast.error("Não consegui salvar: " + String(e?.message || e)); }
  };
  const dispensar = async (d: Decisao) => { try { await post("/api/central/dispensar", { chave: d.chave, dias: 7 }); toast.success("Some por 7 dias."); await carregar(); } catch (e: any) { toast.error(String(e?.message || e)); } };
  const abrirGrupo = async (g: Grupo) => {
    if (aberto === g.assinatura) { setAberto(null); return; }
    setAberto(g.assinatura); setDetalhe([]);
    try { const resp = await fetch(`/api/saude/eventos?assinatura=${g.assinatura}&horas=168&limite=20`); setDetalhe((await resp.json()).eventos || []); } catch { /* sem detalhe */ }
  };
  const exportar = async () => {
    try { const resp = await fetch("/api/saude/exportar"); const j = await resp.json(); if (!resp.ok) throw new Error(j?.erro || "falha"); const url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" })), a = document.createElement("a"); a.href = url; a.download = `saude-do-sistema-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
    catch (e: any) { toast.error("Não consegui baixar: " + String(e?.message || e)); }
  };
  const copiar = async (gs: Grupo[]) => { try { await navigator.clipboard.writeText(pedidoDeCorrecaoCentral(gs)); toast.success("Pedido copiado. Cole no chat com o Claude."); } catch { toast.error("Não consegui copiar."); } };
  const agirNaDecisao = (d: Decisao) => {
    if (d.acao.tipo === "aba" && d.acao.alvo) irParaAba?.(d.acao.alvo);
    else if (d.acao.tipo === "grupo") { const g = r?.grupos.find((x) => x.assinatura === d.acao.alvo); if (g) { setFiltro("todos"); void abrirGrupo(g); setTimeout(() => document.getElementById("grupo-" + g.assinatura)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); } }
    else if (d.acao.tipo === "exportar") void exportar();
    else if (d.acao.tipo === "fontes") void dispensar(d);      // informativo: vá a Central de fontes → Fontes pendentes; "Entendi" esconde por 7 dias
  };

  const grupos = useMemo(() => (r?.grupos || []).filter((g) => filtro === "todos" || estaAberto(statusEfetivo(g, g.estado))), [r, filtro]);
  const decisoes = r?.decisoes || [];

  return (
    <div className="space-y-5" data-testid="painel-central">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300"><Compass className="w-5 h-5" /></div>
          <h2 className="text-base font-black text-white">Central de decisões</h2>
          <button type="button" onClick={carregar} disabled={carregando} className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">O que precisa de você, em ordem de prioridade. Esta tela só <b>mostra</b> o que o sistema já registra: ela não muda nenhum motor. Os registros são apagados sozinhos depois de {r?.retencaoDias ?? 30} dias (com aviso de 7, 3 e 1 dia).</p>
        {erro && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2" data-testid="central-erro">Não consegui carregar: {erro}</div>}
        {r && !decisoes.length && <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3" data-testid="central-vazia"><CheckCircle2 className="w-4 h-4" /> Nada precisa de você agora.</div>}
        <div className="space-y-2" data-testid="central-decisoes">
          {decisoes.map((d) => (
            <div key={d.chave} className={`border rounded-xl p-3 flex items-start gap-3 flex-wrap ${COR_PRI[d.prioridade]}`} data-testid="central-decisao">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-300">{ROT_PRI[d.prioridade]}</div>
                <div className="text-sm font-bold text-white break-words">{d.titulo}</div>
                <div className="text-xs text-slate-400">{d.detalhe}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => agirNaDecisao(d)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1">{d.acao.tipo === "exportar" && <Download className="w-3.5 h-3.5" />}{d.acao.rotulo}</button>
                <button type="button" onClick={() => dispensar(d)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300" title="Esconde este item por 7 dias">Dispensar 7 dias</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3" data-testid="central-erros">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-black text-white">Erros agrupados <span className="text-slate-400 font-normal">(últimos 7 dias)</span></h3>
          <div className="ml-auto flex items-center gap-2">
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as any)} data-testid="central-filtro" className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5"><option value="abertos">Só os abertos</option><option value="todos">Todos</option></select>
            <button type="button" onClick={() => copiar(grupos.filter((g) => estaAberto(statusEfetivo(g, g.estado))))} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5" title="Monta o texto pronto para colar numa conversa com o Claude"><Copy className="w-3.5 h-3.5" /> Copiar pedido para o Claude</button>
          </div>
        </div>
        {!grupos.length && <p className="text-xs text-slate-400">Nenhum erro {filtro === "abertos" ? "aberto" : "registrado"} neste período.</p>}
        <div className="space-y-2">
          {grupos.map((g) => {
            const st = statusEfetivo(g, g.estado);
            return (
              <div key={g.assinatura} id={"grupo-" + g.assinatura} className="border border-slate-700 rounded-xl bg-slate-800/40" data-testid="central-grupo">
                <div className="p-3 flex items-start gap-3 flex-wrap">
                  <button type="button" onClick={() => abrirGrupo(g)} className="mt-0.5 text-slate-400" aria-label="Ver ocorrências">{aberto === g.assinatura ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white break-words"><span className={g.severidade === "erro" ? "text-rose-300 font-bold" : "text-amber-300 font-bold"}>{g.severidade}</span> · {g.mensagem}</div>
                    <div className="text-xs text-slate-400">{g.tipo}/{g.modulo} · {g.total}× · {g.usuarios} usuário(s) · {quando(g.primeiro)} → {quando(g.ultimo)} · tendência {g.tendencia}</div>
                  </div>
                  <select value={g.estado?.status && st !== "reincidente" ? g.estado.status : st === "reincidente" ? "novo" : "novo"} onChange={(e) => marcar(g, e.target.value as StatusGrupo)} data-testid="central-status" className={`bg-slate-800 border border-slate-700 rounded-lg text-xs px-2 py-1.5 font-bold ${COR_ST[st]}`}>
                    {(["novo", "investigando", "resolvido", "ignorado"] as StatusGrupo[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
                  </select>
                  <span className={`text-[11px] font-bold ${COR_ST[st]}`} data-testid="central-status-efetivo">{ROTULO_STATUS[st]}</span>
                </div>
                {aberto === g.assinatura && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <input value={notas[g.assinatura] ?? g.estado?.nota ?? ""} onChange={(e) => setNotas((n) => ({ ...n, [g.assinatura]: e.target.value }))} placeholder="Nota (ex.: causa provável, o que foi feito)" maxLength={600} className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5" />
                      <button type="button" onClick={() => marcar(g, g.estado?.status || "novo")} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white">Salvar nota</button>
                      <button type="button" onClick={() => copiar([g])} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copiar só este</button>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-0.5 max-h-48 overflow-y-auto">{detalhe.length ? detalhe.map((e: any) => <div key={e.id}>{quando(e.ts)} · {e.email || "—"} · {e.mensagem}</div>) : "Carregando ocorrências…"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
