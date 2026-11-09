import React, { useCallback, useEffect, useState } from "react";
import { Gauge, RefreshCw, Loader2, Cpu, Building2, Puzzle, AlertTriangle } from "lucide-react";
import type { ResumoMotor, FichaGabinete, ResumoIA, UsuarioExt } from "../utils/calibragemRegras";

type Sub = "motores" | "gabinetes" | "extensao";
const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const seg = (ms: number) => (ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`);
const ROT_MODULO: Record<string, string> = { minuta: "Análise", turbo: "Turbo", copiloto: "Audiência", audiencia: "Audiência", lupa_magistrado: "Lupa", chat_refino: "Refino", outros: "Outros" };

function useRota<T>(url: string) {
  const [d, setD] = useState<T | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const r = await fetch(url), j = await r.json(); if (!r.ok) throw new Error(j?.erro || `HTTP ${r.status}`); setD(j); setErro(""); } catch (e: any) { setErro(String(e?.message || e)); } finally { setCarregando(false); }
  }, [url]);
  useEffect(() => { void carregar(); }, [carregar]);
  return { d, erro, carregando, carregar };
}
const Aviso = ({ children }: { children: React.ReactNode }) => <div className="text-xs text-amber-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{children}</span></div>;

function Motores() {
  const [dias, setDias] = useState(7);
  const { d, erro, carregando, carregar } = useRota<{ motores: ResumoMotor[]; avisos: string[]; observacao: string }>(`/api/central/motores?dias=${dias}`);
  return (
    <div className="space-y-3" data-testid="calib-motores">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-slate-400 flex-1 min-w-[220px]">Como cada motor está se comportando. Só mostra números: nenhum limite é alterado por aqui.</p>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5"><option value={1}>Hoje (24 h)</option><option value={7}>7 dias</option><option value={30}>30 dias</option></select>
        <button type="button" onClick={carregar} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
      </div>
      {erro && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2" data-testid="calib-erro">Não consegui carregar: {erro}</div>}
      {d?.avisos?.map((a) => <Aviso key={a}>{a}</Aviso>)}
      <div className="grid gap-3 md:grid-cols-2">
        {d?.motores.map((m) => {
          const max = Math.max(1, ...m.porDia.map((x) => x.n));
          return (
            <div key={m.id} className="border border-slate-700 rounded-xl bg-slate-800/40 p-3 space-y-2" data-testid="calib-motor">
              <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-sky-300" /><b className="text-sm text-white">{m.nome}</b><span className="ml-auto text-xs text-slate-400">{m.n} pedido(s)</span></div>
              {m.n === 0 && m.execucoesIA === 0 ? <p className="text-xs text-slate-500">Sem uso neste período.</p> : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className={`text-base font-black ${m.taxaErro > 0.1 ? "text-rose-300" : "text-white"}`}>{pct(m.taxaErro)}</div><div className="text-[10px] text-slate-400">erros</div></div>
                    <div><div className={`text-base font-black ${m.taxaCota > 0.15 ? "text-amber-300" : "text-white"}`}>{pct(m.taxaCota)}</div><div className="text-[10px] text-slate-400">cota/sobrecarga</div></div>
                    <div><div className="text-base font-black text-white">{m.n ? seg(m.mediaMs) : "—"}</div><div className="text-[10px] text-slate-400">tempo médio</div></div>
                  </div>
                  <div className="text-[11px] text-slate-400">Mais lento: {m.n ? seg(m.maxMs) : "—"} · autos: média {m.kbMedio} KB, maior {m.kbMax} KB · IA: {m.execucoesIA} execução(ões), {m.tokensMedios} tokens em média, R$ {m.custoTotal.toFixed(2)}{m.modelos.length ? ` · modelo: ${m.modelos.map((x) => `${x.modelo} (${x.n})`).join(", ")}` : ""}</div>
                  {m.porDia.length > 0 && <div className="flex items-end gap-0.5 h-8" title="Pedidos por dia (vermelho = erros)">{m.porDia.map((x) => <div key={x.dia} className="flex-1 bg-sky-500/60 rounded-sm relative" style={{ height: `${Math.max(8, (x.n / max) * 100)}%` }} title={`${x.dia}: ${x.n} pedido(s), ${x.erros} erro(s), ${x.cota} cota`}>{x.erros > 0 && <div className="absolute bottom-0 inset-x-0 bg-rose-500 rounded-sm" style={{ height: `${(x.erros / x.n) * 100}%` }} />}</div>)}</div>}
                  {m.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
                </>
              )}
            </div>
          );
        })}
      </div>
      {d?.observacao && <p className="text-[11px] text-slate-500">{d.observacao}</p>}
    </div>
  );
}

function Gabinetes() {
  const { d, erro, carregando, carregar } = useRota<{ gabinetes: FichaGabinete[]; avisos: string[] }>("/api/central/gabinetes");
  return (
    <div className="space-y-3" data-testid="calib-gabinetes">
      <div className="flex items-center gap-2"><p className="text-xs text-slate-400 flex-1">Ficha de cada gabinete (uso dos últimos 30 dias; minutas por semana nas últimas 4 semanas). Os que têm avisos aparecem primeiro.</p>
        <button type="button" onClick={carregar} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button></div>
      {erro && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2" data-testid="calib-erro">Não consegui carregar: {erro}</div>}
      {d?.avisos?.map((a) => <Aviso key={a}>{a}</Aviso>)}
      {d && !d.gabinetes.length && <p className="text-xs text-slate-400">Nenhum gabinete encontrado.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {d?.gabinetes.map((g) => (
          <div key={g.id} className="border border-slate-700 rounded-xl bg-slate-800/40 p-3 space-y-1.5" data-testid="calib-gabinete">
            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-300" /><b className="text-sm text-white break-words">{g.nome}</b></div>
            <div className="text-xs text-slate-300">{g.usuarios.total} usuário(s) · {g.usuarios.ativos30d} ativo(s) em 30 dias · {g.minutasSemana} minuta(s)/semana</div>
            <div className="text-xs text-slate-400">Última atividade: {quando(g.ultimaAtividade)} · Motores: {g.motores.length ? g.motores.map((m) => `${ROT_MODULO[m.modulo] || m.modulo} (${m.n})`).join(", ") : "—"}</div>
            <div className="text-xs text-slate-400">Chave nativa liberada para {g.chaves.nativaLiberada} · execuções: {g.chaves.execNativa} nativa, {g.chaves.execPropria} própria · erros em 7 dias: {g.erros7d}</div>
            {g.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Extensao() {
  const { d, erro, carregando, carregar } = useRota<{ versoes: { atual: string; usuarios: UsuarioExt[]; porVersao: { versao: string; usuarios: number }[] }; iaExterna: ResumoIA[]; erros: any[]; totalEventos: number }>("/api/central/extensao?dias=30");
  const NOME_IA: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", jusbrasil: "IA do Jusbrasil" };
  const atras = d?.versoes.usuarios.filter((u) => u.desatualizado) || [];
  return (
    <div className="space-y-4" data-testid="calib-extensao">
      <div className="flex items-center gap-2"><p className="text-xs text-slate-400 flex-1">O que a extensão informa (últimos 30 dias): a versão de cada usuário, os erros e o sucesso das IAs externas. A versão aparece quando a pessoa abre o Studio com a extensão instalada.</p>
        <button type="button" onClick={carregar} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5">{carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button></div>
      {erro && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2" data-testid="calib-erro">Não consegui carregar: {erro}</div>}
      {d && (
        <>
          <section className="border border-slate-700 rounded-xl bg-slate-800/40 p-3 space-y-2" data-testid="ext-versoes">
            <h4 className="text-sm font-black text-white">Versões {d.versoes.atual && <span className="text-slate-400 font-normal">(mais nova vista: {d.versoes.atual})</span>}</h4>
            {!d.versoes.usuarios.length ? <p className="text-xs text-slate-500">Nenhuma versão informada ainda. Elas aparecem depois que os usuários atualizarem a extensão para a versão que informa a presença.</p> : (
              <>
                <div className="flex gap-2 flex-wrap">{d.versoes.porVersao.map((v) => <span key={v.versao} className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">v{v.versao}: {v.usuarios} usuário(s)</span>)}</div>
                {atras.length > 0 && <Aviso>{atras.length} usuário(s) com versão antiga: {atras.map((u) => `${u.email} (v${u.versao})`).join(", ")}</Aviso>}
              </>
            )}
          </section>
          <section className="border border-slate-700 rounded-xl bg-slate-800/40 p-3 space-y-2" data-testid="ext-ia">
            <h4 className="text-sm font-black text-white flex items-center gap-2"><Puzzle className="w-4 h-4 text-violet-300" /> IAs externas (ChatGPT, Gemini, Claude, Jusbrasil)</h4>
            {!d.iaExterna.length ? <p className="text-xs text-slate-500">Nenhum uso informado ainda.</p> : <div className="grid gap-2 sm:grid-cols-2">{d.iaExterna.map((i) => (
              <div key={i.ia} className="border border-slate-700 rounded-lg p-2 bg-slate-900/60" data-testid="ext-ia-linha">
                <div className="flex items-center gap-2"><b className="text-sm text-white">{NOME_IA[i.ia] || i.ia}</b><span className={`ml-auto text-sm font-black ${i.taxaSucesso < 0.7 ? "text-rose-300" : "text-emerald-300"}`}>{pct(i.taxaSucesso)}</span></div>
                <div className="text-xs text-slate-400">{i.ok} com sucesso · {i.falhas} falha(s) · último uso {quando(i.ultimoUso)}</div>
                {i.ultimoErro && <div className="text-[11px] text-amber-300 break-words">Último erro: {i.ultimoErro}</div>}
                {i.ok + i.falhas >= 3 && i.taxaSucesso < 0.7 && <Aviso>Sucesso baixo: o site pode ter mudado de tela. Use “Diagnosticar tela da IA” no painel da extensão.</Aviso>}
              </div>))}</div>}
          </section>
          <section className="border border-slate-700 rounded-xl bg-slate-800/40 p-3 space-y-1" data-testid="ext-erros">
            <h4 className="text-sm font-black text-white">Erros reportados pela extensão</h4>
            {!d.erros.length ? <p className="text-xs text-slate-500">Nenhum erro nos últimos 30 dias.</p> : d.erros.map((g) => <div key={g.assinatura} className="text-xs text-slate-300 break-words"><span className={g.severidade === "erro" ? "text-rose-300 font-bold" : "text-amber-300 font-bold"}>{g.severidade}</span> · {g.mensagem} <span className="text-slate-500">({g.total}×, {g.usuarios} usuário(s), último {quando(g.ultimo)})</span></div>)}
          </section>
        </>
      )}
    </div>
  );
}

export function CalibragemPanel() {
  const [sub, setSub] = useState<Sub>("motores");
  const aba = (id: Sub, rotulo: string, Icone: any) => <button key={id} type="button" onClick={() => setSub(id)} data-testid={"calib-aba-" + id} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${sub === id ? "bg-amber-500/15 border-amber-500/50 text-amber-200" : "bg-slate-800 border-slate-700 text-slate-300"}`}><Icone className="w-3.5 h-3.5" /> {rotulo}</button>;
  return (
    <div className="space-y-4" data-testid="painel-calibragem">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap"><div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300"><Gauge className="w-5 h-5" /></div><h2 className="text-base font-black text-white">Calibragem</h2>
          <div className="ml-auto flex gap-2 flex-wrap">{aba("motores", "Motores", Cpu)}{aba("gabinetes", "Gabinetes", Building2)}{aba("extensao", "Extensão", Puzzle)}</div></div>
        {sub === "motores" && <Motores />}{sub === "gabinetes" && <Gabinetes />}{sub === "extensao" && <Extensao />}
      </div>
    </div>
  );
}
