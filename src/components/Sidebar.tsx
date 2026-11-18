import React, { useEffect, useRef, useState } from "react";
import {
  Home, ShieldCheck, UserCheck, Activity, History, Scale,
  Sparkles, BookOpen, ClipboardList, Calendar, Gavel, SlidersHorizontal,
  ChevronLeft, ChevronRight, Bot, KeyRound, Smartphone, LifeBuoy, Compass, Video
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";

// Props will mirror the relevant ones from Header
interface SidebarProps {
  onGoHome?: () => void;
  onOpenMinuteAuditor?: () => void;
  onOpenPresentation?: () => void;
  onOpenXRay?: () => void;
  onOpenHistory?: () => void;
  onOpenTeses?: () => void;
  onOpenBindingPrecedents?: () => void;
  onOpenLegislativeLookup?: () => void;
  onOpenProjudiGuide?: () => void;
  onOpenCalendar?: () => void;
  onOpenHearingWorkbench?: () => void;
  /** Processo com audiência de instrução (vídeo ou transcrição): abre direto o Mutirão Expresso da Mesa de Audiências. */
  onOpenSentencaAudiencia?: () => void;
  onOpenPromptManager?: () => void;
  onOpenChangePassword?: () => void;
  tesesCount?: number;
  isJudge?: boolean;
  isSuperAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onGoHome, onOpenMinuteAuditor, onOpenPresentation, onOpenXRay, onOpenHistory,
  onOpenTeses, onOpenBindingPrecedents, onOpenLegislativeLookup, onOpenProjudiGuide,
  onOpenCalendar, onOpenHearingWorkbench, onOpenSentencaAudiencia, onOpenPromptManager, onOpenChangePassword,
  tesesCount = 0, isJudge, isSuperAdmin
}) => {
  const { isJudge: authIsJudge, isSuperAdmin: authIsSuperAdmin, user: authUser } = useAuth() as any;
  const effectiveIsSuperAdmin = isSuperAdmin ?? authIsSuperAdmin;
  const effectiveIsJudge = isJudge ?? authIsJudge;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) return saved === "true";
      return window.innerWidth < 1440;
    }
    return false;
  });

  // “O que fazer hoje?”: depois que a pessoa fecha a janela do assistente, na PRIMEIRA vez aparece uma abinha ao lado deste botão ("é só me chamar aqui").
  // Clicar fora (ou Esc) fecha a abinha; o botão continua marcado.
  const botaoAssistente = useRef<HTMLButtonElement>(null);
  const abinha = useRef<HTMLDivElement>(null);
  const [dica, setDica] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const aoFechar = (e: Event) => {
      const uid = String((e as CustomEvent)?.detail?.uid || authUser?.uid || "anon"), chave = `assessor_assistente_dica_${uid}`;
      let jaViu = false; try { jaViu = localStorage.getItem(chave) === "1"; } catch { /* sem armazenamento */ }
      if (jaViu) return;
      const r = botaoAssistente.current?.getBoundingClientRect(); if (!r || r.width === 0) return;
      try { localStorage.setItem(chave, "1"); } catch { /* mostra só desta vez */ }
      setDica({ x: Math.round(r.right + 12), y: Math.round(r.top + r.height / 2) });
    };
    window.addEventListener("assessor:assistente-fechado", aoFechar);
    return () => window.removeEventListener("assessor:assistente-fechado", aoFechar);
  }, [authUser?.uid]);
  useEffect(() => {
    if (!dica) return;
    const fora = (e: MouseEvent) => { if (abinha.current && abinha.current.contains(e.target as Node)) return; setDica(null); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setDica(null); };
    const t = setTimeout(() => document.addEventListener("mousedown", fora), 0);      // o clique que fechou a janela não pode fechar a abinha na hora
    document.addEventListener("keydown", tecla);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [dica]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div id="sidebar-principal" className={`transition-all duration-300 ease-in-out border-r border-slate-300/30 dark:border-slate-800 bg-white dark:bg-[#0b111a] flex flex-col h-screen ${isCollapsed ? 'w-16' : 'w-64'} shrink-0 z-40 hidden md:flex relative`}>
      {/* Collapse Toggle */}
      <button 
        onClick={toggleSidebar}
        title={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
        className="absolute -right-3 top-6 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" /> : <ChevronLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />}
      </button>

      <div className={`${isCollapsed ? "p-2 [&_button]:px-0 [&_button]:justify-center [&_svg]:shrink-0" : "p-4"} flex flex-col gap-6 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pt-6`} data-testid="sidebar-conteudo" style={{ paddingBottom: "calc(var(--dock-h, 0px) + 1rem)" }}>
        
        {/* GRUPO 1: AÇÕES PRINCIPAIS */}
        <div className="flex flex-col gap-1.5">
          {!isCollapsed && <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-2 mb-1">Ações Principais</span>}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Nova Análise"
            >
              <Home className="w-4 h-4 text-emerald-500" />
              {!isCollapsed && <span>Nova Análise</span>}
            </button>
          )}

          {(effectiveIsSuperAdmin || effectiveIsJudge) && onOpenMinuteAuditor && (
            <button
              id="btn-sidebar-minute-auditor"
              onClick={onOpenMinuteAuditor}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 hover:from-amber-200 hover:to-amber-100 dark:hover:from-amber-900/60 dark:hover:to-amber-800/40 text-amber-900 dark:text-amber-100 font-bold text-xs transition cursor-pointer border border-amber-200 dark:border-amber-500/30 ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Auditoria Ouro (Lupa do Magistrado & Auditor de Minutas)"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {!isCollapsed && <span>Auditoria Ouro</span>}
            </button>
          )}

          {onOpenSentencaAudiencia && (
            <button
              id="btn-sidebar-sentenca-audiencia"
              data-testid="btn-sentenca-audiencia"
              onClick={onOpenSentencaAudiencia}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl bg-gradient-to-r from-violet-100 to-violet-50 dark:from-violet-900/40 dark:to-violet-800/20 hover:from-violet-200 hover:to-violet-100 dark:hover:from-violet-900/60 dark:hover:to-violet-800/40 text-violet-900 dark:text-violet-100 font-bold text-xs border border-violet-200 dark:border-violet-800/60 transition cursor-pointer ${isCollapsed ? "justify-center" : ""}`}
              title="Sentença da audiência: para o processo que tem audiência de instrução. Envie o vídeo ou cole a transcrição e gere a sentença (abre o Mutirão Expresso)."
            >
              <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              {!isCollapsed && <span>Sentença da audiência</span>}
            </button>
          )}

          <button
            ref={botaoAssistente}
            onClick={() => { setDica(null); window.dispatchEvent(new Event("assessor:abrir-assistente")); }}
            className={`flex items-center gap-2.5 px-3 h-10 rounded-xl bg-gradient-to-r from-indigo-100 to-violet-50 dark:from-indigo-900/40 dark:to-violet-900/20 border-l-4 border-indigo-500 hover:from-indigo-200 hover:to-violet-100 dark:hover:from-indigo-900/60 text-indigo-900 dark:text-indigo-100 font-bold text-xs transition cursor-pointer ${isCollapsed ? "justify-center" : ""}`}
            title="O que fazer hoje? (abre as opções do dia)"
            data-testid="btn-assistente-do-dia"
          >
            <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            {!isCollapsed && <span className="flex-1 text-left">O que fazer hoje?</span>}
            {!isCollapsed && <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.22)]" aria-hidden />}
          </button>
          {dica && (
            <div ref={abinha} data-testid="assistente-abinha" role="status" style={{ position: "fixed", left: dica.x, top: dica.y, transform: "translateY(-50%)" }}
              className="z-[9100] w-64 rounded-xl bg-slate-900 text-white px-3.5 py-3 text-[13px] leading-snug shadow-2xl">
              <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-slate-900" aria-hidden />
              <b className="block text-[14px] mb-0.5">👋 Primeira vez por aqui?</b>
              Se precisar, é só me chamar aqui. Eu te ajudo a escolher o que fazer.
              <span className="block mt-1.5 text-[11px] text-slate-400">Clique fora para fechar este aviso.</span>
            </div>
          )}

          {onOpenPresentation && (
            <button
              onClick={onOpenPresentation}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Conheça o Assessor"
            >
              <UserCheck className="w-4 h-4 text-purple-500" />
              {!isCollapsed && <span>Conheça o Assessor</span>}
            </button>
          )}

          {onOpenXRay && (
            <button
              onClick={onOpenXRay}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Raio-X da Lotação"
            >
              <Activity className="w-4 h-4 text-blue-500" />
              {!isCollapsed && <span>Raio-X da Lotação</span>}
            </button>
          )}

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Histórico Local"
            >
              <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {!isCollapsed && <span>Histórico Local</span>}
            </button>
          )}

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("fila:abrir"))}
            className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
            title="Minha fila: acompanhe a esteira da extensão pelo celular e ligue os avisos"
            data-testid="menu-minha-fila"
          >
            <Smartphone className="w-4 h-4 text-indigo-500" />
            {!isCollapsed && <span>Minha fila (celular)</span>}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("chamado:abrir"))}
            className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
            title="Abrir chamado: relate um problema com texto, print e PDF"
            data-testid="menu-abrir-chamado"
          >
            <LifeBuoy className="w-4 h-4 text-rose-500" />
            {!isCollapsed && <span>Abrir chamado (com print)</span>}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("agaia:abrir"))}
            className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
            title="Minutas do Agaia: acompanhar as que chegaram e colar uma minuta feita fora do Studio"
            data-testid="menu-agaia"
          >
            <Bot className="w-4 h-4 text-teal-600" />
            {!isCollapsed && <span>Minutas do Agaia</span>}
          </button>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-slate-200 dark:bg-slate-800/80 my-2" />

        {/* GRUPO 2: REPOSITÓRIO JURÍDICO & PRECEDENTES */}
        <div className="flex flex-col gap-1.5">
          {!isCollapsed && <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-2 mb-1">Repositório Jurídico</span>}
          
          {onOpenTeses && (
            <button
              onClick={onOpenTeses}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Teses & Modelos"
            >
              <Scale className="w-4 h-4 text-amber-500" />
              {!isCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>Teses & Modelos</span>
                  {tesesCount > 0 && (
                    <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {tesesCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}

          {onOpenBindingPrecedents && (
            <button
              id="btn-sidebar-binding-precedents"
              onClick={onOpenBindingPrecedents}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Súmulas & Informativos TJGO"
            >
              <Sparkles className="w-4 h-4 text-emerald-500" />
              {!isCollapsed && <span>Súmulas & TJGO</span>}
            </button>
          )}

          {onOpenLegislativeLookup && (
            <button
              onClick={onOpenLegislativeLookup}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Legislação & Juros"
            >
              <BookOpen className="w-4 h-4 text-indigo-500" />
              {!isCollapsed && <span>Legislação & Juros</span>}
            </button>
          )}

          {onOpenProjudiGuide && (
            <button
              onClick={onOpenProjudiGuide}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="PROJUDI"
            >
              <ClipboardList className="w-4 h-4 text-blue-500" />
              {!isCollapsed && <span>PROJUDI</span>}
            </button>
          )}

          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Agenda"
            >
              <Calendar className="w-4 h-4 text-amber-500" />
              {!isCollapsed && <span>Agenda</span>}
            </button>
          )}

          {onOpenHearingWorkbench && (
            <button
              onClick={onOpenHearingWorkbench}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Audiências"
            >
              <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-500" />
              {!isCollapsed && <span>Audiências</span>}
            </button>
          )}

          {onOpenPromptManager && (
            <button
              onClick={onOpenPromptManager}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Prompts"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
              {!isCollapsed && <span>Prompts</span>}
            </button>
          )}

          {onOpenChangePassword && (
            <button
              id="btn-trocar-senha"
              onClick={onOpenChangePassword}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              title="Trocar senha"
            >
              <KeyRound className="w-4 h-4 text-violet-500" />
              {!isCollapsed && <span>Trocar senha</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
