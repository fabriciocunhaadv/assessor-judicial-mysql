import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Loader2, Download, Search } from "lucide-react";

interface Uso { n: number; tokens: number; custo: number }
interface Linha {
  email: string; nome: string; tenant: string; papel: string; status: string; peticao360Liberada: boolean; chaveNativaLiberada: boolean;
  modulos: Record<string, Uso>; execucoes: number; tokens: number; custo: number; chaveNativa: number; minutasSalvas: number; excluidasManual?: number; excluidasRetencao?: number; lancadas?: number; mudancasUnidade?: number; mudancasGabinete?: number; peticoes360: number; ultimoUso: number; extensao: Record<string, number>; extensaoTotal: number;
}
interface Resposta {
  periodo: { de: number; ate: number }; geradoEm: number; avisos?: string[];
  totais: { extensao: number; usuariosAtivos: number; usuariosCadastrados: number; execucoes: number; tokens: number; custo: number; minutasSalvas: number; excluidasManual?: number; excluidasRetencao?: number; exclusoesDesde?: number; geradasExcluidas?: number; lancadas?: number; mudancasUnidade?: number; mudancasGabinete?: number; outrosPorRotulo?: { rotulo: string; n: number }[]; peticoes360: number; porModulo: Record<string, Uso>; semDono: number };
  usuarios: Linha[];
  liberados: { id: string; nome: string; unidade: string; pessoas: { email: string; nome: string; usos: number; ultimoUso: number }[] }[];
}

const MODULOS: [string, string][] = [["minuta", "Minutas"], ["turbo", "Turbo"], ["lupa_magistrado", "Lupa"], ["audiencia", "Mesa de Audiência"], ["copiloto", "Copiloto"], ["chat_refino", "Chat/Refino"], ["modelos", "Modelos"], ["gigante", "Gigante"], ["apoio", "Apoio (mapa/OCR)"], ["ia_externa", "IA externa/Agaia"], ["sentenca_video", "Sentença c/ vídeo"], ["outros", "Outros"]];
const ROTULOS_EXT: Record<string, string> = { esteira_analise: "Esteira: análise", esteira_turbo: "Esteira: Turbo", esteira_lupa: "Esteira: Lupa", esteira_mesa: "Esteira: Mesa", esteira_ia: "Esteira: IA externa", esteira_agaia: "Esteira: Agaia", esteira_video: "Esteira: sentença com vídeo", esteira_outro: "Esteira: outros", ocr_processo: "OCR de processos", pdf_para_texto: "PDF para texto", pdf_studio: "PDF tratado para o Studio", baixar_arquivos: "Baixar arquivos (aberturas)" };
const num = (n: number) => n.toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = () => new Date();
const campo = "bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100";
const th = "px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap";
const td = "px-2 py-1.5 text-xs text-slate-200 whitespace-nowrap";

