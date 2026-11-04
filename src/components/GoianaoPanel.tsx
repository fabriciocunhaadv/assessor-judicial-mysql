import React, { useEffect, useMemo, useState } from "react";
import { X, Trophy, RefreshCw, Info, Target, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { getApiHeaders } from "../utils/apiKeyManager";
import { ROTULO_CATEGORIA, type ResumoGoianao } from "../utils/goianao";
import { calcular21, MAXIMO_21, VALORES_VAZIOS, type Criterio, type Valores21 } from "../utils/goianao21";

/** Prêmio TJGO de Produtividade 2027 (Goianão), Edital 01/2026 — AGRUPAMENTO 21 (Vara Única I). Estimativa de pontos pelas fórmulas do edital + produção registrada pelo Studio. NÃO é a pontuação oficial. */
const CHAVE = (u: string) => `goianao21_valores_${u}`;
const REF_2026: Record<string, string> = { meta1: "21,34", iad: "26,00", hom: "0,00" };      // pontos da unidade na edição 2026 (Classificação Parcial, dados até 31/07/2026)

const Campo: React.FC<{ rotulo: string; valor: string; onChange: (v: string) => void; sufixo?: string; testId?: string }> = ({ rotulo, valor, onChange, sufixo, testId }) => (
  <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 min-w-0 flex-1">
    {rotulo}
    <span className="flex items-center gap-1">
      <input data-testid={testId} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
      {sufixo && <span className="text-[10px] text-slate-400">{sufixo}</span>}
    </span>
  </label>
);

const Cartao: React.FC<{ c: Criterio; id: string; children?: React.ReactNode }> = ({ c, id, children }) => {
  const p = c.pontos, cheio = p !== null && p >= c.max, cor = p === null ? "slate" : cheio ? "emerald" : p > 0 ? "amber" : "rose";
  const faixa: Record<string, string> = { slate: "bg-slate-300", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  const selo: Record<string, string> = { slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", emerald: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", rose: "bg-rose-100 text-rose-800" };
  return (
    <div data-testid={`goianao-${id}`} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 flex flex-col gap-2 shadow-2xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item {c.item} do edital</div>
          <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-100 leading-snug">{c.titulo}</h4>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-black ${selo[cor]}`} data-testid={`goianao-${id}-pontos`}>{p === null ? "—" : p.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / {c.max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${faixa[cor]}`} style={{ width: `${p === null ? 0 : Math.min(100, (p / c.max) * 100)}%` }} /></div>
      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{c.resumo}</p>
      {c.falta && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 leading-snug flex gap-1"><Target className="w-3 h-3 mt-0.5 shrink-0" />{c.falta}</p>}
      {children}
      {REF_2026[id] && <p className="text-[10px] text-slate-400">Em 2026 (edição anterior): {REF_2026[id]} pontos.</p>}
    </div>
  );
};

export const GoianaoPanel: React.FC<{ isOpen: boolean; onClose: () => void; unitId: string }> = ({ isOpen, onClose, unitId }) => {
  const [r, setR] = useState<(ResumoGoianao & { ok?: boolean }) | null>(null);
  const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(false);
  const [v, setV] = useState<Valores21>(VALORES_VAZIOS);
  const [detalhes, setDetalhes] = useState(false);
  const unidade = unitId || "montes_claros";
  useEffect(() => { try { const s = localStorage.getItem(CHAVE(unidade)); setV(s ? { ...VALORES_VAZIOS, ...JSON.parse(s) } : VALORES_VAZIOS); } catch { setV(VALORES_VAZIOS); } }, [unidade]);
  const mudar = (p: Partial<Valores21>) => setV((a) => { const n = { ...a, ...p }; try { localStorage.setItem(CHAVE(unidade), JSON.stringify(n)); } catch { /* sem armazenamento */ } return n; });
  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const resp = await fetch(`/api/db/history/goianao/resumo?unit=${encodeURIComponent(unidade)}`, { headers: getApiHeaders() });
      const j = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(j.erro || `erro ${resp.status}`); setR(j);
    } catch (e: any) { setErro(e?.message || "não consegui carregar"); } finally { setCarregando(false); }
  };
  useEffect(() => { if (isOpen) void carregar(); }, [isOpen, unidade]);
  const calc = useMemo(() => calcular21(v, { homologatorias: r?.processosHomologatorios ?? 0, julgamentos: r?.processosComJulgamento ?? 0 }), [v, r]);
  if (!isOpen) return null;
  const c = (id: string) => calc.criterios.find((x) => x.id === id)!;
  const data = (t: number) => new Date(t).toLocaleDateString("pt-BR");
  const linhas = (o: Record<string, number>, rot?: (k: string) => string) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
    <div key={k} className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800 text-xs"><span>{rot ? rot(k) : k}</span><strong>{n}</strong></div>));
  const pctBarra = Math.min(100, (calc.total / MAXIMO_21) * 100);
  return (
    <div className="fixed inset-0 z-[100000] flex items-start sm:items-center justify-center p-3 bg-black/60 overflow-y-auto" data-testid="goianao-painel">
      <div className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl p-4 sm:p-5 my-2 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500 shrink-0" /> Prêmio TJGO de Produtividade 2027 (Goianão)</h2>
            <p className="text-[11px] text-slate-500">Agrupamento 21 · Vara Única I · Período avaliado: {data(r?.periodo.inicio ?? Date.parse("2026-08-01T12:00:00-03:00"))} a {data(r?.periodo.fim ?? Date.parse("2027-07-31T12:00:00-03:00"))} · Edital 01/2026</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => void carregar()} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" title="Atualizar"><RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} /></button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" title="Fechar" data-testid="goianao-fechar"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-[11px] leading-snug flex gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Estimativa feita com as fórmulas do edital e com os números que você digita (copie do painel “Desempenho da Unidade” do Gestão à Vista). <strong>A pontuação oficial é a do DataJud, no painel do TJGO.</strong> Só entram na soma os critérios que você preencheu; o que o Studio sabe (sentenças homologatórias) vem sozinho. Os valores ficam salvos neste navegador.</span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-2" data-testid="goianao-resumo">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimativa de pontos</div>
              <div className="text-3xl font-black leading-none" data-testid="goianao-total">{calc.total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}<span className="text-sm font-bold text-slate-400"> / {MAXIMO_21}</span></div></div>
            <div className="text-right text-[11px] text-slate-500"><div><strong className="text-slate-800 dark:text-slate-100">{calc.percentual.toLocaleString("pt-BR")}%</strong> do máximo do grupo</div><div>Selo Diamante: {Math.ceil(calc.diamante)} pontos (95%) — faltam <strong data-testid="goianao-falta-diamante">{calc.faltaDiamante.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong></div></div>
          </div>
          <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${pctBarra}%` }} /><div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: "95%" }} title="Selo Diamante (95%)" /></div>
          <p className="text-[10px] text-slate-400">Máximo do grupo 21: 310 pontos (50 + 50 + 50 + 50 + 50 + 20 + 20 + 20). O Bônus Verde (até 20) é extra e entra na soma, mas não no máximo.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Cartao c={c("meta1")} id="meta1"><div className="flex gap-2 items-end"><Campo rotulo="Casos novos (conhecimento)" valor={v.meta1Novos} onChange={(x) => mudar({ meta1Novos: x })} testId="in-meta1-novos" /><Campo rotulo="Processos julgados" valor={v.meta1Julgados} onChange={(x) => mudar({ meta1Julgados: x })} testId="in-meta1-julgados" /></div></Cartao>
          <Cartao c={c("iad")} id="iad"><div className="flex gap-2 items-end"><Campo rotulo="Casos novos (conhecimento + execução)" valor={v.iadNovos} onChange={(x) => mudar({ iadNovos: x })} testId="in-iad-novos" /><Campo rotulo="Processos baixados" valor={v.iadBaixados} onChange={(x) => mudar({ iadBaixados: x })} testId="in-iad-baixados" /></div></Cartao>
          <Cartao c={c("antigos")} id="antigos"><div className="flex gap-2 items-end"><Campo rotulo="Pendentes líquidos distribuídos até 31/07/2021" valor={v.antigosPendentes} onChange={(x) => mudar({ antigosPendentes: x })} /><Campo rotulo="Já julgados ou baixados" valor={v.antigosJulgados} onChange={(x) => mudar({ antigosJulgados: x })} /></div></Cartao>
          <Cartao c={c("tempo")} id="tempo"><div className="flex gap-1.5 flex-wrap">{(["1", "2", "3"] as const).map((q) => (
            <button key={q} onClick={() => mudar({ quadrante: v.quadrante === q ? "" : q })} data-testid={`in-quadrante-${q}`} className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${v.quadrante === q ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600"}`}>{q}º quadrante{q === "1" ? " (melhor)" : ""}</button>))}</div></Cartao>
          <Cartao c={c("polo")} id="polo"><div className="flex gap-2 items-end"><Campo rotulo="Polo ativo com CPF/CNPJ válido" valor={v.poloAtivo} onChange={(x) => mudar({ poloAtivo: x })} sufixo="%" /><Campo rotulo="Polo passivo com CPF/CNPJ válido" valor={v.poloPassivo} onChange={(x) => mudar({ poloPassivo: x })} sufixo="%" /></div></Cartao>
          <Cartao c={c("hom")} id="hom">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2 py-1.5 text-[11px] flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /><span>O Studio já conta sozinho: <strong>{r?.processosHomologatorios ?? 0}</strong> processo(s) com sentença homologatória de acordo, de <strong>{r?.processosComJulgamento ?? 0}</strong> com julgamento no período (Studio e Agaia; só o 1º julgamento de cada processo; criminais ficam de fora).</span></div>
            <details className="text-[10px] text-slate-500"><summary className="cursor-pointer font-semibold">Usar os números do DataJud em vez dos do Studio</summary>
              <div className="flex gap-2 mt-1.5"><Campo rotulo="Sentenças homologatórias" valor={v.homNum} onChange={(x) => mudar({ homNum: x })} /><Campo rotulo="Sentenças terminativas (total)" valor={v.homDen} onChange={(x) => mudar({ homDen: x })} /></div></details>
          </Cartao>
          <Cartao c={c("peticao")} id="peticao"><div className="flex gap-2 items-end"><Campo rotulo="Média de dias até o 1º movimento do magistrado" valor={v.peticaoDias} onChange={(x) => mudar({ peticaoDias: x })} sufixo="dias" testId="in-peticao" /></div><p className="text-[10px] text-slate-400">Vale de 01/12/2026 a 31/07/2027 (só processos cíveis de conhecimento). Copie a média do painel de Desempenho.</p></Cartao>
          <Cartao c={c("reuniao")} id="reuniao"><div className="flex flex-col gap-1">
            {([["reuniao1", "1ª reunião: 01/12/2026 a 28/02/2027"], ["reuniao2", "2ª reunião: 01/03/2027 a 31/05/2027"]] as const).map(([k, rot]) => (
              <label key={k} className="flex items-center gap-2 text-[11px] cursor-pointer"><input type="checkbox" checked={v[k]} onChange={(e) => mudar({ [k]: e.target.checked } as any)} data-testid={`in-${k}`} />{rot} — ata juntada no PROAD</label>))}</div></Cartao>
        </div>

        <Cartao c={calc.bonus} id="verde"><div className="flex gap-2 items-end"><Campo rotulo="Redução do parque de impressão (em 19/12/2026)" valor={v.reducaoImpressoras} onChange={(x) => mudar({ reducaoImpressoras: x })} sufixo="%" /></div><p className="text-[10px] text-slate-400">De 15% a 25%: 10 pontos; acima de 25%: 20. Exige PROAD “Goianão - Devolução de Impressoras - Bônus Verde” até 30/11/2026.</p></Cartao>

        {erro && <p className="text-xs text-red-600" data-testid="goianao-erro">Não consegui carregar os dados do Studio: {erro}</p>}
        {r && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <button onClick={() => setDetalhes((d) => !d)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-black cursor-pointer" data-testid="goianao-detalhes-botao">
              <span>Produção registrada pelo Studio no período ({r.totalAtos} ato(s), {r.lancados} lançado(s) no Projudi)</span>{detalhes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {detalhes && (
              <div className="px-4 pb-4 grid sm:grid-cols-2 gap-4" data-testid="goianao-detalhes">
                <div><h3 className="text-xs font-black mb-1">Por origem</h3>{linhas(r.porOrigem)}</div>
                <div><h3 className="text-xs font-black mb-1">Por tipo de ato</h3>{linhas(r.porTipo, (k) => ({ sentenca: "Sentença", decisao: "Decisão", despacho: "Despacho", outro: "Outro" } as any)[k] || k)}</div>
                <div><h3 className="text-xs font-black mb-1">Pelo Anexo III do edital</h3>{linhas(r.porCategoria, (k) => (ROTULO_CATEGORIA as any)[k] || k)}</div>
                <div><h3 className="text-xs font-black mb-1">Por mês (atos / julgamentos)</h3>{Object.entries(r.porMes).sort().map(([m, x]) => <div key={m} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-xs"><span>{m}</span><strong>{x.atos} / {x.julgamentos}</strong></div>)}</div>
                {r.julgamentosEstimados > 0 && <p className="sm:col-span-2 text-[10px] text-slate-500">{r.julgamentosEstimados} julgamento(s) foram estimados pelo texto do dispositivo (o movimento TPU não estava gravado).</p>}
                {r.semClassificacao.length > 0 && (
                  <div className="sm:col-span-2" data-testid="goianao-sem-classificacao"><h3 className="text-xs font-black mb-1">Sentenças sem movimento identificado ({r.semClassificacao.length}): confira o movimento no Projudi</h3>
                    <div className="max-h-32 overflow-y-auto text-[11px] space-y-0.5">{r.semClassificacao.map((x, i) => <div key={i}>{x.processo || "(sem número)"} · {x.origem} · {x.titulo}</div>)}</div></div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
