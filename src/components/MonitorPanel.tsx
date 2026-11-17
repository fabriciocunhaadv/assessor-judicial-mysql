import React, { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Loader2, AlertTriangle } from "lucide-react";

// Aba "Monitor" do Super Admin: só lê (uso de IA, erros agrupados e tamanho do banco) pelas rotas /api/monitor, com o login de quem está logado.
interface Uso {
  horas: number; truncado: boolean; execucoes: number; tokens: number; custoBrl: number;
  porModulo: { modulo: string; chamadas: number; tokens: number; custoBrl: number }[];
  porUsuario: { usuario: string; chamadas: number; tokens: number; modulos: Record<string, number> }[];
  porHora: { hora: string; chamadas: number; tokens: number }[];
  porModelo: { modelo: string; chamadas: number; tokens: number }[];
  maiores: { quando: string; rotulo: string; tokens: number; modulo: string; usuario: string }[];
}
interface Saude { grupos: { tipo: string; modulo: string; severidade: string; mensagem: string; ocorrencias: number; primeiro: string; ultimo: string; usuarios: number }[]; porHora: { hora: string; severidade: string; n: number }[] }
interface Banco { tabelas: { nome: string; linhasAprox: number; mb: number }[]; colecoes: { colecao: string; docs: number; ultimaAlteracao: string | null }[] }

