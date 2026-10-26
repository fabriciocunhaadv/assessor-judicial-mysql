import React, { useState } from "react";
import { LegalFramework } from "../data/legalTaxonomy";
import { getApiHeaders } from "../utils/apiKeyManager";

const linhas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
const campo = "w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400";
const rotulo = "block text-[11px] font-bold text-slate-600 mb-1";

/** Super Admin: cadastra ou altera um regime da Taxonomia Normativa. Fica na base compartilhada por todos os gabinetes. */
export const RegimeEditor: React.FC<{ inicial: LegalFramework | null; onSalvo: (fw: LegalFramework) => void; onCancelar: () => void }> = ({ inicial, onSalvo, onCancelar }) => {
  const rc = inicial?.regimeCorrecao;
  const [nome, setNome] = useState(inicial?.name || ""), [categoria, setCategoria] = useState(inicial?.category || "");
  const [palavras, setPalavras] = useState((inicial?.keywords || []).join(", "));
  const [leis, setLeis] = useState((inicial?.principaisLeis || []).map((l) => `${l.diploma} | ${l.artigosChave} | ${l.objeto}`).join("\n"));
  const [indCor, setIndCor] = useState(rc?.indiceCorrecao || ""), [iniCor, setIniCor] = useState(rc?.termoInicialCorrecao || "");
  const [indJur, setIndJur] = useState(rc?.indiceJuros || ""), [iniJur, setIniJur] = useState(rc?.termoInicialJuros || "");
  const [base, setBase] = useState(rc?.baseLegalCompleta || ""), [obs, setObs] = useState(rc?.observacoes || "");
  const [sumulas, setSumulas] = useState((inicial?.sumulasEPrecedentes || []).join("\n")), [clausula, setClausula] = useState(inicial?.clausulaDispositivoPadrao || "");
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(""); setOcupado(true);
    try {
      const corpo = {
        id: inicial?.id, name: nome, category: categoria, keywords: palavras.split(",").map((x) => x.trim()).filter(Boolean),
        principaisLeis: linhas(leis).map((l) => { const [diploma = "", artigosChave = "", ...resto] = l.split("|").map((x) => x.trim()); return { diploma, artigosChave, objeto: resto.join(" | ") }; }),
        regimeCorrecao: { indiceCorrecao: indCor, termoInicialCorrecao: iniCor, indiceJuros: indJur, termoInicialJuros: iniJur, baseLegalCompleta: base, observacoes: obs },
        sumulasEPrecedentes: linhas(sumulas), clausulaDispositivoPadrao: clausula,
      };
      const r = await fetch("/api/taxonomia", { method: "POST", headers: getApiHeaders(), body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j.success) throw new Error(j.error || `Erro ${r.status}`);
      onSalvo(j.regime);
    } catch (err: any) { setErro(err?.message || "Não consegui salvar."); } finally { setOcupado(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-900/60" onClick={onCancelar}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 text-slate-900">
        <h3 className="text-base font-bold">{inicial ? "Alterar regime" : "Novo regime"} da Taxonomia Normativa</h3>
        <p className="text-[11px] text-slate-500">Fica na base compartilhada por todos os gabinetes. Passa a aparecer no catálogo, na Pesquisa Legislativa e no prompt das minutas quando as palavras-chave aparecem nos autos.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={rotulo}>Nome do regime *</label><input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={160} placeholder="Ex.: Planos de saúde e reajuste por faixa etária" /></div>
          <div><label className={rotulo}>Categoria *</label><input className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)} required maxLength={120} placeholder="Ex.: Direito do Consumidor" /></div>
        </div>
        <div><label className={rotulo}>Palavras-chave * (separadas por vírgula; o regime aparece quando elas surgem nos autos)</label><input className={campo} value={palavras} onChange={(e) => setPalavras(e.target.value)} required placeholder="plano de saúde, reajuste, faixa etária" /></div>
        <div><label className={rotulo}>Leis e artigos * (uma por linha, no formato: Diploma | Artigos | Para que serve)</label><textarea className={`${campo} font-mono`} rows={4} value={leis} onChange={(e) => setLeis(e.target.value)} required placeholder={"Lei Federal nº 9.656/1998 | arts. 15 e 35-E | Planos privados de assistência à saúde\nCódigo de Defesa do Consumidor (Lei nº 8.078/1990) | arts. 6º e 51 | Proteção contratual"} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={rotulo}>Índice de correção monetária</label><input className={campo} value={indCor} onChange={(e) => setIndCor(e.target.value)} placeholder="Ex.: IPCA (IBGE)" /></div>
          <div><label className={rotulo}>Termo inicial da correção</label><input className={campo} value={iniCor} onChange={(e) => setIniCor(e.target.value)} placeholder="Ex.: data do efetivo prejuízo (Súmula 43/STJ)" /></div>
          <div><label className={rotulo}>Índice de juros</label><input className={campo} value={indJur} onChange={(e) => setIndJur(e.target.value)} placeholder="Ex.: Selic deduzida do IPCA (art. 406, § 1º, CC)" /></div>
          <div><label className={rotulo}>Termo inicial dos juros</label><input className={campo} value={iniJur} onChange={(e) => setIniJur(e.target.value)} placeholder="Ex.: citação (art. 405/CC)" /></div>
        </div>
        <div><label className={rotulo}>Base legal completa (frase pronta para a fundamentação)</label><textarea className={campo} rows={2} value={base} onChange={(e) => setBase(e.target.value)} /></div>
        <div><label className={rotulo}>Observação técnica</label><textarea className={campo} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div><label className={rotulo}>Súmulas e precedentes aplicáveis (um por linha)</label><textarea className={campo} rows={3} value={sumulas} onChange={(e) => setSumulas(e.target.value)} placeholder="Súmula 54/STJ: ..." /></div>
        <div><label className={rotulo}>Cláusula padrão do dispositivo</label><textarea className={campo} rows={3} value={clausula} onChange={(e) => setClausula(e.target.value)} /></div>
        {erro && <p className="text-xs text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancelar} className="px-3 py-2 rounded-lg text-xs text-slate-600 cursor-pointer">Cancelar</button>
          <button type="submit" disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-60 cursor-pointer">{ocupado ? "Salvando..." : "Salvar regime"}</button>
        </div>
      </form>
    </div>
  );
};
