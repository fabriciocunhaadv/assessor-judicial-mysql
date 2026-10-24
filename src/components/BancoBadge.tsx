import React, { useState } from "react";
import { chamarAuth } from "../lib/sessao";
import { useAuth } from "../lib/AuthContext";
import { alternarTema, temaAtual } from "../utils/tema";

interface InfoBanco { motor: string; hospedagem: string; banco?: string; servidor?: string; cadastros?: { tabela: string; porSituacao: Record<string, number> }; tabelas?: { nome: string; descricao: string; linhas: number }[] }

/** Selo fixo que mostra onde ficam os dados (MySQL na Hostinger). O super admin vê o nome do banco, o servidor e a contagem de cada tabela. */
export const BancoBadge: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [aberto, setAberto] = useState(false), [info, setInfo] = useState<InfoBanco | null>(null), [erro, setErro] = useState("");
  const [tema, setTema] = useState(temaAtual());
  const abrir = async () => { setAberto(true); setErro(""); try { setInfo(await chamarAuth<InfoBanco>("GET", "/banco")); } catch (e: any) { setErro(e.message || "Não foi possível ler as informações do banco."); } };
  const situ: Record<string, string> = { aprovado: "ativos", pendente: "pendentes", recusado: "recusados", desativado: "desativados" };
  if (!isSuperAdmin) return null;      // selo do banco e botão de tema: só o super administrador
  return (
    <>
      <button id="btn-tema" onClick={() => setTema(alternarTema())} title="Alternar entre o visual Hostinger e o clássico" className="fixed bottom-4 right-44 z-40 px-2.5 py-1.5 rounded-lg bg-white text-[#673de6] border border-[#c9cbd8] text-[11px] font-semibold shadow cursor-pointer hover:bg-[#f5f1ff]">Tema: {tema === "hostinger" ? "Hostinger" : "Clássico"}</button>
      <button id="btn-banco-info" onClick={abrir} title="Onde estão os dados" className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#673de6] text-white text-[11px] font-semibold shadow-lg cursor-pointer hover:bg-[#5025d1]">
        <span className="w-2 h-2 rounded-full bg-emerald-300" />MySQL · Hostinger
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="bg-white text-[#1d1e20] rounded-xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#17122b] text-white px-5 py-3 flex justify-between items-center"><h2 className="font-bold">Onde estão os dados</h2><button onClick={() => setAberto(false)} className="text-white/70 cursor-pointer">✕</button></div>
            <div className="p-5 space-y-3 text-sm">
              {erro && <p className="text-red-600">{erro}</p>}
              {!info && !erro && <p className="text-slate-500">Carregando...</p>}
              {info && <>
                <p><strong>Banco de dados:</strong> {info.motor} na {info.hospedagem}. Este sistema não usa mais o Firebase.</p>
                {info.banco && <p><strong>Nome do banco:</strong> <code className="bg-[#f2f3f6] px-1.5 py-0.5 rounded">{info.banco}</code> · servidor <code className="bg-[#f2f3f6] px-1.5 py-0.5 rounded">{info.servidor}</code></p>}
                {info.cadastros && <p><strong>Cadastros e logins:</strong> tabela <code className="bg-[#f2f3f6] px-1.5 py-0.5 rounded">{info.cadastros.tabela}</code> ({Object.entries(info.cadastros.porSituacao).map(([k, v]) => `${v} ${situ[k] || k}`).join(", ") || "vazia"}).</p>}
                {info.tabelas && (
                  <table className="w-full text-xs border-t border-[#e4e5ed]"><tbody>
                    {info.tabelas.map((t) => (<tr key={t.nome} className="border-b border-[#e4e5ed]"><td className="py-1.5 pr-2 font-mono text-[#673de6]">{t.nome}</td><td className="py-1.5 pr-2 text-slate-600">{t.descricao}</td><td className="py-1.5 text-right font-semibold">{t.linhas}</td></tr>))}
                  </tbody></table>
                )}
                {!info.banco && <p className="text-slate-500 text-xs">Os detalhes técnicos (nome do banco e tabelas) aparecem para o super administrador.</p>}
              </>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
