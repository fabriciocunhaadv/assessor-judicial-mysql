import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { SearchX, Loader2, Search, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { chamarHistorico } from "../lib/historyApi";
import { invalidarIndiceHistorico } from "../lib/firestoreUtils";

interface Registro {
  tenant: string; id: string; unitId: string; criadoPor: string; data: number; atualizadoEm: number; noIndice: boolean; unitIdNoIndice: string | null;
  processo: string; titulo: string; vara: string; autorNome: string; autorEmail: string; lancado: number | null; problemas: string[];
}

/** SUPER ADMIN — Processos perdidos: procura em todos os gabinetes e unidades um ato que não aparece no Histórico, mostra como está gravado e permite corrigir gabinete, unidade, vara e autor. */
export function ProcessosPerdidosPanel() {
  const { activeTenantId, allTenants, allUnitsForSuperAdmin } = useAuth() as any;
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<Registro[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState({ paraTenant: "", unitId: "", unitOutra: "", judicialUnit: "", createdBy: "", creatorEmail: "", creatorName: "" });
  const [salvando, setSalvando] = useState(false);
  const tenants: { id: string; name: string }[] = (allTenants || []) as any[];
  const nomeGab = (id: string) => tenants.find((t) => t.id === id)?.name || id;
  const unidadesDe = (t: string) => ((allUnitsForSuperAdmin || []) as any[]).filter((u) => u.tenantId === t);
  const chave = (r: Registro) => `${r.tenant}::${r.id}`;

  const buscar = async () => {
    setBuscando(true);
    try { const r = await chamarHistorico<{ itens: Registro[] }>(activeTenantId, "GET", "/perdidos", undefined, { q: q.trim() }); setItens(r.itens); setEditando(null); }
    catch (e: any) { toast.error(e?.message || "Não consegui procurar."); }
    finally { setBuscando(false); }
  };
  const abrirEdicao = (r: Registro) => {
    setEditando(chave(r));
    setF({ paraTenant: r.tenant, unitId: r.unitId, unitOutra: "", judicialUnit: r.vara, createdBy: r.criadoPor === "anonymous" ? "" : r.criadoPor, creatorEmail: r.autorEmail, creatorName: r.autorNome });
  };
  const salvar = async (r: Registro) => {
    const unitId = f.unitId === "__outra__" ? f.unitOutra.trim() : f.unitId;
    const mudaGab = f.paraTenant !== r.tenant;
    const resumo = `Corrigir o ato ${r.processo || r.id}:\n\n• Gabinete: ${nomeGab(r.tenant)} → ${nomeGab(f.paraTenant)}\n• Unidade: ${r.unitId} → ${unitId}\n\nO ato passa a aparecer no Histórico desse gabinete e unidade. Confirma?`;
    if (!window.confirm(resumo)) return;
    setSalvando(true);
    try {
      await chamarHistorico(activeTenantId, "POST", "/perdidos/corrigir", { tenant: r.tenant, id: r.id, paraTenant: f.paraTenant, unitId, judicialUnit: f.judicialUnit, createdBy: f.createdBy, creatorEmail: f.creatorEmail, creatorName: f.creatorName });
      toast.success(mudaGab ? "Ato corrigido e movido para o novo gabinete." : "Ato corrigido.", { duration: 8000 });
      invalidarIndiceHistorico(); try { window.dispatchEvent(new Event("assessor-historico-mudou")); } catch { /* sem janela */ }
      setEditando(null); await buscar();
    } catch (e: any) { toast.error(e?.message || "Não consegui corrigir."); }
    finally { setSalvando(false); }
  };
  const campo = "w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100";
  return (
    <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-3" data-testid="processos-perdidos">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400"><SearchX className="w-5 h-5" /></div>
        <h3 className="text-sm font-black text-white">Processos perdidos</h3>
        <span className="text-[11px] text-slate-400">Procura em TODOS os gabinetes e unidades um ato que não aparece no Histórico, mostra como foi gravado e permite corrigir.</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 3) void buscar(); }} placeholder="Trecho do número do processo, e-mail/nome do autor ou código do ato" className={`${campo} flex-1 min-w-[240px]`} data-testid="perdidos-busca" />
        <button type="button" onClick={buscar} disabled={buscando || q.trim().length < 3} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50" data-testid="perdidos-procurar">
          {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Procurar
        </button>
      </div>
      {itens && itens.length === 0 && <p className="text-xs text-slate-400" data-testid="perdidos-nenhum">Nenhum registro encontrado em nenhum gabinete.</p>}
      {itens?.map((r) => (
        <div key={chave(r)} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 space-y-2 text-xs text-slate-200" data-testid="perdidos-item">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <b className="font-mono text-white">{r.processo || "(sem número)"}</b>
            <span>Gabinete: <b>{nomeGab(r.tenant)}</b> <span className="text-slate-500">({r.tenant})</span></span>
            <span>Unidade: <b>{r.unitId}</b></span>
            <span>Autor: <b>{r.autorNome || "—"}</b> {r.autorEmail && <span className="text-slate-500">({r.autorEmail})</span>}</span>
            <span>Gerado: {r.data ? new Date(r.data).toLocaleString("pt-BR") : "—"}</span>
          </div>
          <div className="text-slate-400">{r.titulo || "(sem título)"}{r.vara ? ` · ${r.vara}` : ""} · código <span className="font-mono">{r.id}</span></div>
          {r.problemas.length > 0
            ? <ul className="space-y-0.5">{r.problemas.map((p, i) => <li key={i} className="flex gap-1.5 text-amber-300"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{p}</li>)}</ul>
            : <p className="flex gap-1.5 text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> Registro consistente (gabinete, unidade e índice batem).</p>}
          {editando === chave(r) ? (
            <div className="grid sm:grid-cols-2 gap-2 pt-1" data-testid="perdidos-form">
              <label className="space-y-0.5"><span className="text-slate-400">Gabinete</span>
                <select className={campo} value={f.paraTenant} onChange={(e) => setF({ ...f, paraTenant: e.target.value, unitId: "" })}>
                  {[...tenants, ...(tenants.some((t) => t.id === r.tenant) ? [] : [{ id: r.tenant, name: r.tenant }])].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></label>
              <label className="space-y-0.5"><span className="text-slate-400">Unidade</span>
                <select className={campo} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}>
                  <option value="">— escolha —</option>
                  {unidadesDe(f.paraTenant).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
                  <option value="__outra__">Outra (digitar o código)…</option>
                  {f.unitId && f.unitId !== "__outra__" && !unidadesDe(f.paraTenant).some((u: any) => u.id === f.unitId) && <option value={f.unitId}>{f.unitId} (atual)</option>}
                </select></label>
              {f.unitId === "__outra__" && <label className="space-y-0.5 sm:col-span-2"><span className="text-slate-400">Código da unidade</span><input className={campo} value={f.unitOutra} onChange={(e) => setF({ ...f, unitOutra: e.target.value })} placeholder="ex.: vara_dr_rafael_..." /></label>}
              <label className="space-y-0.5 sm:col-span-2"><span className="text-slate-400">Vara / unidade que aparece na minuta (opcional)</span><input className={campo} value={f.judicialUnit} onChange={(e) => setF({ ...f, judicialUnit: e.target.value })} /></label>
              <label className="space-y-0.5"><span className="text-slate-400">Autor — código (uid)</span><input className={campo} value={f.createdBy} onChange={(e) => setF({ ...f, createdBy: e.target.value })} /></label>
              <label className="space-y-0.5"><span className="text-slate-400">Autor — e-mail</span><input className={campo} value={f.creatorEmail} onChange={(e) => setF({ ...f, creatorEmail: e.target.value })} /></label>
              <label className="space-y-0.5 sm:col-span-2"><span className="text-slate-400">Autor — nome</span><input className={campo} value={f.creatorName} onChange={(e) => setF({ ...f, creatorName: e.target.value })} /></label>
              <div className="sm:col-span-2 flex gap-2">
                <button type="button" disabled={salvando || !f.paraTenant || !(f.unitId === "__outra__" ? f.unitOutra.trim() : f.unitId)} onClick={() => salvar(r)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center gap-1.5" data-testid="perdidos-salvar">{salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar correção</button>
                <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => abrirEdicao(r)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold flex items-center gap-1.5" data-testid="perdidos-corrigir"><Wrench className="w-3.5 h-3.5" /> Corrigir onde está gravado</button>
          )}
        </div>
      ))}
    </div>
  );
}
