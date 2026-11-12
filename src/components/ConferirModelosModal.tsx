// "Conferir com os modelos do Projudi": com a minuta pronta, o sistema acha os modelos cadastrados no Projudi que combinam com ela (citação por WhatsApp,
// cumprimento de sentença, comandos à escrivania…), compara e mostra o que a minuta não seguiu. Cada ajuste só entra se o usuário clicar em "Aplicar".
import React, { useEffect, useMemo, useState } from "react";
import { X, ClipboardCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { MinuteData } from "../types";
import { listarModelosProjudi, modelosParecidos, ModeloProjudi, MODELOS_PROJUDI_EVENTO } from "../utils/modelosProjudi";
import { getApiHeaders } from "../utils/apiKeyManager";

type Secao = "relatorio" | "fundamentacao" | "dispositivo" | "closing";
interface Item { titulo: string; gravidade: "alta" | "media" | "baixa"; noModelo: string; naMinuta: string; sugestao: { acao: "acrescentar" | "trocar"; secao: Secao; de: string; texto: string }; aplicavel: boolean }
interface Resultado { modeloId: string; aplica: boolean; motivo: string; itens: Item[] }
const NOME_SECAO: Record<Secao, string> = { relatorio: "Relatório", fundamentacao: "Fundamentação", dispositivo: "Dispositivo", closing: "Fecho" };
const textoCompleto = (m: MinuteData) => [m.header, m.title, m.relatorio && `I - RELATÓRIO\n${m.relatorio}`, m.fundamentacao && `II - FUNDAMENTAÇÃO\n${m.fundamentacao}`, m.dispositivo && `III - DISPOSITIVO\n${m.dispositivo}`, m.closing].filter(Boolean).join("\n\n");

interface Props { aberto: boolean; aoFechar: () => void; minuta: MinuteData; aoAplicar: (nova: MinuteData, resumo: string) => void }

/** Aplica um ajuste na minuta de trabalho (cópia). Devolve null se o trecho a trocar não existe mais. */
export function aplicarAjuste(m: MinuteData, it: Item): MinuteData | null {
  const { secao, acao, de, texto } = it.sugestao; const antes = String(m[secao] || "");
  let depois: string;
  if (acao === "trocar") { if (!de || antes.split(de).length !== 2) return null; depois = antes.replace(de, () => texto); }
  else depois = antes ? `${antes.replace(/\s+$/, "")}\n\n${texto}` : texto;
  const nova: MinuteData = { ...m, [secao]: depois };
  const cheio = String(m.fullFormattedText || "");
  nova.fullFormattedText = antes && cheio.includes(antes) ? cheio.replace(antes, () => depois) : textoCompleto(nova);
  return nova;
}

export const ConferirModelosModal: React.FC<Props> = ({ aberto, aoFechar, minuta, aoAplicar }) => {
  const [modelos, setModelos] = useState<ModeloProjudi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [trabalho, setTrabalho] = useState<MinuteData>(minuta);
  const [aplicados, setAplicados] = useState<string[]>([]);
  const [feitos, setFeitos] = useState<string[]>([]);      // descrições do que foi aplicado (vai para o histórico de versões)

  const carregar = () => { setCarregando(true); listarModelosProjudi().then(setModelos).catch(() => setModelos([])).finally(() => setCarregando(false)); };
  useEffect(() => { if (!aberto) return; carregar(); window.addEventListener(MODELOS_PROJUDI_EVENTO, carregar); return () => window.removeEventListener(MODELOS_PROJUDI_EVENTO, carregar); }, [aberto]);
  const parecidos = useMemo(() => modelosParecidos(minuta, modelos), [minuta, modelos]);
  useEffect(() => { if (aberto) { setResultados(null); setErro(""); setTrabalho(minuta); setAplicados([]); setFeitos([]); setMarcados(parecidos.map((x) => x.modelo.id)); } }, [aberto, minuta, parecidos]);
  if (!aberto) return null;

  const alternar = (id: string) => setMarcados((a) => a.includes(id) ? a.filter((x) => x !== id) : a.length >= 3 ? a : [...a, id]);
  const rodar = async () => {
    const escolhidos = modelos.filter((m) => marcados.includes(m.id)); if (!escolhidos.length) return;
    setRodando(true); setErro(""); setResultados(null); setAplicados([]); setFeitos([]); setTrabalho(minuta);
    try {
      const r = await fetch("/api/conferir-modelos", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ minute: minuta, modelos: escolhidos.map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo, texto: m.texto })) }) });
      const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { throw new Error("O servidor não devolveu a resposta (a conexão pode ter caído). Tente de novo."); }
      if (!r.ok || !j.success) throw new Error(j.error || "Não foi possível conferir com os modelos.");
      setResultados(j.resultados || []);
    } catch (e: any) { setErro(e?.message || String(e)); } finally { setRodando(false); }
  };
  const aplicar = (chave: string, it: Item) => {
    const nova = aplicarAjuste(trabalho, it);
    if (!nova) { setErro("Esse trecho da minuta mudou e a troca não pôde ser feita. Aplique à mão."); return; }
    setErro(""); setTrabalho(nova); setAplicados((a) => [...a, chave]); setFeitos((f) => [...f, it.titulo]);
  };
  const aceitar = () => { aoAplicar(trabalho, feitos.join("; ")); aoFechar(); };
  const nomeDe = (id: string) => modelos.find((m) => m.id === id)?.nome || id;
  const cor = { alta: "bg-red-100 text-red-800", media: "bg-amber-100 text-amber-900", baixa: "bg-slate-100 text-slate-700" } as const;

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-900/60 flex items-center justify-center p-3" role="dialog" aria-modal="true" data-testid="conferir-modelos">
      <div className="bg-white text-slate-800 rounded-2xl shadow-2xl border border-indigo-300 w-[min(98vw,60rem)] max-h-[94vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-200 bg-indigo-50">
          <h3 className="text-sm font-black text-indigo-900 flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Conferir com os modelos do Projudi</h3>
          <button onClick={aoFechar} className="text-slate-500 hover:text-slate-800 cursor-pointer" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-600">O sistema compara esta minuta com os <strong>modelos que o juízo cadastrou no Projudi</strong> (fórmulas, comandos à escrivania, forma de citação…). <strong>Nada muda sozinho</strong>: você aplica cada ajuste que concordar.</p>
          {carregando && <div className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando seus modelos…</div>}
          {!carregando && modelos.length === 0 && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded p-3 space-y-1" data-testid="conferir-sem-modelos">
              <div className="font-bold">Ainda não há modelos do Projudi neste gabinete.</div>
              <div>Na extensão: clique no ícone <b>Conclusões Projudi</b> → <b>Abrir painel completo</b> → <b>Modelos do Projudi</b>, liste e capture os modelos e use <b>“Enviar ao Studio”</b>. Eles aparecem aqui sozinhos.</div>
            </div>
          )}
          {modelos.length > 0 && (
            <div className="space-y-1" data-testid="conferir-lista">
              <div className="text-[11px] font-bold text-slate-700">Modelos para conferir (até 3){parecidos.length ? " — os parecidos já vêm marcados:" : " — nenhum parece combinar com esta minuta; escolha se quiser:"}</div>
              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {[...modelos].sort((a, b) => (marcados.includes(b.id) ? 1 : 0) - (marcados.includes(a.id) ? 1 : 0)).map((m) => (
                  <label key={m.id} className="flex items-start gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={marcados.includes(m.id)} onChange={() => alternar(m.id)} className="mt-0.5" data-testid={`conferir-modelo-${m.projudiId}`} />
                    <span className="flex-1 min-w-0"><b>{m.nome}</b> <span className="text-slate-500">· {m.tipo}{m.serventia ? ` · ${m.serventia}` : ""}</span></span>
                    {parecidos.some((x) => x.modelo.id === m.id) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0">PARECIDO</span>}
                  </label>
                ))}
              </div>
              <button onClick={rodar} disabled={!marcados.length || rodando} className="mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center gap-2" data-testid="conferir-rodar">
                {rodando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo…</> : "Conferir"}
              </button>
            </div>
          )}
          {erro && <div className="text-xs text-red-700 bg-red-50 rounded p-2" data-testid="conferir-erro">{erro}</div>}
          {resultados && (
            <div className="space-y-3" data-testid="conferir-resultado">
              {resultados.length === 0 && <div className="text-xs text-slate-600 bg-slate-50 rounded p-2">A IA não devolveu conferência para os modelos escolhidos. Tente de novo.</div>}
              {resultados.map((r) => (
                <div key={r.modeloId} className="border border-slate-200 rounded-lg p-2 space-y-2">
                  <div className="text-xs font-black text-slate-800">{nomeDe(r.modeloId)}</div>
                  {!r.aplica && <div className="text-xs text-slate-600 bg-slate-50 rounded p-2">Este modelo não se aplica a esta minuta{r.motivo ? `: ${r.motivo}` : "."}</div>}
                  {r.aplica && r.itens.length === 0 && <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> A minuta já segue este modelo.</div>}
                  {r.aplica && r.itens.map((it, i) => {
                    const chave = `${r.modeloId}:${i}`, feito = aplicados.includes(chave);
                    return (
                      <div key={chave} className="text-xs border border-slate-200 rounded p-2 space-y-1" data-testid="conferir-item">
                        <div className="flex items-center gap-2"><span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${cor[it.gravidade]}`}>{it.gravidade.toUpperCase()}</span><b className="flex-1">{it.titulo}</b></div>
                        <div><span className="text-slate-500">O modelo manda:</span> {it.noModelo}</div>
                        <div><span className="text-slate-500">A minuta:</span> {it.naMinuta}</div>
                        {it.sugestao.texto && <div className="bg-indigo-50 border border-indigo-200 rounded p-1.5"><span className="text-[10px] font-bold text-indigo-800">{it.sugestao.acao === "trocar" ? `TROCAR em ${NOME_SECAO[it.sugestao.secao] || ""}` : `ACRESCENTAR ao fim de ${NOME_SECAO[it.sugestao.secao] || ""}`}</span>{it.sugestao.acao === "trocar" && <div className="line-through text-slate-500">{it.sugestao.de}</div>}<div className="whitespace-pre-wrap">{it.sugestao.texto}</div></div>}
                        {it.aplicavel
                          ? <button disabled={feito} onClick={() => aplicar(chave, it)} className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold cursor-pointer" data-testid="conferir-aplicar">{feito ? "✔ Aplicado" : "Aplicar"}</button>
                          : <div className="text-[11px] text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Ajuste manual: não dá para aplicar sozinho.</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex gap-2 justify-end">
                <button onClick={aoFechar} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer" data-testid="conferir-descartar">{feitos.length ? "Descartar tudo" : "Fechar"}</button>
                {feitos.length > 0 && <button onClick={aceitar} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer" data-testid="conferir-aceitar">Salvar a minuta com {feitos.length} ajuste(s)</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
