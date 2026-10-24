import React, { useState } from "react";
import toast from "react-hot-toast";
import { getApiHeaders } from "../utils/apiKeyManager";
import { MODELOS_CLAUDE, getChaveClaude, getModeloClaude, getProvedorChat, salvarPreferenciaIA, ProvedorChat } from "../utils/provedorIA";

/** Dentro de "Chave API": cadastro da chave da Claude (Anthropic) e escolha da IA que responde o Chat da minuta e o Copiloto de Gabinete. */
export const ClaudeKeySection: React.FC = () => {
  const [chave, setChave] = useState(getChaveClaude()), [modelo, setModelo] = useState(getModeloClaude()), [provedor, setProvedor] = useState<ProvedorChat>(getProvedorChat());
  const [ocupado, setOcupado] = useState(false), [teste, setTeste] = useState<{ ok: boolean; texto: string } | null>(null), [mostrar, setMostrar] = useState(false);
  const campo = "w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#673de6]";

  const testar = async () => {
    setOcupado(true); setTeste(null);
    try {
      const r = await fetch("/api/test-claude-key", { method: "POST", headers: getApiHeaders({ "x-ai-provider": "claude", "x-claude-api-key": chave.trim(), "x-claude-model": modelo }), body: "{}" });
      const j = await r.json().catch(() => ({}));
      setTeste(j.success ? { ok: true, texto: `Chave válida. Modelo respondeu: ${j.modelo}.` } : { ok: false, texto: j.error || "A chave não funcionou." });
    } catch { setTeste({ ok: false, texto: "Não consegui falar com o servidor para testar." }); }
    finally { setOcupado(false); }
  };
  const salvar = async () => {
    if (provedor === "claude" && chave.trim().length < 20) { toast.error("Cole a chave da Claude antes de escolher essa IA."); return; }
    setOcupado(true);
    try { await salvarPreferenciaIA({ provedor, chave, modelo }); toast.success(provedor === "claude" ? "Chat e Copiloto agora usam a Claude." : "Chat e Copiloto usam o Gemini."); }
    catch (e: any) { toast.error("Salvo neste navegador, mas não no seu cadastro: " + (e.message || "erro")); }
    finally { setOcupado(false); }
  };

  return (
    <div className="rounded-2xl border border-[#c9b8ff] bg-[#f5f1ff] p-4 space-y-3" data-testid="claude-section">
      <div>
        <h4 className="font-bold text-sm text-[#2f1c6a]">Claude (Anthropic) — IA alternativa para o Chat e o Copiloto</h4>
        <p className="text-xs text-slate-600 leading-snug mt-1">Não pede o seu usuário e senha da Claude: usa uma <strong>chave de API</strong>, criada em <span className="font-mono">console.anthropic.com</span> › API Keys. A assinatura do aplicativo Claude (Pro/Max) não vale; a API é cobrada à parte, na sua conta da Anthropic. As análises de minuta continuam no Gemini.</p>
      </div>
      <label className="block text-xs font-semibold text-slate-700">IA que responde o Chat da minuta e o Copiloto
        <select className={campo + " mt-1"} value={provedor} onChange={(e) => setProvedor(e.target.value as ProvedorChat)}>
          <option value="gemini">Gemini (padrão)</option>
          <option value="claude">Claude (Anthropic)</option>
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-700">Chave de API da Claude
        <div className="flex gap-2 mt-1">
          <input className={campo} type={mostrar ? "text" : "password"} placeholder="sk-ant-..." value={chave} onChange={(e) => { setChave(e.target.value); setTeste(null); }} autoComplete="off" />
          <button type="button" onClick={() => setMostrar((v) => !v)} className="px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-600 cursor-pointer">{mostrar ? "Ocultar" : "Ver"}</button>
        </div>
      </label>
      <label className="block text-xs font-semibold text-slate-700">Modelo
        <select className={campo + " mt-1"} value={modelo} onChange={(e) => setModelo(e.target.value)}>
          {MODELOS_CLAUDE.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>
      {teste && <p className={`text-xs ${teste.ok ? "text-emerald-700" : "text-red-700"}`}>{teste.texto}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado || chave.trim().length < 20} onClick={testar} className="px-4 py-2 rounded-full border border-[#673de6] text-[#673de6] bg-white text-xs font-bold disabled:opacity-50 cursor-pointer">Testar chave</button>
        <button type="button" disabled={ocupado} onClick={salvar} className="px-4 py-2 rounded-full bg-[#673de6] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Salvar</button>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">Atenção: com a Claude escolhida, o texto do processo usado no chat é enviado à Anthropic. Confirme se isso é permitido para o seu gabinete (segredo de justiça e política do tribunal sobre uso de IA).</p>
    </div>
  );
};