const PERIODOS = [{ h: 24, r: "24 horas" }, { h: 168, r: "7 dias" }, { h: 720, r: "30 dias" }];
const n = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const quando = (iso: string) => { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COR_SEV: Record<string, string> = { erro: "text-rose-300", aviso: "text-amber-300" };

async function ler<T>(rota: string): Promise<T> {
  const r = await fetch(rota); let j: any = {}; try { j = await r.json(); } catch { /* corpo vazio */ }
  if (!r.ok) throw new Error(j?.erro || `erro ${r.status}`);
  return j as T;
}

export function MonitorPanel() {
  const [horas, setHoras] = useState(24);
  const [uso, setUso] = useState<Uso | null>(null), [saude, setSaude] = useState<Saude | null>(null), [banco, setBanco] = useState<Banco | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [geradoEm, setGeradoEm] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const falhas: string[] = [];
    const [u, s, b] = await Promise.all([
      ler<Uso>(`/api/monitor/uso?horas=${horas}`).catch((e) => { falhas.push(`Uso de IA: ${e.message}`); return null; }),
      ler<Saude>(`/api/monitor/saude?horas=${horas}`).catch((e) => { falhas.push(`Saúde: ${e.message}`); return null; }),
      ler<Banco>(`/api/monitor/banco`).catch((e) => { falhas.push(`Banco: ${e.message}`); return null; }),
    ]);
    if (u) setUso(u); if (s) setSaude(s); if (b) setBanco(b);
    setErros(falhas); setGeradoEm(Date.now()); setCarregando(false);
  }, [horas]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (!auto) return; const t = setInterval(() => { void carregar(); }, 60_000); return () => clearInterval(t); }, [auto, carregar]);

  const maxHora = Math.max(1, ...(uso?.porHora || []).map((h) => h.tokens));
  const caixa = "rounded-2xl border border-slate-700 bg-slate-900/70 p-4";
  const th = "text-left text-[10px] uppercase tracking-wider text-slate-400 font-bold py-1.5 pr-3";
  const td = "py-1.5 pr-3 text-xs text-slate-200 align-top";

  return (
    <div className="space-y-4 text-slate-100" data-testid="painel-monitor">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black"><Eye className="w-5 h-5 text-sky-300" /> Monitor <span className="text-[11px] font-semibold text-slate-400">(só leitura)</span></h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold" data-testid="monitor-periodo">
            {PERIODOS.map((p) => <option key={p.h} value={p.h}>Últimas {p.r}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> atualizar a cada 1 min</label>
          <button onClick={() => void carregar()} disabled={carregando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60" data-testid="monitor-atualizar">
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar
          </button>
        </div>
      </div>
      {geradoEm && <div className="text-[11px] text-slate-400">Atualizado às {new Date(geradoEm).toLocaleTimeString("pt-BR")}. Os números vêm do banco do Studio; nada aqui altera dados.</div>}
      {erros.length > 0 && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs text-rose-200 space-y-1" data-testid="monitor-erros">
          {erros.map((e) => <div key={e} className="flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{e}</span></div>)}
        </div>
      )}

      {uso && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="monitor-cartoes">
            <div className={caixa}><div className="text-[10px] uppercase text-slate-400 font-bold">Execuções de IA</div><div className="text-2xl font-black">{n(uso.execucoes)}</div></div>
            <div className={caixa}><div className="text-[10px] uppercase text-slate-400 font-bold">Tokens</div><div className="text-2xl font-black">{n(uso.tokens)}</div></div>
            <div className={caixa}><div className="text-[10px] uppercase text-slate-400 font-bold">Custo estimado</div><div className="text-2xl font-black">{brl(uso.custoBrl)}</div></div>
            <div className={caixa}><div className="text-[10px] uppercase text-slate-400 font-bold">Usuários ativos</div><div className="text-2xl font-black">{n(uso.porUsuario.length)}</div></div>
          </div>
          {uso.truncado && <div className="text-[11px] text-amber-300">Havia mais de 20.000 execuções no período: a soma cobre só as mais recentes.</div>}

          {uso.porHora.length > 0 && (
            <div className={caixa}>
              <div className="text-xs font-black mb-2">Tokens por hora</div>
              <div className="flex items-end gap-0.5 h-24 overflow-x-auto" data-testid="monitor-grafico">
                {uso.porHora.map((h) => <div key={h.hora} title={`${h.hora}: ${n(h.tokens)} tokens, ${n(h.chamadas)} chamadas`} className="bg-sky-500/80 hover:bg-sky-400 min-w-[6px] flex-1 rounded-t" style={{ height: `${Math.max(3, (h.tokens / maxHora) * 100)}%` }} />)}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className={caixa}>
              <div className="text-xs font-black mb-2">Por módulo</div>
              <table className="w-full"><thead><tr><th className={th}>Módulo</th><th className={th}>Chamadas</th><th className={th}>Tokens</th><th className={th}>Custo</th></tr></thead>
                <tbody>{uso.porModulo.map((m) => <tr key={m.modulo}><td className={td}>{m.modulo}</td><td className={td}>{n(m.chamadas)}</td><td className={td}>{n(m.tokens)}</td><td className={td}>{brl(m.custoBrl)}</td></tr>)}
                  {uso.porModulo.length === 0 && <tr><td className={td} colSpan={4}>Nenhuma execução no período.</td></tr>}</tbody></table>
            </div>
            <div className={caixa}>
              <div className="text-xs font-black mb-2">Por usuário</div>
              <table className="w-full"><thead><tr><th className={th}>Usuário</th><th className={th}>Chamadas</th><th className={th}>Tokens</th><th className={th}>Módulos</th></tr></thead>
                <tbody>{uso.porUsuario.slice(0, 12).map((u) => <tr key={u.usuario}><td className={td + " break-all"}>{u.usuario}</td><td className={td}>{n(u.chamadas)}</td><td className={td}>{n(u.tokens)}</td><td className={td}>{Object.entries(u.modulos).map(([k, v]) => `${k} ${v}`).join(", ")}</td></tr>)}</tbody></table>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className={caixa}>
              <div className="text-xs font-black mb-2">Maiores execuções</div>
              <table className="w-full"><thead><tr><th className={th}>Quando</th><th className={th}>O quê</th><th className={th}>Tokens</th></tr></thead>
                <tbody>{uso.maiores.slice(0, 10).map((m, i) => <tr key={i}><td className={td}>{quando(m.quando)}</td><td className={td}>{m.rotulo || m.modulo}<div className="text-[10px] text-slate-400 break-all">{m.usuario}</div></td><td className={td}>{n(m.tokens)}</td></tr>)}</tbody></table>
            </div>
            <div className={caixa}>
              <div className="text-xs font-black mb-2">Por modelo</div>
              <table className="w-full"><thead><tr><th className={th}>Modelo</th><th className={th}>Chamadas</th><th className={th}>Tokens</th></tr></thead>
                <tbody>{uso.porModelo.map((m) => <tr key={m.modelo}><td className={td}>{m.modelo}</td><td className={td}>{n(m.chamadas)}</td><td className={td}>{n(m.tokens)}</td></tr>)}</tbody></table>
            </div>
          </div>
        </>
      )}

      {saude && (
        <div className={caixa} data-testid="monitor-saude">
          <div className="text-xs font-black mb-2">Erros e avisos do período (agrupados)</div>
          {saude.grupos.length === 0 ? <div className="text-xs text-emerald-300">Nenhum erro ou aviso no período.</div> : (
            <table className="w-full"><thead><tr><th className={th}>Nível</th><th className={th}>Onde</th><th className={th}>Mensagem</th><th className={th}>Vezes</th><th className={th}>Usuários</th><th className={th}>Último</th></tr></thead>
              <tbody>{saude.grupos.map((g, i) => <tr key={i}><td className={`${td} font-bold ${COR_SEV[g.severidade] || ""}`}>{g.severidade}</td><td className={td}>{g.tipo}/{g.modulo}</td><td className={td}>{g.mensagem}</td><td className={td}>{n(g.ocorrencias)}</td><td className={td}>{n(g.usuarios)}</td><td className={td}>{quando(g.ultimo)}</td></tr>)}</tbody></table>
          )}
        </div>
      )}

      {banco && (
        <div className="grid lg:grid-cols-2 gap-4" data-testid="monitor-banco">
          <div className={caixa}>
            <div className="text-xs font-black mb-2">Tabelas do banco</div>
            <table className="w-full"><thead><tr><th className={th}>Tabela</th><th className={th}>Linhas (aprox.)</th><th className={th}>MB</th></tr></thead>
              <tbody>{banco.tabelas.map((t) => <tr key={t.nome}><td className={td}>{t.nome}</td><td className={td}>{n(t.linhasAprox)}</td><td className={td}>{n(t.mb)}</td></tr>)}</tbody></table>
          </div>
          <div className={caixa}>
            <div className="text-xs font-black mb-2">Documentos por coleção</div>
            <table className="w-full"><thead><tr><th className={th}>Coleção</th><th className={th}>Docs</th><th className={th}>Última alteração</th></tr></thead>
              <tbody>{banco.colecoes.slice(0, 20).map((c) => <tr key={c.colecao}><td className={td + " break-all"}>{c.colecao}</td><td className={td}>{n(c.docs)}</td><td className={td}>{c.ultimaAlteracao ? quando(c.ultimaAlteracao) : "—"}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
      {!uso && !saude && !banco && !carregando && erros.length === 0 && <div className="text-xs text-slate-400">Sem dados.</div>}
    </div>
  );
}
