import React, { useState } from "react";
import { doc, updateDoc } from "../lib/docstore";
import { getApiHeaders, getMaskedApiKey } from "../utils/apiKeyManager";
import { MODELOS_CLAUDE } from "../utils/provedorIA";

interface ChaveGemini { id: string; key: string; label: string; keyType?: "paid" | "free"; createdAt: number }
const campo = "w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400";

/** Super Admin: cadastra, altera e remove as chaves de IA (Gemini e Claude) de OUTRO usuário. A pessoa passa a usá-las no próximo acesso. A chave completa só aparece com "Ver". */
export const ChavesDoUsuarioModal: React.FC<{ usuario: any; onClose: () => void; onSalvo?: () => void }> = ({ usuario, onClose, onSalvo }) => {
  const inicial: ChaveGemini[] = Array.isArray(usuario?.customApiKeys) && usuario.customApiKeys.length
    ? usuario.customApiKeys.filter((k: any) => k?.key).map((k: any, i: number) => ({ id: k.id || `k${i}`, key: k.key, label: k.label || `Chave ${i + 1}`, keyType: k.keyType, createdAt: k.createdAt || Date.now() }))
    : (typeof usuario?.customApiKey === "string" && usuario.customApiKey.trim().length > 10 ? [{ id: "key_primary", key: usuario.customApiKey.trim(), label: "Chave Principal", createdAt: Date.now() }] : []);
  const [lista, setLista] = useState<ChaveGemini[]>(inicial);
  const [ativaId, setAtivaId] = useState<string>(usuario?.activeKeyId && inicial.some((k) => k.id === usuario.activeKeyId) ? usuario.activeKeyId : inicial[0]?.id || "");
  const [nova, setNova] = useState(""), [rotulo, setRotulo] = useState(""), [tipo, setTipo] = useState<"free" | "paid">("free"), [verNova, setVerNova] = useState(false);
  const [provedor, setProvedor] = useState<"gemini" | "claude">(usuario?.provedorChat === "claude" ? "claude" : "gemini");
  const [claude, setClaude] = useState<string>(usuario?.claudeApiKey || ""), [verClaude, setVerClaude] = useState(false);
  const [modelo, setModelo] = useState<string>(usuario?.modeloClaude || MODELOS_CLAUDE[0].id);
  const [ocupado, setOcupado] = useState(false), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [verIds, setVerIds] = useState<Record<string, boolean>>({});

  const adicionar = () => {
    const k = nova.trim();
    if (k.length < 20) { setMsg({ ok: false, t: "A chave parece curta demais. Cole a chave inteira." }); return; }
    if (lista.some((x) => x.key === k)) { setMsg({ ok: false, t: "Essa chave já está na lista." }); return; }
    const item: ChaveGemini = { id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, key: k, label: rotulo.trim() || `Chave ${lista.length + 1}`, keyType: tipo, createdAt: Date.now() };
    setLista((l) => [...l, item]); if (!ativaId) setAtivaId(item.id);
    setNova(""); setRotulo(""); setMsg(null);
  };
  const remover = (id: string) => { const resto = lista.filter((k) => k.id !== id); setLista(resto); if (ativaId === id) setAtivaId(resto[0]?.id || ""); };
  const testarClaude = async () => {
    setMsg(null);
    try {
      const r = await fetch("/api/test-claude-key", { method: "POST", headers: getApiHeaders({ "x-ai-provider": "claude", "x-claude-api-key": claude.trim(), "x-claude-model": modelo }), body: "{}" });
      const j = await r.json().catch(() => ({} as any));
      setMsg({ ok: !!j.success, t: j.success ? "Chave da Claude válida." : (j.error || `Falhou (${r.status}).`) });
    } catch (e: any) { setMsg({ ok: false, t: e?.message || "Falha de rede." }); }
  };
  const salvar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const ativa = lista.find((k) => k.id === ativaId) || lista[0];
      await updateDoc(doc(null, "users", usuario.uid), {
        customApiKeys: lista, customApiKey: ativa?.key || "", activeKeyId: ativa?.id || "", isCustomKeyActive: lista.length > 0,
        claudeApiKey: claude.trim(), modeloClaude: modelo, provedorChat: provedor === "claude" && claude.trim().length > 20 ? "claude" : "gemini",
      });
      setMsg({ ok: true, t: "Chaves salvas. A pessoa passa a usá-las no próximo acesso (ou ao recarregar a página)." });
      onSalvo?.();
    } catch (e: any) { setMsg({ ok: false, t: "Não consegui salvar: " + (e?.message || e) }); } finally { setOcupado(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-900/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Chaves de IA de {usuario?.name || usuario?.email}</h3>
            <p className="text-[11px] text-slate-500">{usuario?.email} · só o Super Admin altera as chaves de outro usuário. Elas são privadas: o usuário usa as dele, e a chave completa só aparece aqui com “Ver”.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Fechar">✕</button>
        </div>

        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Chaves do Google Gemini ({lista.length})</h4>
          {lista.length === 0 && <p className="text-xs text-slate-500">Nenhuma chave cadastrada.</p>}
          {lista.map((k) => (
            <div key={k.id} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border text-xs ${k.id === ativaId ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
              <input type="radio" name="ativa" checked={k.id === ativaId} onChange={() => setAtivaId(k.id)} title="Chave ativa" />
              <span className="font-semibold">{k.label}</span>
              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px]">{k.keyType === "paid" ? "paga" : k.keyType === "free" ? "gratuita" : "sem tipo"}</span>
              <code className="font-mono text-[11px] text-slate-600 break-all flex-1">{verIds[k.id] ? k.key : getMaskedApiKey(k.key)}</code>
              <button onClick={() => setVerIds((v) => ({ ...v, [k.id]: !v[k.id] }))} className="text-[11px] text-indigo-700 underline cursor-pointer">{verIds[k.id] ? "Ocultar" : "Ver"}</button>
              <button onClick={() => remover(k.id)} className="text-[11px] text-red-700 underline cursor-pointer">Remover</button>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <input className={`${campo} sm:col-span-5`} type={verNova ? "text" : "password"} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Colar nova chave Gemini (AIza...)" autoComplete="off" />
            <input className={`${campo} sm:col-span-3`} value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Nome (opcional)" maxLength={40} />
            <select className={`${campo} sm:col-span-2`} value={tipo} onChange={(e) => setTipo(e.target.value as any)}><option value="free">gratuita</option><option value="paid">paga</option></select>
            <button onClick={adicionar} className="sm:col-span-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">Adicionar</button>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={verNova} onChange={(e) => setVerNova(e.target.checked)} /> mostrar a chave que estou colando</label>
        </section>

        <section className="space-y-2 pt-3 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Claude (Anthropic): Chat da minuta e Copiloto</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select className={campo} value={provedor} onChange={(e) => setProvedor(e.target.value as any)}><option value="gemini">IA do Chat e do Copiloto: Gemini</option><option value="claude">IA do Chat e do Copiloto: Claude</option></select>
            <select className={campo} value={modelo} onChange={(e) => setModelo(e.target.value)}>{MODELOS_CLAUDE.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
          </div>
          <div className="flex gap-2">
            <input className={campo} type={verClaude ? "text" : "password"} value={claude} onChange={(e) => setClaude(e.target.value)} placeholder="Chave de API da Claude (sk-ant-...)" autoComplete="off" />
            <button onClick={() => setVerClaude((v) => !v)} className="px-3 text-xs rounded-lg border border-slate-300 cursor-pointer">{verClaude ? "Ocultar" : "Ver"}</button>
            <button onClick={testarClaude} disabled={claude.trim().length < 20} className="px-3 text-xs rounded-lg border border-indigo-300 text-indigo-700 disabled:opacity-50 cursor-pointer">Testar</button>
          </div>
          <p className="text-[11px] text-slate-500">Para remover a chave da Claude, apague o campo e salve.</p>
        </section>

        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.t}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-slate-600 cursor-pointer">Fechar</button>
          <button onClick={salvar} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar chaves"}</button>
        </div>
      </div>
    </div>
  );
};
