import React, { useEffect, useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import { getApiHeaders } from "../utils/apiKeyManager";

interface Dados { titulo: string; salvoEm: number; linhas: string[]; reconhecidos: { revogados: number; vetados: number } | null; revogadosChaves?: string[]; vetadosChaves?: string[] }
const REVOGADO_FORMAL = /\(\s*Revogad[oa]s?\b/i, MENCIONA = /Revogad[oa]s?|Vetad[oa]s?/i, ALTERADO = /Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Acrescid[oa]|Renumerad[oa]|Alterad[oa]|Vide\s/i, INICIO_ARTIGO = /^Art\.?\s*\d/i;
const LIMITE_TELA = 1200;
const chaveDoArtigo = (t: string) => { const m = /^Art\.?\s*(\d{1,4})(?:\.(\d{3}))?\s*(?:[º°o](?![a-zà-ú])|\.)?\s*(?:-\s*([A-Z]{1,2})\b)?/i.exec(t); return m ? `${m[1]}${m[2] || ""}${m[3] ? "-" + m[3].toUpperCase() : ""}` : ""; };

/** Botão-ícone (olho) que abre o texto guardado de uma lei, só leitura: mostra artigo por artigo, destaca revogados, vetados e alterações e permite buscar. Só Super Admin. */
export const BotaoVerLei: React.FC<{ caminho: string; titulo?: string }> = ({ caminho, titulo }) => {
  const [aberto, setAberto] = useState(false), [dados, setDados] = useState<Dados | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState(""), [filtro, setFiltro] = useState<"todas" | "revogados" | "alterados">("todas"), [mostrar, setMostrar] = useState(LIMITE_TELA);
  useEffect(() => {
    if (!aberto || dados || carregando) return;
    setCarregando(true); setErro("");
    fetch(caminho, { headers: getApiHeaders() }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); setDados(j); }).catch((e) => setErro(e.message)).finally(() => setCarregando(false));
  }, [aberto]);
  const resumo = useMemo(() => {
    const ls = dados?.linhas || [];
    return { artigos: ls.filter((l) => INICIO_ARTIGO.test(l)).length, mencionam: ls.filter((l) => MENCIONA.test(l)).length, alterados: ls.filter((l) => ALTERADO.test(l)).length };
  }, [dados]);
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.linhas || []).map((texto, i) => ({ texto, i })).filter(({ texto }) => (filtro === "todas" || (filtro === "revogados" ? MENCIONA.test(texto) : ALTERADO.test(texto))) && (!q || texto.toLowerCase().includes(q)));
  }, [dados, busca, filtro]);
  const rev = useMemo(() => new Set((dados?.revogadosChaves || []).map((k) => k.toUpperCase())), [dados]), vet = useMemo(() => new Set((dados?.vetadosChaves || []).map((k) => k.toUpperCase())), [dados]);
  const reconhecido = (t: string) => { if (!INICIO_ARTIGO.test(t)) return false; const k = chaveDoArtigo(t).toUpperCase(); return rev.has(k) || vet.has(k) || (!dados?.revogadosChaves && REVOGADO_FORMAL.test(t)); };
  const classe = (t: string) => reconhecido(t) ? "bg-red-50 border-l-4 border-red-500 text-red-900" : MENCIONA.test(t) ? "bg-amber-50 border-l-4 border-amber-500 text-amber-900" : ALTERADO.test(t) ? "bg-sky-50 border-l-4 border-sky-300 text-slate-700" : "border-l-4 border-transparent text-slate-800";
  const selo = (t: string) => reconhecido(t) ? "Revogado/vetado (o sistema reconhece)" : MENCIONA.test(t) ? "Menciona revogação/veto" : "";
  return (
    <>
      <button onClick={() => setAberto(true)} title={titulo || "Ver o texto guardado desta lei"} aria-label="Ver o texto guardado desta lei" className="p-1.5 rounded-full border border-slate-300 bg-white text-slate-600 hover:text-[#673de6] hover:border-[#673de6] cursor-pointer" data-testid="ver-lei"><Eye className="w-4 h-4" /></button>
      {aberto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-3" onClick={() => setAberto(false)}>
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200">
              <div className="min-w-0"><p className="font-bold text-sm truncate">{dados?.titulo || titulo || "Texto da lei"}</p>
                {dados && <p className="text-[11px] text-slate-500">Guardado em {new Date(dados.salvoEm).toLocaleDateString("pt-BR")} · {dados.linhas.length.toLocaleString("pt-BR")} linhas · {resumo.artigos.toLocaleString("pt-BR")} artigos · só leitura</p>}</div>
              <button onClick={() => setAberto(false)} className="p-1 rounded-full hover:bg-slate-100 cursor-pointer" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            {carregando && <p className="p-4 text-xs text-slate-500">Carregando…</p>}
            {erro && <p className="p-4 text-xs text-red-700">{erro}</p>}
            {dados && (
              <>
                <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                  <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(LIMITE_TELA); }} placeholder="Buscar (ex.: art. 175, prescrição)" className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  {([["todas", "Tudo"], ["revogados", `Revogados/vetados (${resumo.mencionam})`], ["alterados", `Alterados (${resumo.alterados})`]] as const).map(([k, r]) => (
                    <button key={k} onClick={() => { setFiltro(k); setMostrar(LIMITE_TELA); }} className={`px-2.5 py-1 rounded-full font-bold cursor-pointer border ${filtro === k ? "bg-[#673de6] text-white border-[#673de6]" : "bg-white text-slate-600 border-slate-300"}`}>{r}</button>
                  ))}
                </div>
                <p className="px-3 pt-2 text-[11px] text-slate-500">
                  O sistema reconhece como <strong className="text-red-700">revogado ou vetado</strong>{dados.reconhecidos ? `: ${dados.reconhecidos.revogados} artigo(s) revogado(s) e ${dados.reconhecidos.vetados} vetado(s)` : ""} (em vermelho).
                  Em <strong className="text-amber-700">amarelo</strong>: linhas que mencionam revogação ou veto sem o formato que o sistema reconhece (confira). Em <strong className="text-sky-700">azul</strong>: alterações (“Redação dada…”, “Incluído…”).
                </p>
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-[12px] leading-relaxed" data-testid="texto-lei">
                  {visiveis.slice(0, mostrar).map(({ texto, i }) => (
                    <div key={i} className={`px-2 py-1 rounded-sm ${classe(texto)}`}>
                      {selo(texto) && <span className="mr-1.5 text-[9px] uppercase font-bold tracking-wide opacity-80">[{selo(texto)}]</span>}
                      <span className={INICIO_ARTIGO.test(texto) ? "font-semibold" : ""}>{texto}</span>
                    </div>
                  ))}
                  {visiveis.length === 0 && <p className="text-slate-500 p-2">Nada encontrado.</p>}
                  {visiveis.length > mostrar && <button onClick={() => setMostrar((m) => m + LIMITE_TELA)} className="w-full py-2 text-xs font-bold text-[#673de6] cursor-pointer">Mostrar mais ({(visiveis.length - mostrar).toLocaleString("pt-BR")} linhas restantes)</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
