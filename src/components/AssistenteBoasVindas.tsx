// Assistente do dia: na primeira entrada do dia (com login novo ou sessão já aberta) aparece no canto direito, pergunta o que a pessoa quer fazer e leva à função certa.
// Cada cartão tem só o(s) botão(ões): os da fila abrem a página da extensão (painel completo ou pauta) numa aba nova; os demais abrem a função aqui no Studio.
// O perfil (assessor ou magistrado) vem SÓ do cadastro do usuário. Tem "Minimizar" e "Fechar" (fechar = só volta amanhã ou pelo botão "O que fazer hoje?" do menu lateral).
import React, { useEffect, useMemo, useState } from "react";
import { X, Minus, MessageCircle, ExternalLink, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../lib/AuthContext";
import { URL_EXTENSAO_CHROME_STORE } from "../config/extensao";
import { extensaoInstalada } from "./AvisoExtensao";
import { abrirPaginaDaExtensao } from "../utils/abrirPaginaExtensao";

export type AcaoAssistente = "ext-painel" | "ext-pauta" | "analisar" | "historico" | "lupa" | "mesa" | "turbo" | "gigantes" | "teses" | "manual" | "guia";
type Perfil = "assessor" | "magistrado";

interface Tarefa {
  id: string; icone: string; titulo: string; descricao: string;
  botoes?: { rotulo: string; acao: AcaoAssistente }[];
  exigeExtensao?: boolean; soMagistrado?: boolean;
}

const CATALOGO: Record<string, Tarefa> = {
  fila: {
    id: "fila", icone: "📥", titulo: "Mandar uma fila de processos para analisar", exigeExtensao: true,
    descricao: "Abre o painel completo da extensão: lá você marca os processos e escolhe quem analisa (Agaia, outra IA ou Studio). Enquanto a fila roda, trabalhe nas minutas pelo Histórico.",
    botoes: [{ rotulo: "Abrir o painel da extensão", acao: "ext-painel" }, { rotulo: "Abrir meu Histórico", acao: "historico" }],
  },
  lupa_fila: {
    id: "lupa_fila", icone: "🔎", titulo: "Mandar uma fila de processos para a Lupa do Magistrado", exigeExtensao: true,
    descricao: "Abre o painel completo da extensão: marque os processos e escolha o modo Lupa; os resultados chegam ao Histórico.",
    botoes: [{ rotulo: "Abrir o painel da extensão", acao: "ext-painel" }, { rotulo: "Abrir meu Histórico", acao: "historico" }]
  },
  lupa: {
    id: "lupa", icone: "⚖️", titulo: "Lupa do Magistrado: conferir uma minuta", soMagistrado: true,
    descricao: "Audita a minuta do assessor contra os autos, com os pontos de atenção e a página de cada achado.",
    botoes: [{ rotulo: "Abrir a Lupa", acao: "lupa" }],
  },
  avulso: {
    id: "avulso", icone: "📄", titulo: "Analisar um processo só (manual)",
    descricao: "Você anexa o PDF, escolhe o prompt e acompanha o resultado na hora.",
    botoes: [{ rotulo: "Ir para a análise", acao: "analisar" }],
  },
  historico: {
    id: "historico", icone: "🗂️", titulo: "Trabalhar nas minutas prontas (Histórico)",
    descricao: "Abra a minuta, refine, leve ao Projudi e marque como lançada.",
    botoes: [{ rotulo: "Abrir o Histórico", acao: "historico" }],
  },
  mesa: {
    id: "mesa", icone: "🏛️", titulo: "Mesa de audiências (pauta e ata)",
    descricao: "Prepare a audiência com a ata prévia e o apoio do sistema; a pauta vem do Projudi pela extensão.",
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }],
  },
  sentenca_individual: {
    id: "sentenca_individual", icone: "🎙️", titulo: "Sentença de audiência com vídeo: um processo",
    descricao: "O sistema escuta o vídeo da audiência e escreve a sentença com as provas dos autos.",
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }],
  },
  sentenca_fila: {
    id: "sentenca_fila", icone: "🎬", titulo: "Sentenças de audiência com vídeo: várias, em fila", exigeExtensao: true,
    descricao: "Para audiências de instrução já realizadas: abre a pauta de audiências da extensão, onde você escolhe as audiências com vídeo e manda sentenciar.",
    botoes: [{ rotulo: "Abrir a pauta de audiências da extensão", acao: "ext-pauta" }, { rotulo: "Abrir meu Histórico", acao: "historico" }]
  },
  turbo: {
    id: "turbo", icone: "⚡", titulo: "Análise rápida (Turbo)",
    descricao: "Uma etapa só, para quando você quer a minuta logo.",
    botoes: [{ rotulo: "Abrir o Turbo", acao: "turbo" }],
  },
  grandes: {
    id: "grandes", icone: "📚", titulo: "Processo muito grande",
    descricao: "Autos com muitas páginas são lidos em lotes, em segundo plano, sem travar o resto.",
    botoes: [{ rotulo: "Ver processos em lotes", acao: "gigantes" }],
  },
  teses: {
    id: "teses", icone: "📖", titulo: "Teses, modelos e súmulas do gabinete",
    descricao: "Cadastre as teses e os modelos de decisão; depois aplique um modelo em qualquer minuta pronta.",
    botoes: [{ rotulo: "Abrir Teses & Modelos", acao: "teses" }],
  },
  conhecer: {
    id: "conhecer", icone: "🧭", titulo: "Conhecer o sistema",
    descricao: "Manual completo e guia passo a passo do dia a dia do assessor.",
    botoes: [{ rotulo: "Abrir o manual", acao: "manual" }, { rotulo: "Guia do assessor", acao: "guia" }],
  },
};

