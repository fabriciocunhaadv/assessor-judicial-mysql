import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { chamarAuth } from "../lib/sessao";
import { collection, getDocs } from "../lib/docstore";
import { isPrimaryCabinet } from "../lib/firestoreUtils";

interface Cadastro { uid: string; name: string; email: string; status: string; role: string; tenantId: string; isJudge: boolean; superAdmin?: boolean; perfilImportado?: { tenantId?: string; role?: string; isJudge?: boolean; judgeTitle?: string }; createdAt: number }
interface Gabinete { id: string; nome: string }

const PRINCIPAL = "gabinete_default";
const canon = (t?: string) => (!t || t === "unassigned" || isPrimaryCabinet(t) ? PRINCIPAL : t);

/** Super admin: aprova ou recusa pedidos de cadastro (escolhendo o gabinete de cada pessoa), desativa, reativa e redefine senhas. */
export const AprovacaoUsuarios: React.FC = () => {
  const [aberto, setAberto] = useState(false), [lista, setLista] = useState<Cadastro[]>([]), [ocupado, setOcupado] = useState(false);
  const [gabinetes, setGabinetes] = useState<Gabinete[]>([{ id: PRINCIPAL, nome: "Gabinete principal" }]);
  const [escolhido, setEscolhido] = useState<Record<string, string>>({});      // gabinete escolhido por usuário

  const carregar = useCallback(async () => {
    let usuarios: Cadastro[] = [];
    try { usuarios = (await chamarAuth<{ usuarios: Cadastro[] }>("GET", "/users")).usuarios; setLista(usuarios); } catch (e: any) { toast.error(e.message); }
    try {      // gabinetes cadastrados + os que aparecem nos perfis importados; os gabinetes principais antigos viram um só
      const mapa = new Map<string, string>([[PRINCIPAL, "Gabinete principal"]]);
      const sn = await getDocs(collection(null, "tenants"));
      sn.docs.forEach((d) => { const id = canon(d.id); if (!mapa.has(id)) mapa.set(id, String((d.data() as any).name || id)); else if (id === PRINCIPAL && (d.data() as any).name) mapa.set(PRINCIPAL, `Gabinete principal (${(d.data() as any).name})`); });
      usuarios.forEach((u) => { const id = canon(u.perfilImportado?.tenantId || u.tenantId); if (!mapa.has(id)) mapa.set(id, id); });
      setGabinetes(Array.from(mapa, ([id, nome]) => ({ id, nome })));
    } catch { /* fica só o principal */ }
  }, []);
  useEffect(() => { void carregar(); const t = setInterval(() => { void carregar(); }, 60000); return () => clearInterval(t); }, [carregar]);

  const gabDe = (c: Cadastro) => escolhido[c.uid] || canon(c.perfilImportado?.tenantId || (c.tenantId !== "unassigned" ? c.tenantId : undefined));
  const agir = async (c: Cadastro, acao: string, extra: Record<string, any> = {}, aviso = "Feito.") => {
    setOcupado(true);
    try { await chamarAuth("POST", `/users/${c.uid}/acao`, { acao, ...extra }); toast.success(aviso); await carregar(); }
    catch (e: any) { toast.error(e.message); }
    finally { setOcupado(false); }
  };
  const pendentes = lista.filter((c) => c.status === "pendente").length;
  const rotulo: Record<string, string> = { pendente: "Pendente", aprovado: "Ativo", recusado: "Recusado", desativado: "Desativado" };
  const nomeGab = (id?: string) => gabinetes.find((g) => g.id === canon(id))?.nome || canon(id);
  const btn = "px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer disabled:opacity-50";

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
            <p className="text-xs text-slate-600">Escolha o <strong>gabinete</strong> de cada pessoa e aprove. Para liberar o acesso de alguém que ainda não se cadastrou, use <em>Configurações › Equipe e Acessos</em> (a pessoa entra com a senha inicial 12345678 e troca no primeiro acesso).</p>
            {lista.length === 0 && <p className="text-sm text-slate-500">Nenhum cadastro ainda.</p>}
            {lista.map((c) => (
              <div key={c.uid} className="p-3 rounded-2xl border border-[#e4e5ed] bg-[#f4f4f6] space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold">{c.name} <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ebe4ff] text-[#5025d1]">{rotulo[c.status] || c.status}</span>{c.isJudge && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Juiz</span>}</div>
                    <div className="text-xs text-slate-500">{c.email} · {new Date(c.createdAt).toLocaleDateString("pt-BR")}{c.status === "aprovado" && c.tenantId !== "unassigned" ? ` · ${nomeGab(c.tenantId)}` : ""}</div>
                  </div>
                  {c.status === "aprovado" && !c.superAdmin && <>
                    <button disabled={ocupado} className={`${btn} bg-white border border-[#c9cbd8] text-[#673de6]`} onClick={() => { if (window.confirm(`Redefinir a senha de ${c.name} para a senha inicial (12345678)? Ela será obrigada a criar outra no próximo acesso.`)) void agir(c, "redefinir_senha", {}, "Senha redefinida para 12345678 (a pessoa troca no próximo acesso)."); }}>Redefinir senha</button>
                    <button disabled={ocupado} className={`${btn} bg-[#1d1e20] text-white`} onClick={() => agir(c, "desativar")}>Desativar</button>
                  </>}
                </div>
                {(c.status === "pendente" || c.status === "recusado" || c.status === "desativado") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">Gabinete:
                      <select value={gabDe(c)} onChange={(e) => setEscolhido((m) => ({ ...m, [c.uid]: e.target.value }))} className="bg-white border border-[#c9cbd8] rounded-lg px-2 py-1 text-[#1d1e20] text-xs max-w-[220px]">
                        {gabinetes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                      </select>
                    </label>
                    {c.status === "pendente" && <>
                      {c.perfilImportado && <button disabled={ocupado} className={`${btn} bg-amber-600 text-white`} onClick={() => agir(c, "aprovar", { usarImportado: true, tenantId: gabDe(c) })}>Aprovar com perfil antigo ({c.perfilImportado.role === "admin" ? "admin" : "usuário"}{c.perfilImportado.isJudge ? ", juiz" : ""})</button>}
                      <button disabled={ocupado} className={`${btn} bg-[#673de6] text-white`} onClick={() => agir(c, "aprovar", { tenantId: gabDe(c), role: "user" })}>Aprovar</button>
                      <button disabled={ocupado} className={`${btn} bg-[#4a2bb3] text-white`} onClick={() => agir(c, "aprovar", { tenantId: gabDe(c), role: "admin" })}>Aprovar como admin</button>
                      <button disabled={ocupado} className={`${btn} bg-red-700 text-white`} onClick={() => agir(c, "recusar")}>Recusar</button>
                    </>}
                    {(c.status === "desativado" || c.status === "recusado") && <button disabled={ocupado} className={`${btn} bg-[#673de6] text-white`} onClick={() => agir(c, "reativar", { tenantId: gabDe(c) })}>Reativar neste gabinete</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
