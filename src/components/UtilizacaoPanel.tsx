import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Loader2, Download, Search } from "lucide-react";

interface Uso { n: number; tokens: number; custo: number }
interface Linha {
  email: string; nome: string; tenant: string; papel: string; status: string; peticao360Liberada: boolean; chaveNativaLiberada: boolean;
  modulos: Record<string, Uso>; execucoes: number; tokens: number; custo: number; chaveNativa: number; minutasSalvas: number; peticoes360: number; ultimoUso: number;
}
interface Resposta {
  periodo: { de: number; ate: number }; geradoEm: number; avisos?: string[];
  totais: { usuariosAtivos: number; usuariosCadastrados: number; execucoes: number; tokens: number; custo: number; minutasSalvas: number; peticoes360: number; porModulo: Record<string, Uso>; semDono: number };
  usuarios: Linha[];
  liberados: { id: string; nome: string; unidade: string; pessoas: { email: string; nome: string; usos: number; ultimoUso: number }[] }[];
}

const MODULOS: [string, string][] = [["minuta", "Minutas"], ["turbo", "Turbo"], ["lupa_magistrado", "Lupa"], ["audiencia", "Mesa de Audiência"], ["copiloto", "Copiloto"], ["chat_refino", "Chat/Refino"], ["outros", "Outros"]];
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

  const atalho = (dias: number | "mes") => { const f = hoje(), i = hoje(); if (dias === "mes") i.setDate(1); else i.setDate(i.getDate() - dias + 1); setDe(iso(i)); setAte(iso(f)); };
  const visiveis = useMemo(() => (dados?.usuarios || []).filter((l) => (!soAtivos || l.execucoes + l.peticoes360 + l.minutasSalvas > 0) && (!busca.trim() || `${l.nome} ${l.email} ${l.tenant}`.toLowerCase().includes(busca.trim().toLowerCase()))), [dados, busca, soAtivos]);

  const exportar = () => {
    if (!dados) return;
    const cab = ["Nome", "E-mail", "Gabinete", "Execuções de IA", ...MODULOS.map(([, r]) => r), "Minutas salvas", "Petições 360°", "Tokens", "Custo estimado (R$)", "Último uso"];
    const aspas = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = visiveis.map((l) => [l.nome, l.email, l.tenant, l.execucoes, ...MODULOS.map(([m]) => l.modulos[m]?.n || 0), l.minutasSalvas, l.peticoes360, l.tokens, l.custo.toFixed(2).replace(".", ","), quando(l.ultimoUso)]);
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {[["Pessoas que usaram", `${num(dados.totais.usuariosAtivos)} de ${num(dados.totais.usuariosCadastrados)}`], ["Execuções de IA", num(dados.totais.execucoes)], ["Minutas salvas", num(dados.totais.minutasSalvas)], ["Petições 360°", num(dados.totais.peticoes360)], ["Tokens / custo", `${num(dados.totais.tokens)} · ${brl(dados.totais.custo)}`]].map(([t, v]) => (
              <div key={t} className="bg-slate-900 border border-slate-800 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-slate-400">{t}</div><div className="text-sm font-black text-white mt-0.5">{v}</div></div>
            ))}
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
                <thead><tr><th className={th}>Pessoa</th><th className={th}>Gabinete</th><th className={th}>Execuções IA</th>{MODULOS.map(([m, r]) => <th key={m} className={th}>{r}</th>)}<th className={th}>Minutas salvas</th><th className={th}>Petições 360°</th><th className={th}>Tokens</th><th className={th}>Custo</th><th className={th}>Último uso</th></tr></thead>
                <tbody>
                  {visiveis.map((l) => (
                    <tr key={l.email} className="border-t border-slate-800" data-testid="linha-utilizacao">
                      <td className={td}><div className="font-bold text-white">{l.nome}</div><div className="text-[10px] text-slate-400">{l.email}{l.status === "fora do cadastro" ? " · fora do cadastro" : l.status !== "aprovado" ? ` · ${l.status}` : ""}</div></td>
                      <td className={td}>{l.tenant || "—"}</td>
                      <td className={`${td} font-bold text-amber-300`}>{num(l.execucoes)}</td>
                      {MODULOS.map(([m]) => <td key={m} className={td}>{l.modulos[m]?.n ? num(l.modulos[m].n) : "—"}</td>)}
                      <td className={td}>{l.minutasSalvas ? num(l.minutasSalvas) : "—"}</td>
                      <td className={td}>{l.peticoes360 ? num(l.peticoes360) : "—"}</td>
                      <td className={td}>{l.tokens ? num(l.tokens) : "—"}</td>
                      <td className={td}>{l.custo ? brl(l.custo) : "—"}</td>
                      <td className={td}>{quando(l.ultimoUso)}</td>
                    </tr>
                  ))}
                  {visiveis.length === 0 && <tr><td colSpan={12 + MODULOS.length} className="px-2 py-4 text-xs text-slate-500">Nenhuma pessoa com uso neste período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500">Custo estimado pela tabela de preços do sistema (não é a fatura do Google). Atualizado em {quando(dados.geradoEm)}.</p>
          </div>
        </>
      )}
    </div>
  );
}
