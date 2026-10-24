import React, { useState } from "react";
import toast from "react-hot-toast";
import { chamarAuth } from "../lib/sessao";

/** Botão e janela para o próprio usuário trocar a senha de acesso. */
export const TrocarSenha: React.FC = () => {
  const [aberto, setAberto] = useState(false), [atual, setAtual] = useState(""), [nova, setNova] = useState(""), [nova2, setNova2] = useState(""), [ocupado, setOcupado] = useState(false);
  const fechar = () => { setAberto(false); setAtual(""); setNova(""); setNova2(""); };
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova !== nova2) { toast.error("As senhas novas não conferem."); return; }
    setOcupado(true);
    try { await chamarAuth("PATCH", "/me", { senhaAtual: atual, novaSenha: nova }); toast.success("Senha trocada."); fechar(); }
    catch (err: any) { toast.error(err.message || "Não foi possível trocar a senha."); }
    finally { setOcupado(false); }
  };
  const campo = "w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500";
  return (
    <>
      <button id="btn-trocar-senha" onClick={() => setAberto(true)} className="fixed bottom-16 left-4 z-40 px-3 py-1.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600 text-[11px] font-bold shadow cursor-pointer">Trocar senha</button>
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={fechar}>
          <form onSubmit={salvar} className="bg-slate-900 text-slate-100 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Trocar minha senha</h2>
            <input className={campo} type="password" placeholder="Senha atual" value={atual} onChange={(e) => setAtual(e.target.value)} required autoComplete="current-password" />
            <input className={campo} type="password" placeholder="Nova senha (mínimo 8 caracteres)" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={8} autoComplete="new-password" />
            <input className={campo} type="password" placeholder="Repita a nova senha" value={nova2} onChange={(e) => setNova2(e.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={fechar} className="px-3 py-2 rounded-lg text-sm text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={ocupado} className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-slate-950 disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