const ORDEM: Record<Perfil, string[]> = {
  assessor: ["fila", "avulso", "historico", "mesa", "sentenca_individual", "sentenca_fila", "turbo", "grandes", "teses", "conhecer"],
  magistrado: ["lupa", "lupa_fila", "fila", "historico", "avulso", "sentenca_individual", "sentenca_fila", "mesa", "grandes", "turbo", "teses", "conhecer"],
};

const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const chaveDia = (uid: string) => `assessor_assistente_dia_${uid || "anon"}`;
const lerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

interface Props { aoAcao: (acao: AcaoAssistente) => void }

export const AssistenteBoasVindas: React.FC<Props> = ({ aoAcao }) => {
  const { user, userProfile, isJudge } = useAuth() as any;
  const uid: string = user?.uid || "";
  const nome = String(userProfile?.name || user?.displayName || "").split(" ")[0];
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const perfil: Perfil = isJudge ? "magistrado" : "assessor";      // vem SÓ do cadastro: o assessor nunca vê as opções do magistrado
  const [versaoExt, setVersaoExt] = useState<string>(() => extensaoInstalada());

  // primeira entrada do dia: só depois do tutorial inicial (para não aparecer em cima dele)
  useEffect(() => {
    if (!uid) return;
    let vivo = true, t: ReturnType<typeof setInterval> | null = null;
    const tentar = (): boolean => {
      if (!vivo) return true;
      if (lerLocal(chaveDia(uid)) === hojeLocal()) return true;
      const tutorialResolvido = lerLocal("assessor_tour_off") === "1" || lerLocal("assessor_tour_app_tour") === "1" || (userProfile?.completedTours || []).includes("app_tour");
      if (!tutorialResolvido) return false;      // o tutorial inicial ainda vai rodar (ou está rodando): espera
      setAberto(true); return true;
    };
    if (!tentar()) { t = setInterval(() => { if (tentar() && t) { clearInterval(t); t = null; } }, 3000); }
    return () => { vivo = false; if (t) clearInterval(t); };
  }, [uid, userProfile]);

  // reabrir pelo botão do menu lateral
  useEffect(() => {
    const abrir = () => { setAberto(true); setMinimizado(false); };
    window.addEventListener("assessor:abrir-assistente", abrir);
    return () => window.removeEventListener("assessor:abrir-assistente", abrir);
  }, []);

  // a extensão se anuncia alguns segundos depois de a página abrir
  useEffect(() => {
    if (!aberto || versaoExt) return;
    const t = setInterval(() => { const v = extensaoInstalada(); if (v) { setVersaoExt(v); clearInterval(t); } }, 1500);
    const parar = setTimeout(() => clearInterval(t), 12000);
    return () => { clearInterval(t); clearTimeout(parar); };
  }, [aberto, versaoExt]);

  const tarefas = useMemo(() => ORDEM[perfil].map((id) => CATALOGO[id]).filter(Boolean), [perfil]);

  const fechar = () => { try { localStorage.setItem(chaveDia(uid), hojeLocal()); } catch { /* sem armazenamento: volta na próxima abertura */ } setAberto(false); };
  // botões da extensão abrem a página dela numa aba nova; os demais abrem a função aqui dentro do Studio
  const clicar = (acao: AcaoAssistente) => {
    if (acao === "ext-painel" || acao === "ext-pauta") {
      const r = abrirPaginaDaExtensao(acao === "ext-painel" ? "painel.html" : "pauta.html");
      if (r === "aberto") { setMinimizado(true); return; }
      if (r === "sem-extensao") { try { window.open(URL_EXTENSAO_CHROME_STORE, "_blank", "noopener"); } catch { /* sem pop-up */ } toast("A extensão Conclusões Projudi não foi detectada. Abri a página de instalação em outra aba.", { icon: "🧩", duration: 8000 }); return; }
      toast(`Esta versão da extensão ainda não abre o painel daqui. Atualize a extensão (2.0.6 ou mais nova) ou, por ora, clique no ícone dela e em ${acao === "ext-painel" ? "“Abrir painel completo”" : "“Pauta de audiências”"}.`, { icon: "🧩", duration: 10000 });
      return;
    }
    aoAcao(acao); setMinimizado(true);
  };
  if (!aberto) return null;

  if (minimizado) {
    return (
      <button onClick={() => setMinimizado(false)} data-testid="assistente-pilula"
        className="fixed right-3 top-[7.5rem] max-md:top-auto max-md:bottom-16 z-[9000] flex items-center gap-1.5 px-3 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg border border-indigo-300 cursor-pointer"
        title="Abrir o assistente do dia">
        <MessageCircle className="w-4 h-4" /> O que fazer hoje?
      </button>
    );
  }

  return (
    <aside data-testid="assistente-boas-vindas" aria-label="Assistente do dia"
      className="fixed right-3 top-[7.5rem] max-md:top-auto max-md:bottom-16 z-[9000] w-[min(92vw,21rem)] max-h-[calc(100vh-9.5rem)] max-md:max-h-[60vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl border border-indigo-200 overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600 text-white shrink-0">
        <Sparkles className="w-4 h-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold leading-tight">{nome ? `Olá, ${nome}!` : "Olá!"} O que você quer fazer hoje?</div>
        </div>
        <button onClick={() => setMinimizado(true)} className="p-1 rounded hover:bg-white/20 cursor-pointer" title="Minimizar" aria-label="Minimizar" data-testid="assistente-minimizar"><Minus className="w-4 h-4" /></button>
        <button onClick={fechar} className="p-1 rounded hover:bg-white/20 cursor-pointer" title="Fechar (volta amanhã)" aria-label="Fechar" data-testid="assistente-fechar"><X className="w-4 h-4" /></button>
      </header>

      <div className="px-3 pt-2 pb-1 text-[10px] shrink-0" data-testid="assistente-extensao">
        {versaoExt
          ? <span className="text-emerald-700">✔ Extensão instalada (versão {versaoExt}): filas disponíveis.</span>
          : <span className="text-amber-800">⚠ Extensão não detectada. As filas dependem dela. <a href={URL_EXTENSAO_CHROME_STORE} target="_blank" rel="noreferrer" className="underline font-bold" data-testid="assistente-instalar">Instalar a extensão</a></span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {tarefas.map((t, i) => {
          const principal = i === 0;
          return (
            <div key={t.id} data-testid={`assistente-tarefa-${t.id}`} className={`rounded-xl border p-2.5 ${principal ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-slate-50/50"}`}>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5" aria-hidden>{t.icone}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold text-slate-900 leading-snug">{principal && <span className="text-[9px] mr-1 px-1 py-0.5 rounded bg-indigo-600 text-white align-middle">PRINCIPAL</span>}{t.titulo}</div>
                  <div className="text-[11px] text-slate-600 leading-snug mt-0.5">{t.descricao}</div>
                  {t.exigeExtensao && !versaoExt && <div className="text-[10px] text-amber-800 mt-1">Precisa da extensão instalada.</div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {t.botoes?.map((b) => (
                  <button key={b.acao + b.rotulo} onClick={() => clicar(b.acao)} data-testid={`assistente-acao-${b.acao}`}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1">
                    {b.rotulo} <ExternalLink className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
