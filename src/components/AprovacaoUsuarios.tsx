import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { chamarAuth } from "../lib/sessao";
import { collection, getDocs } from "../lib/docstore";

interface Cadastro { uid: string; name: string; email: string; status: string; role: string; tenantId: string; isJudge: boolean; superAdmin?: boolean; perfilImportado?: { tenantId?: string; role?: string; isJudge?: boolean; judgeTitle?: string }; createdAt: number }

/** Super admin: aprova ou recusa pedidos de cadastro e desativa/reativa usuários. */
export const AprovacaoUsuarios: React.FC = () => {
  const [aberto, setAberto] = useState(false), [lista, setLista] = useState<Cadastro[]>([]), [ocupado, setOcupado] = useState(false);
  const [gabinetes, setGabinetes] = useState<{ id: string; nome: string }[]>([{ id: "gabinete_default", nome: "Gabinete principal" }]), [gab, setGab] = useState("gabinete_default");
  const carregar = useCallback(async () => {
    try { setLista((await chamarAuth<{ usuarios: Cadastro[] }>("GET", "/users")).usuarios); } catch (e: any) { toast.error(e.message); }
    try {      // gabinetes cadastrados, para escolher onde o novo usuário entra
      const sn = await getDocs(collection(null, "tenants"));
      const outros = sn.docs.filter((d) => d.id !== "gabinete_default").map((d) => ({ id: d.id, nome: String((d.data() as any).name || d.id) }));
      setGabinetes([{ id: "gabinete_default", nome: "Gabinete principal" }, ...outros]);
    } catch { /* fica só o principal */ }
  }, []);
  useEffect(() => { void carregar(); const t = setInterval(() => { void carregar(); }, 60000); return () => clearInterval(t); }, [carregar]);

  const agir = async (c: Cadastro, acao: string, extra: Record<string, any> = {}) => {
    setOcupado(true);
    try { await chamarAuth("POST", `/users/${c.uid}/acao`, { acao, ...extra }); toast.success("Feito."); await carregar(); }
    catch (e: any) { toast.error(e.message); }
    finally { setOcupado(false); }
  };
  const pendentes = lista.filter((c) => c.status === "pendente").length;
  const rotulo: Record<string, string> = { pendente: "Pendente", aprovado: "Ativo", recusado: "Recusado", desativado: "Desativado" };
  const btn = "px-2 py-1 rounded text-[11px] font-bold cursor-pointer disabled:opacity-50";

  return (
    <>
      <button id="btn-cadastros-aprovacao" onClick={() => setAberto(true)} className="fixed bottom-4 left-4 z-40 px-3 py-2 rounded-full bg-[#673de6] text-white text-xs font-bold shadow-lg cursor-pointer hover:bg-[#5025d1]">
        Cadastros{pendentes > 0 ? ` (${pendentes} pendente${pendentes > 1 ? "s" : ""})` : ""}
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="bg-white text-[#1d1e20] border border-[#e4e5ed] rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Cadastros de usuários</h2>
              <button onClick={() => setAberto(false)} className="text-slate-500 cursor-pointer">✕</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">Aprovar novos usuários no gabinete:
              <select value={gab} onChange={(e) => setGab(e.target.value)} className="bg-white border border-[#c9cbd8] rounded-lg px-2 py-1 text-[#1d1e20]">
                {gabinetes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
            {lista.length === 0 && <p className="text-sm text-slate-400">Nenhum cadastro ainda.</p>}
            {lista.map((c) => (
              <div key={c.uid} className="p-3 rounded-2xl border border-[#e4e5ed] bg-[#f4f4f6] flex flex-wrap items-center gap-2 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{c.name} <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ebe4ff] text-[#5025d1]">{rotulo[c.status] || c.status}</span></div>
                  <div className="text-xs text-slate-400">{c.email} · {new Date(c.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
                {c.status === "pendente" && c.perfilImportado && (
                  <button disabled={ocupado} className={`${btn} bg-amber-600 text-white`} onClick={() => agir(c, "aprovar", { usarImportado: true })}>
                    Aprovar com perfil antigo ({c.perfilImportado.role === "admin" ? "admin" : "usuário"}{c.perfilImportado.isJudge ? ", juiz" : ""} · {c.perfilImportado.tenantId || "gabinete"})
                  </button>
                )}
                {c.status === "pendente" && <>
                  <button disabled={ocupado} className={`${btn} bg-emerald-600 text-white`} onClick={() => agir(c, "aprovar", { tenantId: gab, role: "user" })}>Aprovar</button>
                  <button disabled={ocupado} className={`${btn} bg-emerald-800 text-white`} onClick={() => agir(c, "aprovar", { tenantId: gab, role: "admin" })}>Aprovar como admin</button>
                  <button disabled={ocupado} className={`${btn} bg-red-700 text-white`} onClick={() => agir(c, "recusar")}>Recusar</button>
                </>}
                {c.status === "aprovado" && !c.superAdmin && (
                  <button disabled={ocupado} className={`${btn} bg-[#1d1e20] text-white`} onClick={() => agir(c, "desativar")}>Desativar</button>
                )}
                {(c.status === "desativado" || c.status === "recusado") && <button disabled={ocupado} className={`${btn} bg-[#1d1e20] text-white`} onClick={() => agir(c, "reativar", { tenantId: c.tenantId !== "unassigned" ? c.tenantId : "gabinete_default" })}>Reativar</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
