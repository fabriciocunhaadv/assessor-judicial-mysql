import React, { useState } from "react";
import toast from "react-hot-toast";
import { chamarAuth } from "../lib/sessao";

/** Botão e janela para o próprio usuário trocar a senha de acesso. */
export const TrocarSenha: React.FC<{ aberto: boolean; onFechar: () => void }> = ({ aberto, onFechar }) => {
  const [atual, setAtual] = useState(""), [nova, setNova] = useState(""), [nova2, setNova2] = useState(""), [ocupado, setOcupado] = useState(false);
  const fechar = () => { onFechar(); setAtual(""); setNova(""); setNova2(""); };
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova !== nova2) { toast.error("As senhas novas não conferem."); return; }
    setOcupado(true);
    try { await chamarAuth("PATCH", "/me", { senhaAtual: atual, novaSenha: nova }); toast.success("Senha trocada."); fechar(); }
    catch (err: any) { toast.error(err.message || "Não foi possível trocar a senha."); }
    finally { setOcupado(false); }
  };
  const campo = "w-full px-3 py-2 rounded-lg bg-white border border-[#c9cbd8] text-sm text-[#1d1e20] focus:outline-none focus:border-[#673de6]";
  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={fechar}>
          <form onSubmit={salvar} className="bg-white text-[#1d1e20] border border-[#e4e5ed] rounded-3xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Trocar minha senha</h2>
            <input className={campo} type="password" placeholder="Senha atual" value={atual} onChange={(e) => setAtual(e.target.value)} required autoComplete="current-password" />
            <input className={campo} type="password" placeholder="Nova senha (mínimo 8 caracteres)" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={8} autoComplete="new-password" />
            <input className={campo} type="password" placeholder="Repita a nova senha" value={nova2} onChange={(e) => setNova2(e.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={fechar} className="px-3 py-2 rounded-lg text-sm text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={ocupado} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#673de6] text-white disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