/** Super Admin: utilização do sistema por pessoa e por módulo no período, e uso dos módulos liberados. */
export function UtilizacaoPanel() {
  const [de, setDe] = useState(() => { const d = hoje(); d.setDate(1); return iso(d); });
  const [ate, setAte] = useState(() => iso(hoje()));
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [soAtivos, setSoAtivos] = useState(true);
  const [tipoDet, setTipoDet] = useState<"excluidas" | "lancada" | "unidade" | "gabinete">("excluidas");
  const [det, setDet] = useState<{ quando: number; gabinete: string; processo: string; titulo?: string; dono: string; quemFez: string; detalhe: string }[] | null>(null);
  const [carregandoDet, setCarregandoDet] = useState(false);
  const [erroDet, setErroDet] = useState("");

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const r = await fetch(`/api/utilizacao?de=${de}&ate=${ate}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
      setDados(j);
    } catch (e: any) { setErro(e?.message || "falha ao carregar"); } finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const carregarDetalhe = async (t = tipoDet) => {
    setCarregandoDet(true); setErroDet(""); setTipoDet(t);
    try {
      const r = await fetch(`/api/utilizacao/detalhe?tipo=${t}&de=${de}&ate=${ate}${busca.includes("@") ? `&email=${encodeURIComponent(busca.trim())}` : ""}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
      setDet(j.linhas || []);
    } catch (e: any) { setErroDet(e?.message || "falha ao listar"); setDet(null); } finally { setCarregandoDet(false); }
  };
  const atalho = (dias: number | "mes") => { const f = hoje(), i = hoje(); if (dias === "mes") i.setDate(1); else i.setDate(i.getDate() - dias + 1); setDe(iso(i)); setAte(iso(f)); };
  const visiveis = useMemo(() => (dados?.usuarios || []).filter((l) => (!soAtivos || l.execucoes + l.peticoes360 + l.minutasSalvas + (l.excluidasManual || 0) + (l.excluidasRetencao || 0) + (l.lancadas || 0) + (l.mudancasUnidade || 0) + (l.mudancasGabinete || 0) + l.extensaoTotal > 0) && (!busca.trim() || `${l.nome} ${l.email} ${l.tenant}`.toLowerCase().includes(busca.trim().toLowerCase()))), [dados, busca, soAtivos]);

  const exportar = () => {
    if (!dados) return;
    const cab = ["Nome", "E-mail", "Gabinete", "Execuções de IA", ...MODULOS.map(([, r]) => r), "Uso da extensão", "Minutas salvas", "Excluídas (por pessoa)", "Excluídas (prazo do Histórico)", "Lançadas no Projudi", "Mudanças de unidade", "Mudanças de gabinete", "Petições 360°", "Tokens", "Custo estimado (R$)", "Último uso"];
    const aspas = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = visiveis.map((l) => [l.nome, l.email, l.tenant, l.execucoes, ...MODULOS.map(([m]) => l.modulos[m]?.n || 0), l.extensaoTotal, l.minutasSalvas, l.excluidasManual || 0, l.excluidasRetencao || 0, l.lancadas || 0, l.mudancasUnidade || 0, l.mudancasGabinete || 0, l.peticoes360, l.tokens, l.custo.toFixed(2).replace(".", ","), quando(l.ultimoUso)]);
    const csv = "﻿" + [cab, ...linhas].map((r) => r.map(aspas).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `utilizacao_${de}_a_${ate}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5" data-testid="painel-utilizacao">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-amber-400" /><h2 className="text-base font-black text-white">Utilização do sistema</h2></div>
        <p className="text-xs text-slate-300 leading-relaxed">Quanto cada pessoa usou no período: execuções de IA por módulo, minutas salvas no Histórico e petições 360°, com tokens e custo estimado. Só leitura. As execuções de IA vêm do registro de consumo; quem não deixou registro (por exemplo, usou antes do registro existir) não aparece nelas.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase">De <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={`${campo} block mt-0.5`} /></label>
          <label className="text-[10px] text-slate-400 font-bold uppercase">Até <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={`${campo} block mt-0.5`} /></label>
          <button onClick={() => atalho("mes")} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold cursor-pointer">Este mês</button>
          <button onClick={() => atalho(7)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold cursor-pointer">7 dias</button>
          <button onClick={() => atalho(30)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold cursor-pointer">30 dias</button>
          <button onClick={() => void carregar()} disabled={carregando} className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Calcular</button>
          <button onClick={exportar} disabled={!dados} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Exportar CSV</button>
        </div>
        {erro && <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded-lg p-2">{erro}</p>}
      </div>

      {dados && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
            {[["Pessoas que usaram", `${num(dados.totais.usuariosAtivos)} de ${num(dados.totais.usuariosCadastrados)}`], ["Ações na extensão", num(dados.totais.extensao || 0)], ["Execuções de IA", num(dados.totais.execucoes)], ["Minutas salvas (no Histórico)", num(dados.totais.minutasSalvas)], ["Minutas excluídas", `${num((dados.totais.excluidasManual || 0) + (dados.totais.excluidasRetencao || 0))} (${num(dados.totais.excluidasManual || 0)} manual · ${num(dados.totais.excluidasRetencao || 0)} prazo)`], ["Lançadas no Projudi", num(dados.totais.lancadas || 0)], ["Mudanças de unidade / gabinete", `${num(dados.totais.mudancasUnidade || 0)} / ${num(dados.totais.mudancasGabinete || 0)}`], ["Petições 360°", num(dados.totais.peticoes360)], ["Tokens / custo", `${num(dados.totais.tokens)} · ${brl(dados.totais.custo)}`]].map(([t, v]) => (
              <div key={t} className="bg-slate-900 border border-slate-800 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-slate-400">{t}</div><div className="text-sm font-black text-white mt-0.5">{v}</div></div>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 space-y-1" data-testid="nota-utilizacao">
            <div><b className="text-slate-200">Como ler:</b> “Execuções de IA” contam quando a análise roda e continuam contadas mesmo que a minuta seja apagada depois. “Minutas salvas” são só as que <b>ainda estão no Histórico</b>. Por isso o número de execuções costuma ser maior que o de minutas que você vê no Histórico da pessoa: as outras foram excluídas (manualmente ou pelo prazo de guarda do Histórico) ou eram execuções de apoio (mapa do processo, OCR), que não geram minuta.</div>
            <div>{dados.totais.exclusoesDesde ? <>As exclusões estão sendo registradas desde <b className="text-slate-200">{quando(dados.totais.exclusoesDesde)}</b>; antes disso não há registro de quem apagou.</> : <>Ainda não há exclusão registrada (o registro começou com a última atualização do sistema).</>}{dados.totais.geradasExcluidas ? <> · Neste período, {num(dados.totais.geradasExcluidas)} minuta(s) geradas já foram excluídas.</> : null}</div>
            {dados.totais.outrosPorRotulo && dados.totais.outrosPorRotulo.length > 0 && <div data-testid="outros-por-rotulo"><b className="text-slate-200">O que há em “Outros”:</b> {dados.totais.outrosPorRotulo.map((o) => `${o.rotulo} (${num(o.n)})`).join(" · ")}</div>}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Execuções de IA por módulo</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-200">{MODULOS.map(([m, r]) => <span key={m}>{r}: <strong className="text-white">{num(dados.totais.porModulo[m]?.n || 0)}</strong></span>)}</div>
            {!!dados.avisos?.length && <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/40 rounded-lg p-2 mt-1.5">Parte dos dados não pôde ser lida (o restante está correto): {dados.avisos.join(" · ")}</p>}
            {dados.totais.semDono > 0 && <p className="text-[10px] text-slate-500 mt-1.5">{num(dados.totais.semDono)} registro(s) sem e-mail identificável ficaram fora da conta por pessoa.</p>}
          </div>

          {dados.liberados.map((m) => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5" data-testid={`liberados-${m.id}`}>
              <div className="text-xs font-black text-white">Módulo liberado: {m.nome} <span className="text-slate-400 font-normal">({m.pessoas.length} pessoa(s) com acesso; {num(m.pessoas.filter((p) => p.usos > 0).length)} usaram no período)</span></div>
              {m.pessoas.length === 0 ? <p className="text-[11px] text-slate-500">Ninguém liberado.</p> : (
                <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>Pessoa</th><th className={th}>E-mail</th><th className={th}>Uso no período ({m.unidade})</th></tr></thead>
                  <tbody>{[...m.pessoas].sort((a, b) => b.usos - a.usos).map((p) => <tr key={p.email} className="border-t border-slate-800"><td className={td}>{p.nome}</td><td className={td}>{p.email}</td><td className={`${td} ${p.usos ? "text-emerald-300 font-bold" : "text-slate-500"}`}>{num(p.usos)}</td></tr>)}</tbody></table></div>
              )}
            </div>
          ))}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]"><Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou gabinete" className={`${campo} w-full pl-7`} /></div>
              <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> só quem usou no período</label>
              <span className="text-[11px] text-slate-500">{num(visiveis.length)} pessoa(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Pessoa</th><th className={th}>Gabinete</th><th className={th}>Execuções IA</th>{MODULOS.map(([m, r]) => <th key={m} className={th}>{r}</th>)}<th className={th}>Uso da extensão</th><th className={th}>Minutas salvas</th><th className={th} title="Minutas apagadas do Histórico pela própria pessoa ou pelo administrador">Excluídas</th><th className={th} title="Minutas apagadas sozinhas quando venceu o prazo do Histórico">Venceram (prazo)</th><th className={th} title="Minutas marcadas como lançadas no Projudi">Lançadas</th><th className={th} title="Mudanças de unidade/comarca das minutas da pessoa">Mud. unidade</th><th className={th} title="Minutas movidas para outro gabinete">Mud. gabinete</th><th className={th}>Petições 360°</th><th className={th}>Tokens</th><th className={th}>Custo</th><th className={th}>Último uso</th></tr></thead>
                <tbody>
                  {visiveis.map((l) => (
                    <tr key={l.email} className="border-t border-slate-800" data-testid="linha-utilizacao">
                      <td className={td}><div className="font-bold text-white">{l.nome}</div><div className="text-[10px] text-slate-400">{l.email}{l.status === "fora do cadastro" ? " · fora do cadastro" : l.status !== "aprovado" ? ` · ${l.status}` : ""}</div></td>
                      <td className={td}>{l.tenant || "—"}</td>
                      <td className={`${td} font-bold text-amber-300`}>{num(l.execucoes)}</td>
                      {MODULOS.map(([m]) => <td key={m} className={td}>{l.modulos[m]?.n ? num(l.modulos[m].n) : "—"}</td>)}
                      <td className={td} title={Object.entries(l.extensao || {}).map(([k, n]) => `${ROTULOS_EXT[k] || k}: ${n}`).join("\n")} data-testid="uso-extensao">{l.extensaoTotal ? num(l.extensaoTotal) : "—"}</td>
                      <td className={td}>{l.minutasSalvas ? num(l.minutasSalvas) : "—"}</td>
                      <td className={td} data-testid="excluidas-manual">{l.excluidasManual ? num(l.excluidasManual) : "—"}</td>
                      <td className={td} data-testid="excluidas-prazo">{l.excluidasRetencao ? num(l.excluidasRetencao) : "—"}</td>
                      <td className={td} data-testid="lancadas">{l.lancadas ? num(l.lancadas) : "—"}</td>
                      <td className={td}>{l.mudancasUnidade ? num(l.mudancasUnidade) : "—"}</td>
                      <td className={td}>{l.mudancasGabinete ? num(l.mudancasGabinete) : "—"}</td>
                      <td className={td}>{l.peticoes360 ? num(l.peticoes360) : "—"}</td>
                      <td className={td}>{l.tokens ? num(l.tokens) : "—"}</td>
                      <td className={td}>{l.custo ? brl(l.custo) : "—"}</td>
                      <td className={td}>{quando(l.ultimoUso)}</td>
                    </tr>
                  ))}
                  {visiveis.length === 0 && <tr><td colSpan={13 + MODULOS.length} className="px-2 py-4 text-xs text-slate-500">Nenhuma pessoa com uso neste período.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 border-t border-slate-800 pt-3 space-y-2" data-testid="registro-operacoes">
              <div className="text-[11px] font-black text-slate-200">Registro de operações (quem fez o quê, no período e na busca acima — digite um e-mail na busca para filtrar uma pessoa)</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([["excluidas", "Excluídas"], ["lancada", "Lançadas no Projudi"], ["unidade", "Mudanças de unidade"], ["gabinete", "Mudanças de gabinete"]] as const).map(([k, r]) => (
                  <button key={k} onClick={() => void carregarDetalhe(k)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${tipoDet === k && det ? "bg-amber-500 text-slate-900 border-amber-400" : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"}`} data-testid={`det-${k}`}>{r}</button>
                ))}
                {carregandoDet && <span className="text-[11px] text-slate-400">Carregando…</span>}
              </div>
              {erroDet && <div className="text-[11px] text-red-300">{erroDet}</div>}
              {det && (det.length === 0
                ? <div className="text-[11px] text-slate-400" data-testid="det-vazio">Nada registrado neste período.{tipoDet === "excluidas" && dados.totais.exclusoesDesde ? "" : tipoDet === "excluidas" ? " (O registro de exclusões começou com a última atualização do sistema.)" : ""}</div>
                : <div className="overflow-x-auto max-h-80 overflow-y-auto"><table className="w-full" data-testid="det-tabela">
                    <thead><tr><th className={th}>Quando</th><th className={th}>Processo</th><th className={th}>Dono da minuta</th><th className={th}>Quem fez</th><th className={th}>Gabinete</th><th className={th}>Detalhe</th></tr></thead>
                    <tbody>{det.map((l, i) => <tr key={i} className="border-t border-slate-800"><td className={td}>{quando(l.quando)}</td><td className={td}>{l.processo || "—"}</td><td className={td}>{l.dono || "—"}</td><td className={td}>{l.quemFez || "—"}</td><td className={td}>{l.gabinete}</td><td className={td}>{l.detalhe || "—"}</td></tr>)}</tbody>
                  </table></div>)}
              {det && det.length >= 500 && <div className="text-[10px] text-slate-500">Mostrando as 500 mais recentes. Reduza o período para ver as demais.</div>}
            </div>
            <p className="text-[10px] text-slate-500">Custo estimado pela tabela de preços do sistema (não é a fatura do Google). Atualizado em {quando(dados.geradoEm)}.</p>
          </div>
        </>
      )}
    </div>
  );
}
