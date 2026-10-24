import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { chamarAuth } from "../lib/sessao";

/** Primeiro acesso com a senha inicial (12345678): a pessoa precisa criar a própria senha antes de usar o sistema. Não dá para fechar. */
export const TrocaSenhaObrigatoria: React.FC = () => {
  const { userProfile, recheckInvite, signOut } = useAuth();
  const [nome, setNome] = useState(userProfile?.name && !String(userProfile.name).includes("@") ? userProfile.name : ""), [atual, setAtual] = useState("12345678"), [nova, setNova] = useState(""), [nova2, setNova2] = useState("");
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro("");
    if (nova !== nova2) { setErro("As senhas novas não conferem."); return; }
    setOcupado(true);
    try {
      await chamarAuth("PATCH", "/me", { senhaAtual: atual, novaSenha: nova, ...(nome.trim().length >= 3 ? { nome: nome.trim() } : {}) });
      await recheckInvite();
    } catch (err: any) { setErro(err.message || "Não foi possível trocar a senha."); }
    finally { setOcupado(false); }
  };
  const campo = "w-full px-3 py-2.5 rounded-xl bg-white border border-[#c9cbd8] text-sm text-[#1d1e20] focus:outline-none focus:border-[#673de6]";
  return (
    <div className="fixed inset-0 z-[100000] bg-[#17122b]/90 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white text-[#1d1e20] rounded-3xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
        <h2 className="font-extrabold text-xl">Crie a sua senha</h2>
        <p className="text-sm text-slate-600 leading-snug">Este é o seu primeiro acesso, feito com a senha inicial. Por segurança, defina agora uma senha só sua (mínimo de 8 caracteres).</p>
        <input className={campo} placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        <input className={campo} type="password" placeholder="Senha atual (inicial)" value={atual} onChange={(e) => setAtual(e.target.value)} required autoComplete="current-password" />
        <input className={campo} type="password" placeholder="Nova senha" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={8} autoComplete="new-password" />
        <input className={campo} type="password" placeholder="Repita a nova senha" value={nova2} onChange={(e) => setNova2(e.target.value)} required minLength={8} autoComplete="new-password" />
        {erro && <p className="text-xs text-red-700">{erro}</p>}
        <button type="submit" disabled={ocupado} className="w-full py-3 rounded-full bg-[#673de6] text-white font-bold text-sm disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar e entrar"}</button>
        <button type="button" onClick={() => { void signOut(); }} className="w-full text-xs text-slate-500 cursor-pointer">Sair</button>
      </form>
    </div>
  );
};
