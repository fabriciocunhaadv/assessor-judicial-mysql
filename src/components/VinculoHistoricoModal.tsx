import React, { useEffect, useMemo, useState } from "react";
import { chamarAuth } from "../lib/sessao";

interface Autor { tenant: string; criador: string; minutas: number; ultima: number; email: string; nome: string; pertenceA: string }
const campo = "px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400";

/** Super Admin: liga ao usuário as minutas do sistema antigo que foram gravadas com outro id ou outro e-mail. Nada é apagado nem reescrito: o vínculo fica no cadastro do usuário. */
export const VinculoHistoricoModal: React.FC<{ usuario: any; onClose: () => void; onSalvo?: () => void }> = ({ usuario, onClose, onSalvo }) => {
  const [autores, setAutores] = useState<Autor[] | null>(null), [erro, setErro] = useState(""), [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set(Array.isArray(usuario?.uidsAntigos) ? usuario.uidsAntigos : []));
  const [ocupado, setOcupado] = useState(false), [ok, setOk] = useState("");
  const meuEmail = String(usuario?.email || "").toLowerCase();

  useEffect(() => { chamarAuth<{ autores: Autor[] }>("GET", "/historico-autores").then((r) => setAutores(r.autores)).catch((e: any) => setErro(e.message || "Não consegui ler os autores.")); }, []);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (autores || []).filter((a) => a.criador !== usuario?.uid).filter((a) => !q || `${a.nome} ${a.email} ${a.criador}`.toLowerCase().includes(q))
      .sort((x, y) => Number(y.email.toLowerCase() === meuEmail) - Number(x.email.toLowerCase() === meuEmail) || y.minutas - x.minutas);
  }, [autores, busca, meuEmail, usuario?.uid]);
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const salvar = async () => {
    setOcupado(true); setOk(""); setErro("");
    try { await chamarAuth("POST", `/users/${usuario.uid}/acao`, { acao: "vincular_historico", criadores: Array.from(marcados) }); setOk("Vínculo salvo. As minutas marcadas aparecem em “Minhas” desse usuário no próximo acesso."); onSalvo?.(); }
    catch (e: any) { setErro(e.message || "Não consegui salvar."); } finally { setOcupado(false); }
  };
  const total = (autores || []).filter((a) => marcados.has(a.criador)).reduce((s, a) => s + a.minutas, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-900/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Histórico antigo de {usuario?.name || usuario?.email}</h3>
            <p className="text-[11px] text-slate-500">{usuario?.email}. Marque os autores do sistema antigo que são esta pessoa (o id ou o e-mail pode ter mudado). Nenhuma minuta é alterada ou apagada: o vínculo fica no cadastro do usuário e pode ser desfeito.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Fechar">✕</button>
        </div>
        <input className={`${campo} w-full`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail do autor (ex.: amanda)" />
        {!autores && !erro && <p className="text-xs text-slate-500">Carregando autores...</p>}
        {autores && lista.length === 0 && <p className="text-xs text-slate-500">Nenhum autor encontrado.</p>}
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[48vh] overflow-y-auto">
          {lista.map((a) => {
            const igual = !!a.email && a.email.toLowerCase() === meuEmail;
            return (
              <label key={a.tenant + a.criador} className={`flex items-start gap-3 p-2.5 text-xs cursor-pointer hover:bg-slate-50 ${marcados.has(a.criador) ? "bg-indigo-50" : ""}`}>
                <input type="checkbox" className="mt-0.5" checked={marcados.has(a.criador)} onChange={() => alternar(a.criador)} />
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">{a.nome || a.email || "Sem nome registrado"}</span>
                  {igual && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">mesmo e-mail</span>}
                  {a.pertenceA && a.pertenceA.toLowerCase() !== meuEmail && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">já é de {a.pertenceA}</span>}
                  <span className="block text-[11px] text-slate-500 break-all">{a.email || "sem e-mail"} · id {a.criador.slice(0, 12)}{a.criador.length > 12 ? "…" : ""}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-slate-600">{a.minutas} minuta(s)<br />{a.ultima ? new Date(a.ultima).toLocaleDateString("pt-BR") : ""}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate-600">{marcados.size} autor(es) marcado(s), {total} minuta(s) no total.</p>
        {erro && <p className="text-xs text-red-700">{erro}</p>}
        {ok && <p className="text-xs text-emerald-700">{ok}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-slate-600 cursor-pointer">Fechar</button>
          <button onClick={salvar} disabled={ocupado || !autores} className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar vínculo"}</button>
        </div>
      </div>
    </div>
  );
};
