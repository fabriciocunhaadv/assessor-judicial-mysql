// Aba "Modelos do Projudi" do Caderno de Teses & Modelos: lista os modelos que a extensão capturou no Projudi e enviou ao Studio (por gabinete).
// Aqui o usuário vê, copia e apaga. Quem usa esses modelos é o botão "Conferir modelos do Projudi" da minuta pronta.
import React, { useEffect, useMemo, useState } from "react";
import { Copy, Trash2, Eye, EyeOff, Loader2, RefreshCw, DownloadCloud } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { atualizarModeloPelaExtensao, estadoDaExtensaoParaModelos, ResultadoAtualizacao } from "../utils/modelosProjudiExtensao";
import { listarModelosProjudi, apagarModeloProjudi, ModeloProjudi, MODELOS_PROJUDI_EVENTO } from "../utils/modelosProjudi";

const TEXTO_ESTADO: Record<ResultadoAtualizacao["estado"], string> = { atualizado: "✔ Atualizado com o texto novo do Projudi", igual: "✔ Já estava igual ao Projudi", erro: "" };

export const ModelosProjudiPanel: React.FC = () => {
  const { isAdmin } = useAuth() as any;      // atualizar pelo Projudi: administrador do gabinete e Super Admin
  const [estado, setEstado] = useState<Record<string, ResultadoAtualizacao | "lendo">>({});
  const [todos, setTodos] = useState<{ feitos: number; total: number } | null>(null);
  const cancelarTodos = React.useRef<AbortController | null>(null);
  const [modelos, setModelos] = useState<ModeloProjudi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [abertos, setAbertos] = useState<string[]>([]);
  const [apagando, setApagando] = useState<string | null>(null);      // id aguardando confirmação
  const [copiado, setCopiado] = useState("");

  const carregar = () => { setCarregando(true); setErro(""); listarModelosProjudi().then(setModelos).catch((e) => setErro(e?.message || "Não consegui carregar os modelos.")).finally(() => setCarregando(false)); };
  useEffect(() => { carregar(); window.addEventListener(MODELOS_PROJUDI_EVENTO, carregar); return () => window.removeEventListener(MODELOS_PROJUDI_EVENTO, carregar); }, []);

  const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visiveis = useMemo(() => { const q = sem(filtro.trim()); return q ? modelos.filter((m) => sem(`${m.nome} ${m.tipo} ${m.serventia}`).includes(q)) : modelos; }, [modelos, filtro]);
  const grupos = useMemo(() => { const g = new Map<string, ModeloProjudi[]>(); for (const m of visiveis) (g.get(m.tipo || "Outros") || g.set(m.tipo || "Outros", []).get(m.tipo || "Outros")!).push(m); return [...g].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")); }, [visiveis]);

  const atualizarUm = async (m: ModeloProjudi, sinal?: AbortSignal) => {
    setEstado((e) => ({ ...e, [m.id]: "lendo" }));
    const r = await atualizarModeloPelaExtensao(m, sinal);
    setEstado((e) => ({ ...e, [m.id]: r }));
    return r;
  };
  const avisoExtensao = (): string => { const x = estadoDaExtensaoParaModelos(); return x === "sem-extensao" ? "A extensão Conclusões Projudi não foi detectada neste navegador." : x === "antiga" ? "A extensão instalada é antiga: atualize para a versão 2.0.10 ou mais nova para atualizar os modelos por aqui." : ""; };
  const atualizarTodos = async () => {
    const a = avisoExtensao(); if (a) { setErro(a); return; }
    setErro(""); const ctl = new AbortController(); cancelarTodos.current = ctl; const lista = visiveis.slice();
    setTodos({ feitos: 0, total: lista.length });
    for (let i = 0; i < lista.length && !ctl.signal.aborted; i++) {
      const r = await atualizarUm(lista[i], ctl.signal);
      setTodos({ feitos: i + 1, total: lista.length });
      if (r.estado === "erro" && /abra o Projudi|n[ãa]o respondeu|extens[ãa]o/i.test(r.erro || "")) { setErro(`Parei: ${r.erro}`); break; }      // sem Projudi/extensão não adianta tentar os outros
    }
    setTodos(null); cancelarTodos.current = null;
  };
  const atualizarUmComAviso = async (m: ModeloProjudi) => { const a = avisoExtensao(); if (a) { setErro(a); return; } setErro(""); await atualizarUm(m); };
  const copiar = async (m: ModeloProjudi) => { try { await navigator.clipboard.writeText(m.texto); setCopiado(m.id); setTimeout(() => setCopiado(""), 2000); } catch { setErro("Não consegui copiar. Abra o texto e copie à mão."); } };
  const apagar = async (id: string) => { try { await apagarModeloProjudi(id); setApagando(null); setModelos((l) => l.filter((x) => x.id !== id)); } catch (e: any) { setErro(e?.message || "Não consegui apagar."); } };
  const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="space-y-3" data-testid="modelos-projudi-painel">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-1">
        <div className="font-black">Modelos cadastrados no Projudi</div>
        <p>A extensão captura esses modelos no Projudi e os envia para cá (extensão → “Modelos do Projudi” → “Enviar ao Studio”). Eles ficam guardados <b>só no seu gabinete</b> e são usados no botão <b>“Conferir modelos do Projudi”</b> da minuta pronta. Para atualizar um modelo, capture de novo pela extensão.</p>
      </div>
      <div className="flex items-center gap-2">
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome, tipo ou serventia…" className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" data-testid="modelos-projudi-filtro" />
        <button onClick={carregar} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer flex items-center gap-1" title="Recarregar a lista"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>
        <span className="text-[11px] text-slate-500 shrink-0" data-testid="modelos-projudi-contagem">{visiveis.length} de {modelos.length}</span>
        {isAdmin && modelos.length > 0 && (todos
          ? <button onClick={() => cancelarTodos.current?.abort()} className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-bold cursor-pointer shrink-0" data-testid="modelos-projudi-parar">Parar ({todos.feitos}/{todos.total})</button>
          : <button onClick={atualizarTodos} className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0" data-testid="modelos-projudi-atualizar-todos" title="A extensão relê no Projudi cada modelo desta lista"><DownloadCloud className="w-3.5 h-3.5" /> Atualizar todos pelo Projudi</button>)}
      </div>
      {isAdmin && <div className="text-[11px] text-slate-500">Para atualizar, deixe o Projudi aberto e logado em uma aba e <b>não o use</b> enquanto a extensão lê os modelos (alguns segundos por modelo). Modelos apagados ou renomeados no Projudi aparecem com aviso e <b>não</b> são apagados daqui.</div>}
      {erro && <div className="text-xs text-red-700 bg-red-50 rounded p-2" data-testid="modelos-projudi-erro">{erro}</div>}
      {carregando && <div className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…</div>}
      {!carregando && modelos.length === 0 && !erro && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded p-3" data-testid="modelos-projudi-vazio">Ainda não há modelos do Projudi neste gabinete. Na extensão: ícone <b>Conclusões Projudi</b> → <b>Abrir painel completo</b> → <b>Modelos do Projudi</b>; liste, capture e use <b>“Enviar ao Studio”</b>.</div>
      )}
      {grupos.map(([tipo, lista]) => (
        <div key={tipo} className="space-y-1.5">
          <div className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{tipo} <span className="text-slate-400 font-bold">({lista.length})</span></div>
          {lista.map((m) => {
            const aberto = abertos.includes(m.id);
            return (
              <div key={m.id} className="border border-slate-200 rounded-lg bg-white" data-testid="modelos-projudi-item">
                <div className="flex items-start gap-2 p-2">
                  <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-800 break-words">{m.nome}</div><div className="text-[11px] text-slate-500 break-words">{m.serventia || "sem serventia"} · {m.texto.length.toLocaleString("pt-BR")} caracteres · atualizado {quando(m.atualizadoEm)}</div></div>
                  <button onClick={() => setAbertos((a) => aberto ? a.filter((x) => x !== m.id) : [...a, m.id])} className="px-2 py-1 rounded border border-slate-300 text-[11px] font-bold cursor-pointer flex items-center gap-1 hover:bg-slate-50" data-testid="modelos-projudi-ver">{aberto ? <><EyeOff className="w-3 h-3" /> Ocultar</> : <><Eye className="w-3 h-3" /> Ver texto</>}</button>
                  {isAdmin && <button onClick={() => atualizarUmComAviso(m)} disabled={estado[m.id] === "lendo"} className="px-2 py-1 rounded border border-indigo-300 text-indigo-800 text-[11px] font-bold cursor-pointer flex items-center gap-1 hover:bg-indigo-50 disabled:opacity-50" data-testid="modelos-projudi-atualizar" title="A extensão relê este modelo no Projudi">{estado[m.id] === "lendo" ? <><Loader2 className="w-3 h-3 animate-spin" /> Lendo…</> : <><DownloadCloud className="w-3 h-3" /> Atualizar pelo Projudi</>}</button>}
                  <button onClick={() => copiar(m)} className="px-2 py-1 rounded border border-slate-300 text-[11px] font-bold cursor-pointer flex items-center gap-1 hover:bg-slate-50"><Copy className="w-3 h-3" /> {copiado === m.id ? "Copiado" : "Copiar"}</button>
                  {apagando === m.id
                    ? <span className="flex items-center gap-1"><button onClick={() => apagar(m.id)} className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold cursor-pointer" data-testid="modelos-projudi-confirmar">Apagar mesmo</button><button onClick={() => setApagando(null)} className="px-2 py-1 rounded border border-slate-300 text-[11px] font-bold cursor-pointer">Não</button></span>
                    : <button onClick={() => setApagando(m.id)} className="px-2 py-1 rounded border border-red-300 text-red-700 text-[11px] font-bold cursor-pointer flex items-center gap-1 hover:bg-red-50" data-testid="modelos-projudi-apagar"><Trash2 className="w-3 h-3" /> Apagar</button>}
                </div>
                {estado[m.id] && estado[m.id] !== "lendo" && (() => { const r = estado[m.id] as ResultadoAtualizacao; return <div className={`px-2 pb-2 text-[11px] ${r.estado === "erro" ? "text-red-700" : "text-emerald-700"}`} data-testid="modelos-projudi-estado">{r.estado === "erro" ? `✖ ${r.erro}` : TEXTO_ESTADO[r.estado]}</div>; })()}
                {aberto && <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug bg-slate-50 border-t border-slate-200 p-2 max-h-72 overflow-y-auto" data-testid="modelos-projudi-texto">{m.texto}</pre>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
