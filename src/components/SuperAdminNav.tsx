import React from "react";
import { Compass, Gauge, HeartPulse, Activity, BarChart3, Bug, Building, Users, ShieldCheck, Megaphone, Database, Zap } from "lucide-react";

export type AbaSuper = "central" | "calibragem" | "saude" | "operacao" | "utilizacao" | "erros" | "tokens" | "tenants" | "users" | "snapshots" | "broadcast" | "migration";
export interface ItemNav { id: AbaSuper; rotulo: string; dica: string; Icone: any; cor: string; testid: string; badge?: string | number | null; alerta?: boolean }
export interface GrupoNav { titulo: string; itens: ItemNav[] }

/** Organização do menu do Super Admin: do mais usado (visão geral) ao mais raro (sistema). Cada item tem uma frase que diz para que serve. */
export function gruposDoMenu(c: { gabinetes: number; usuarios: number; snapshots: number; comunicadoAtivo: boolean }): GrupoNav[] {
  return [
    { titulo: "Visão geral", itens: [
      { id: "central", rotulo: "Central", dica: "O que precisa de você hoje", Icone: Compass, cor: "text-indigo-300", testid: "aba-central" },
      { id: "saude", rotulo: "Saúde", dica: "Servidor, banco, IA e alertas", Icone: HeartPulse, cor: "text-emerald-400", testid: "aba-saude" },
      { id: "calibragem", rotulo: "Calibragem", dica: "Motores, gabinetes e extensão", Icone: Gauge, cor: "text-amber-300", testid: "aba-calibragem" },
    ] },
    { titulo: "Acompanhamento", itens: [
      { id: "operacao", rotulo: "Operação", dica: "O que cada usuário fez", Icone: Activity, cor: "text-sky-400", testid: "aba-monitor-operacao" },
      { id: "utilizacao", rotulo: "Utilização", dica: "Quanto cada pessoa usou", Icone: BarChart3, cor: "text-cyan-300", testid: "aba-utilizacao" },
      { id: "erros", rotulo: "Erros", dica: "Erros vistos nas telas", Icone: Bug, cor: "text-rose-400", testid: "aba-monitor-erros" },
      { id: "tokens", rotulo: "Tokens", dica: "Uso da chave nativa", Icone: Zap, cor: "text-amber-400", testid: "aba-tokens" },
    ] },
    { titulo: "Cadastros", itens: [
      { id: "tenants", rotulo: "Gabinetes", dica: "Contratantes e planos", Icone: Building, cor: "text-indigo-300", testid: "aba-gabinetes", badge: c.gabinetes },
      { id: "users", rotulo: "Usuários", dica: "Contas, acessos e chaves", Icone: Users, cor: "text-emerald-300", testid: "aba-usuarios", badge: c.usuarios },
    ] },
    { titulo: "Sistema", itens: [
      { id: "snapshots", rotulo: "Snapshots", dica: "Cópias de segurança", Icone: ShieldCheck, cor: "text-teal-300", testid: "aba-snapshots", badge: c.snapshots },
      { id: "broadcast", rotulo: "Comunicado", dica: "Aviso para todos os gabinetes", Icone: Megaphone, cor: "text-rose-300", testid: "aba-comunicado", alerta: c.comunicadoAtivo, badge: c.comunicadoAtivo ? "no ar" : null },
      { id: "migration", rotulo: "Migração", dica: "Importar banco antigo", Icone: Database, cor: "text-slate-300", testid: "aba-migracao" },
    ] },
  ];
}

/** Menu lateral (telas médias e grandes) e seletor com grupos (celular): nenhum item fica escondido fora da tela. */
export function SuperAdminNav({ grupos, ativa, aoEscolher }: { grupos: GrupoNav[]; ativa: AbaSuper; aoEscolher: (a: AbaSuper) => void }) {
  return (
    <>
      <div className="md:hidden px-3 py-2 border-b border-slate-800 bg-slate-950 shrink-0" data-testid="abas-super-admin-mobile">
        <label className="sr-only" htmlFor="seletor-aba-super">Seção do painel</label>
        <select id="seletor-aba-super" value={ativa} onChange={(e) => aoEscolher(e.target.value as AbaSuper)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white">
          {grupos.map((g) => <optgroup key={g.titulo} label={g.titulo}>{g.itens.map((i) => <option key={i.id} value={i.id}>{i.rotulo}{i.badge != null && i.badge !== "" ? ` (${i.badge})` : ""} — {i.dica}</option>)}</optgroup>)}
        </select>
      </div>
      <nav data-testid="abas-super-admin" aria-label="Seções do painel" className="hidden md:flex flex-col gap-3 w-[230px] shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 p-3 md:row-start-4">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-1">
            <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{g.titulo}</div>
            {g.itens.map((i) => {
              const on = i.id === ativa;
              return (
                <button key={i.id} type="button" onClick={() => aoEscolher(i.id)} data-testid={i.testid} aria-current={on ? "page" : undefined} title={i.dica}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${on ? "bg-indigo-500/15 border-indigo-500/50" : "border-transparent hover:bg-slate-900 hover:border-slate-800"}`}>
                  <i.Icone className={`w-4 h-4 shrink-0 ${i.cor}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-bold leading-tight ${on ? "text-white" : "text-slate-200"}`}>{i.rotulo}</span>
                    <span className="hidden [@media(min-height:820px)]:block text-[10.5px] leading-tight text-slate-500 truncate">{i.dica}</span>
                  </span>
                  {i.badge != null && i.badge !== "" && <span className={`px-1.5 py-px rounded-full text-[10px] font-bold ${i.alerta ? "bg-rose-500/20 text-rose-300 animate-pulse" : "bg-slate-800 text-slate-300"}`}>{i.badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
