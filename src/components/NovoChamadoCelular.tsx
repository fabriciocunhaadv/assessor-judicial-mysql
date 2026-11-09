import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { LifeBuoy, X, Camera, FileText, Loader2, Trash2, Send } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { createTicket } from "../utils/ticketsDb";
import { lerMinhaFila } from "../utils/filaCliente";
import { prepararArquivo, enviarAnexo } from "../utils/chamadoCliente";
import { ANEXOS_MAX, textoDeContexto, type AnexoChamado } from "../utils/chamadoRegras";
import type { SupportTicket, TicketType } from "../types";

const TIPOS: { id: TicketType; rotulo: string }[] = [{ id: "reporte_erro", rotulo: "Deu erro / não funcionou" }, { id: "duvida_suporte", rotulo: "Tenho uma dúvida" }, { id: "melhoria_sugestao", rotulo: "Sugestão de melhoria" }, { id: "outro", rotulo: "Outro assunto" }];
interface Item { id: string; nome: string; arquivo: File; previa: string }

/** Abrir chamado pelo celular (ou computador): só texto digitado, print e PDF. Leva junto, se o usuário deixar, a versão e o estado da fila. Abre por `chamado:abrir`. */
export function NovoChamadoCelular() {
  const { user, userProfile, isSuperAdmin, isAdmin, isJudge, activeTenantId, tenantName, activeUnit } = useAuth();
  const [aberto, setAberto] = useState(false), [tipo, setTipo] = useState<TicketType>("reporte_erro"), [titulo, setTitulo] = useState(""), [texto, setTexto] = useState("");
  const [itens, setItens] = useState<Item[]>([]), [contexto, setContexto] = useState(true), [enviando, setEnviando] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null), pdfRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const abrir = () => setAberto(true); window.addEventListener("chamado:abrir", abrir); return () => window.removeEventListener("chamado:abrir", abrir); }, []);
  useEffect(() => () => itens.forEach((i) => i.previa && URL.revokeObjectURL(i.previa)), []);      // eslint-disable-line react-hooks/exhaustive-deps
  if (!aberto) return null;

  const fechar = () => { itens.forEach((i) => i.previa && URL.revokeObjectURL(i.previa)); setItens([]); setTitulo(""); setTexto(""); setTipo("reporte_erro"); setAberto(false); };
  const adicionar = (lista: FileList | null) => {
    if (!lista) return; const novos: Item[] = [];
    for (const f of Array.from(lista)) { if (itens.length + novos.length >= ANEXOS_MAX) { toast.error(`No máximo ${ANEXOS_MAX} anexos.`); break; } novos.push({ id: Math.random().toString(36).slice(2), nome: f.name || "arquivo", arquivo: f, previa: /^image\//.test(f.type) ? URL.createObjectURL(f) : "" }); }
    setItens((x) => [...x, ...novos]);
  };
  const remover = (id: string) => setItens((x) => { const i = x.find((y) => y.id === id); if (i?.previa) URL.revokeObjectURL(i.previa); return x.filter((y) => y.id !== id); });

  const enviar = async () => {
    if (!titulo.trim() || !texto.trim()) { toast.error("Escreva o título e conte o que aconteceu."); return; }
    setEnviando(true);
    try {
      const anexos: AnexoChamado[] = [];
      for (const i of itens) anexos.push(await enviarAnexo(await prepararArquivo(i.arquivo), i.nome));
      let extra = "";
      if (contexto) { let fila: any = null, online: boolean | null = null; try { const m = await lerMinhaFila(); fila = m.resumo; online = !!m.online; } catch { /* sem fila */ } extra = textoDeContexto({ versaoApp: String((window as any).__APP_VERSION__ || document.querySelector("footer")?.textContent?.match(/vers[aã]o\s+(\w+)/i)?.[1] || ""), aparelho: navigator.userAgent.slice(0, 120), fila, computadorOnline: online }); }
      const id = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, agora = Date.now();
      const t: SupportTicket = {
        id, tenantId: activeTenantId || "gabinete_default", tenantName: tenantName || "Gabinete Principal", unitId: activeUnit?.id || "default", unitName: activeUnit?.name || "Lotação Ativa",
        title: titulo.trim(), description: texto.trim() + (extra ? `\n\n${extra}` : ""), type: tipo, priority: tipo === "reporte_erro" ? "alta" : "media", status: "aguardando", systemModule: "Extensão & Fila (celular)",
        createdAt: agora, updatedAt: agora, createdByUid: userProfile?.uid || user?.uid || "anon", createdByName: userProfile?.name || user?.displayName || "Usuário", createdByEmail: user?.email || "",
        createdByRole: isJudge ? "Magistrado" : isSuperAdmin ? "Super ADM" : isAdmin ? "Administrador" : "Assessor", messages: [], anexos,
        statusHistory: [{ status: "aguardando", changedBy: userProfile?.uid || "anon", changedByName: userProfile?.name || "Usuário", changedAt: agora, comment: "Chamado aberto pelo celular." }], isReadByTenant: true, isReadBySuperAdmin: false,
      };
      await createTicket(t); toast.success("Chamado enviado! A equipe foi avisada."); fechar();
    } catch (e: any) { toast.error("Não consegui enviar: " + String(e?.message || e)); } finally { setEnviando(false); }
  };

  return (
    <div className="fixed inset-0 z-[9100] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" role="dialog" aria-label="Abrir chamado" data-testid="novo-chamado">
      <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-white text-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2"><div className="p-2 rounded-xl bg-rose-100 text-rose-700"><LifeBuoy className="w-5 h-5" /></div><h3 className="text-base font-black flex-1">Abrir chamado</h3><button type="button" onClick={fechar} aria-label="Fechar" className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <label className="block text-xs font-bold">O que aconteceu?
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TicketType)} data-testid="chamado-tipo" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}</select></label>
        <label className="block text-xs font-bold">Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ex.: A fila parou no processo 12" data-testid="chamado-titulo" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="block text-xs font-bold">Conte com suas palavras (digite)
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={4000} placeholder="O que você estava fazendo, o que apareceu na tela, o que esperava…" data-testid="chamado-texto" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
        <div className="space-y-2">
          <div className="text-xs font-bold">Anexos <span className="font-normal text-slate-500">(até {ANEXOS_MAX}: print/foto e PDF)</span></div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => imgRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold flex items-center gap-1.5 bg-slate-50" data-testid="chamado-add-print"><Camera className="w-4 h-4" /> Print ou foto</button>
            <button type="button" onClick={() => pdfRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold flex items-center gap-1.5 bg-slate-50" data-testid="chamado-add-pdf"><FileText className="w-4 h-4" /> PDF</button>
            <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} data-testid="chamado-input-img" />
            <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} data-testid="chamado-input-pdf" />
          </div>
          {itens.length > 0 && <ul className="space-y-1.5" data-testid="chamado-anexos">{itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5">{i.previa ? <img src={i.previa} alt="" className="w-12 h-12 object-cover rounded-lg" /> : <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center"><FileText className="w-5 h-5 text-slate-500" /></div>}
              <div className="min-w-0 flex-1 text-xs"><div className="font-bold truncate">{i.nome}</div><div className="text-slate-500">{(i.arquivo.size / 1048576).toFixed(1)} MB</div></div>
              <button type="button" onClick={() => remover(i.id)} aria-label={`Remover ${i.nome}`} className="p-2 rounded-lg hover:bg-slate-100"><Trash2 className="w-4 h-4 text-rose-600" /></button></li>))}</ul>}
          <p className="text-[11px] text-slate-500">Não coloque dados de processo sigiloso no print sem necessidade. Os anexos são apagados sozinhos depois de 90 dias.</p>
        </div>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={contexto} onChange={(e) => setContexto(e.target.checked)} className="mt-0.5" data-testid="chamado-contexto" /> Enviar junto a versão do Studio e o estado da fila (ajuda a equipe a entender o problema).</label>
        <button type="button" onClick={enviar} disabled={enviando} className="w-full py-3 rounded-2xl bg-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60" data-testid="chamado-enviar">{enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4" /> Enviar chamado</>}</button>
      </div>
    </div>
  );
}
