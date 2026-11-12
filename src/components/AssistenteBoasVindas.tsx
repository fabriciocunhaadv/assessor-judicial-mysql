// Assistente do dia: na primeira entrada do dia (com login novo ou sessão já aberta) aparece no canto direito, pergunta o que a pessoa quer fazer e leva à função certa,
// com os passos de como usar (inclusive o que se faz na extensão). Perfil (assessor ou magistrado) vem do cadastro e pode ser trocado na própria janela.
// Não bloqueia nada: tem "Minimizar" e "Fechar" (fechar = só volta amanhã ou pelo botão "O que fazer hoje?" do menu lateral).
import React, { useEffect, useMemo, useState } from "react";
import { X, Minus, MessageCircle, ChevronDown, ChevronUp, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { URL_EXTENSAO_CHROME_STORE } from "../config/extensao";
import { extensaoInstalada } from "./AvisoExtensao";

export type AcaoAssistente = "analisar" | "historico" | "lupa" | "mesa" | "turbo" | "gigantes" | "teses" | "manual" | "guia";
type Perfil = "assessor" | "magistrado";

interface Tarefa {
  id: string; icone: string; titulo: string; descricao: string;
  passos?: string[]; botoes?: { rotulo: string; acao: AcaoAssistente }[];
  exigeExtensao?: boolean; soMagistrado?: boolean;
}

const CATALOGO: Record<string, Tarefa> = {
  fila: {
    id: "fila", icone: "📥", titulo: "Mandar uma fila de processos para analisar", exigeExtensao: true,
    descricao: "A extensão baixa e analisa vários processos sozinha, enquanto você trabalha nas minutas.",
    passos: [
      "No Projudi, clique no ícone da extensão Conclusões Projudi e em “Abrir painel completo”.",
      "Marque os processos da fila e escolha quem vai analisar: o Agaia, outra IA ou o Studio (e o modo: análise normal, Turbo ou Lupa).",
      "Envie e deixe a aba da Esteira aberta: os processos são feitos um por vez, sem você esperar.",
      "Enquanto isso, trabalhe aqui: abra o Histórico, clique em “Carregar minuta”, ajuste e use “Lançar no Projudi” (ou copie para o documento que preferir).",
    ],
    botoes: [{ rotulo: "Abrir meu Histórico", acao: "historico" }],
  },
  lupa_fila: {
    id: "lupa_fila", icone: "🔎", titulo: "Mandar uma fila de processos para a Lupa do Magistrado", exigeExtensao: true,
    descricao: "A extensão leva os processos e as minutas do assessor para serem auditados um por vez.",
    passos: [
      "No Projudi, clique no ícone da extensão e em “Abrir painel completo”.",
      "Marque os processos e escolha o modo “Lupa” (a análise é feita no Studio).",
      "Envie e deixe a aba da Esteira aberta.",
      "Os resultados chegam ao Histórico; abra cada um para ler os alertas e decidir.",
    ],
    botoes: [{ rotulo: "Abrir meu Histórico", acao: "historico" }],
  },
  lupa: {
    id: "lupa", icone: "⚖️", titulo: "Lupa do Magistrado: conferir uma minuta", soMagistrado: true,
    descricao: "Audita a minuta do assessor contra os autos, com os pontos de atenção e a página de cada achado.",
    passos: [
      "Abra a Lupa e clique em “Nova Auditoria”.",
      "Informe os autos (PDF ou texto) e a minuta do assessor.",
      "Escolha o prompt e clique em “Auditar Minuta com Rigor do Magistrado”.",
      "Leia os alertas (cada um indica onde está nos autos) e ajuste a minuta.",
    ],
    botoes: [{ rotulo: "Abrir a Lupa", acao: "lupa" }],
  },
  avulso: {
    id: "avulso", icone: "📄", titulo: "Analisar um processo só (manual)",
    descricao: "Você anexa o PDF, escolhe o prompt e acompanha o resultado na hora.",
    passos: [
      "Escolha o prompt da matéria em “Prompt Ativo”.",
      "Anexe o PDF do processo (ou use “Texto / Casos” para colar o texto).",
      "Clique em “Executar Prompt” e acompanhe o resultado ao lado.",
      "Peça ajustes pelo chat da minuta e, se quiser, use “Adaptar a paradigma”.",
    ],
    botoes: [{ rotulo: "Ir para a análise", acao: "analisar" }],
  },
  historico: {
    id: "historico", icone: "🗂️", titulo: "Trabalhar nas minutas prontas (Histórico)",
    descricao: "Abra a minuta, refine, leve ao Projudi e marque como lançada.",
    passos: [
      "Abra o Histórico (botão abaixo ou menu lateral).",
      "Em “A lançar” aparece o que ainda falta; “Carregar minuta” abre a minuta na tela.",
      "Refine pelo chat, copie, gere DOCX ou PDF, ou clique em “Lançar no Projudi”.",
      "Marque “lançado” ao terminar: a minuta sai da lista de pendentes.",
    ],
    botoes: [{ rotulo: "Abrir o Histórico", acao: "historico" }],
  },
  mesa: {
    id: "mesa", icone: "🏛️", titulo: "Mesa de audiências (pauta e ata)",
    descricao: "Prepare a audiência com a ata prévia e o apoio do sistema; a pauta vem do Projudi pela extensão.",
    passos: [
      "Abra a Mesa de audiências.",
      "Em “Pauta Normal”, anexe os autos e prepare a ata prévia e o roteiro da audiência.",
      "Para trazer a pauta do Projudi, use o ícone da extensão e “Pauta de audiências”.",
    ],
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }],
  },
  sentenca_individual: {
    id: "sentenca_individual", icone: "🎙️", titulo: "Sentença de audiência com vídeo: um processo",
    descricao: "O sistema escuta o vídeo da audiência e escreve a sentença com as provas dos autos.",
    passos: [
      "Abra a Mesa de audiências e clique na aba “Mutirão Expresso”.",
      "Anexe o PDF dos autos e, depois, o(s) vídeo(s) da audiência.",
      "Escolha o prompt e clique em “Analisar Mídia e Gerar Sentença”.",
      "A sentença vai para o Histórico, com a etiqueta “Sentença c/ vídeo”.",
    ],
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }],
  },
  sentenca_fila: {
    id: "sentenca_fila", icone: "🎬", titulo: "Sentenças de audiência com vídeo: várias, em fila", exigeExtensao: true,
    descricao: "Para audiências de instrução já realizadas: a extensão baixa os autos e os vídeos e envia ao Studio.",
    passos: [
      "No Projudi, clique no ícone da extensão e em “Pauta de audiências”.",
      "Escolha as audiências que têm vídeo e clique em “Sentenciar com o vídeo da audiência”; selecione o prompt (por serventia).",
      "A extensão baixa os autos e os vídeos e envia ao Studio, um processo de cada vez.",
      "Acompanhe no selo “Sentença com vídeo” e abra a sentença no Histórico.",
    ],
    botoes: [{ rotulo: "Abrir meu Histórico", acao: "historico" }],
  },
  turbo: {
    id: "turbo", icone: "⚡", titulo: "Análise rápida (Turbo)",
    descricao: "Uma etapa só, para quando você quer a minuta logo.",
    passos: ["Abra o Turbo e anexe o PDF.", "Escolha o ato (sentença, decisão, despacho ou automático).", "Execute e abra a minuta no resultado."],
    botoes: [{ rotulo: "Abrir o Turbo", acao: "turbo" }],
  },
  grandes: {
    id: "grandes", icone: "📚", titulo: "Processo muito grande",
    descricao: "Autos com muitas páginas são lidos em lotes, em segundo plano, sem travar o resto.",
    passos: ["Anexe o PDF normalmente: se for muito grande, o sistema oferece ou segue a leitura em lotes.", "Acompanhe no selo “Gigantes” (canto inferior esquerdo).", "A minuta vai para o Histórico quando terminar."],
    botoes: [{ rotulo: "Ver processos em lotes", acao: "gigantes" }],
  },
  teses: {
    id: "teses", icone: "📖", titulo: "Teses, modelos e súmulas do gabinete",
    descricao: "Cadastre as teses e os modelos de decisão; depois aplique um modelo em qualquer minuta pronta.",
    passos: ["Abra “Teses & Modelos” e, em “Modelos de Decisões”, cadastre a decisão que serve de modelo.", "Gere a minuta e use “Adaptar a paradigma” para seguir a estrutura do modelo."],
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
  const { user, userProfile, isJudge, isSuperAdmin } = useAuth() as any;
  const uid: string = user?.uid || "";
  const nome = String(userProfile?.name || user?.displayName || "").split(" ")[0];
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [perfil, setPerfil] = useState<Perfil>(isJudge ? "magistrado" : "assessor");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [versaoExt, setVersaoExt] = useState<string>(() => extensaoInstalada());

  useEffect(() => { setPerfil(isJudge ? "magistrado" : "assessor"); }, [isJudge]);

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

  const tarefas = useMemo(() => ORDEM[perfil].map((id) => CATALOGO[id]).filter((t) => t && (!t.soMagistrado || perfil === "magistrado" || isSuperAdmin)), [perfil, isSuperAdmin]);

  const fechar = () => { try { localStorage.setItem(chaveDia(uid), hojeLocal()); } catch { /* sem armazenamento: volta na próxima abertura */ } setAberto(false); };
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

      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[11px] shrink-0">
        <span className="text-slate-500">Eu sou:</span>
        {(["assessor", "magistrado"] as Perfil[]).map((p) => (
          <button key={p} onClick={() => { setPerfil(p); setExpandida(null); }} data-testid={`assistente-perfil-${p}`}
            className={`px-2 py-0.5 rounded-full border font-bold cursor-pointer ${perfil === p ? "bg-indigo-600 border-indigo-700 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
            {p === "assessor" ? "Assessor" : "Magistrado"}
          </button>
        ))}
      </div>

      <div className="px-3 pb-1 text-[10px] shrink-0" data-testid="assistente-extensao">
        {versaoExt
          ? <span className="text-emerald-700">✔ Extensão instalada (versão {versaoExt}): filas disponíveis.</span>
          : <span className="text-amber-800">⚠ Extensão não detectada. As filas dependem dela. <a href={URL_EXTENSAO_CHROME_STORE} target="_blank" rel="noreferrer" className="underline font-bold" data-testid="assistente-instalar">Instalar a extensão</a></span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {tarefas.map((t, i) => {
          const principal = i === 0, aberta = expandida === t.id;
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
                  <button key={b.acao + b.rotulo} onClick={() => { aoAcao(b.acao); setMinimizado(true); }} data-testid={`assistente-acao-${b.acao}`}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1">
                    {b.rotulo} <ExternalLink className="w-3 h-3" />
                  </button>
                ))}
                {t.passos && (
                  <button onClick={() => setExpandida(aberta ? null : t.id)} data-testid={`assistente-como-${t.id}`}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                    Como fazer {aberta ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
              {aberta && t.passos && (
                <ol className="mt-2 pl-4 list-decimal space-y-1 text-[11px] text-slate-700 leading-snug" data-testid={`assistente-passos-${t.id}`}>
                  {t.passos.map((p, k) => <li key={k}>{p}</li>)}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
