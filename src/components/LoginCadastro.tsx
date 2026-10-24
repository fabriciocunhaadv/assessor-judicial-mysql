import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { cadastrar } from "../lib/sessao";

/** Tela de entrada: login por e-mail e senha, ou pedido de cadastro (o administrador precisa aprovar). */
export const LoginCadastro: React.FC = () => {
  const { signIn } = useAuth();
  const [modo, setModo] = useState<"entrar" | "cadastro">("entrar");
  const [nome, setNome] = useState(""), [email, setEmail] = useState(""), [senha, setSenha] = useState(""), [senha2, setSenha2] = useState("");
  const [ocupado, setOcupado] = useState(false), [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso(null);
    if (modo === "cadastro" && senha !== senha2) { setAviso({ tipo: "erro", texto: "As senhas não conferem." }); return; }
    setOcupado(true);
    try {
      if (modo === "entrar") await signIn(email, senha);      // o erro de login aparece no aviso de acesso da tela
      else {
        const r = await cadastrar(nome, email, senha);
        setAviso({ tipo: "ok", texto: r.mensagem });
        setModo("entrar"); setSenha(""); setSenha2("");
      }
    } catch (err: any) { if (modo === "cadastro") setAviso({ tipo: "erro", texto: err.message || "Não foi possível enviar o cadastro." }); }
    finally { setOcupado(false); }
  };

  const campo = "w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500";
  return (
    <form onSubmit={enviar} className="space-y-3 text-left">
      <div className="flex rounded-xl overflow-hidden border border-slate-700 text-xs font-bold">
        {(["entrar", "cadastro"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setModo(m); setAviso(null); }} className={`flex-1 py-2 cursor-pointer ${modo === m ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400"}`}>
            {m === "entrar" ? "Entrar" : "Solicitar cadastro"}
          </button>
        ))}
      </div>
      {modo === "cadastro" && <input className={campo} placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} autoComplete="name" />}
      <input className={campo} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={campo} type="password" placeholder="Senha (mínimo 8 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={modo === "cadastro" ? 8 : 1} autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
      {modo === "cadastro" && <input className={campo} type="password" placeholder="Repita a senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} required minLength={8} autoComplete="new-password" />}
      {aviso && <p className={`text-[11px] leading-snug ${aviso.tipo === "ok" ? "text-emerald-300" : "text-red-300"}`}>{aviso.texto}</p>}
      <button type="submit" disabled={ocupado} className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold rounded-xl shadow cursor-pointer text-sm">
        {ocupado ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Enviar pedido de cadastro"}
      </button>
      {modo === "cadastro" && <p className="text-[10px] text-slate-500 leading-snug">Seu pedido fica pendente até o administrador aprovar. Depois da aprovação, entre com o mesmo e-mail e senha.</p>}
    </form>
  );
};
