// Assistente do dia: na primeira entrada do dia (com login novo ou sessão já aberta) aparece no canto inferior direito como uma CONVERSA curta:
// pergunta o que a pessoa quer fazer, mostra poucas escolhas grandes por vez e termina no botão que abre a função (o da fila abre a página da extensão numa aba nova).
// O perfil (assessor ou magistrado) vem SÓ do cadastro do usuário. "Minimizar" vira uma pílula que reabre a conversa do começo; "Fechar" só volta amanhã ou pelo menu lateral.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Minus, MessageCircle, Sparkles, ArrowLeft, Home, Send } from "lucide-react";
import { getApiHeaders } from "../utils/apiKeyManager";
import { useAuth } from "../lib/AuthContext";
import { URL_EXTENSAO_CHROME_STORE } from "../config/extensao";
import { extensaoInstalada } from "./AvisoExtensao";
import { abrirPaginaDaExtensao } from "../utils/abrirPaginaExtensao";

export type AcaoAssistente = "ext-painel" | "ext-pauta" | "analisar" | "historico" | "lupa" | "mesa" | "turbo" | "gigantes" | "teses" | "manual" | "guia";
type Perfil = "assessor" | "magistrado";
interface Botao { rotulo: string; acao: AcaoAssistente }
interface No { id: string; icone: string; rotulo: string; resposta: string; filhos?: string[]; botoes?: Botao[]; exigeExtensao?: boolean }

const NOS: Record<string, No> = {
  fila: { id: "fila", icone: "📥", rotulo: "Mandar uma fila de processos", exigeExtensao: true,
    resposta: "Ótima escolha: a fila trabalha por você. No painel da extensão você marca os processos e escolhe quem analisa (Agaia, outra IA ou Studio). Enquanto ela roda, você trabalha nas minutas pelo Histórico.",
    botoes: [{ rotulo: "Abrir o painel da extensão", acao: "ext-painel" }, { rotulo: "Abrir meu Histórico", acao: "historico" }] },
  lupa_fila: { id: "lupa_fila", icone: "🔎", rotulo: "Mandar uma fila para a Lupa", exigeExtensao: true,
    resposta: "No painel da extensão, marque os processos e escolha o modo Lupa. Os resultados chegam ao Histórico, um a um, para você ler os alertas.",
    botoes: [{ rotulo: "Abrir o painel da extensão", acao: "ext-painel" }, { rotulo: "Abrir meu Histórico", acao: "historico" }] },
  lupa: { id: "lupa", icone: "⚖️", rotulo: "Conferir uma minuta na Lupa",
    resposta: "A Lupa do Magistrado audita a minuta do assessor contra os autos, mostrando cada ponto de atenção e onde ele está no processo.",
    botoes: [{ rotulo: "Abrir a Lupa do Magistrado", acao: "lupa" }] },
  avulso: { id: "avulso", icone: "📄", rotulo: "Analisar um processo só",
    resposta: "Na tela inicial: escolha o prompt, anexe o PDF do processo (ou cole o texto) e clique em “Executar Prompt”. O resultado aparece ao lado.",
    botoes: [{ rotulo: "Ir para a análise", acao: "analisar" }] },
  historico: { id: "historico", icone: "🗂️", rotulo: "Minutas prontas (Histórico)",
    resposta: "No Histórico você abre a minuta, refina pelo chat, copia, gera DOCX ou PDF, lança no Projudi e marca como lançada.",
    botoes: [{ rotulo: "Abrir o Histórico", acao: "historico" }] },
  audiencias: { id: "audiencias", icone: "🏛️", rotulo: "Audiências", filhos: ["mesa", "sentenca_individual", "sentenca_fila"],
    resposta: "Sobre audiências, o que você precisa?" },
  mesa: { id: "mesa", icone: "📋", rotulo: "Mesa de audiências (pauta e ata)",
    resposta: "Prepare a audiência com a ata prévia e o apoio do sistema. A pauta do Projudi vem pela extensão.",
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }] },
  sentenca_individual: { id: "sentenca_individual", icone: "🎙️", rotulo: "Sentença com vídeo: um processo",
    resposta: "Na Mesa de audiências, aba “Mutirão Expresso”: anexe os autos e o vídeo da audiência. O sistema escuta o vídeo e escreve a sentença.",
    botoes: [{ rotulo: "Abrir a Mesa de audiências", acao: "mesa" }] },
  sentenca_fila: { id: "sentenca_fila", icone: "🎬", rotulo: "Sentenças com vídeo: várias, em fila", exigeExtensao: true,
    resposta: "Na pauta de audiências da extensão você escolhe as audiências que têm vídeo e manda sentenciar. As sentenças chegam ao Histórico.",
    botoes: [{ rotulo: "Abrir a pauta da extensão", acao: "ext-pauta" }, { rotulo: "Abrir meu Histórico", acao: "historico" }] },
  outras: { id: "outras", icone: "🧰", rotulo: "Outras funções", filhos: ["turbo", "grandes", "teses", "conhecer"],
    resposta: "Estas são as outras funções do sistema. Qual você quer?" },
  turbo: { id: "turbo", icone: "⚡", rotulo: "Análise rápida (Turbo)", resposta: "O Turbo faz a minuta em uma etapa só, para quando você quer o resultado logo.", botoes: [{ rotulo: "Abrir o Turbo", acao: "turbo" }] },
  grandes: { id: "grandes", icone: "📚", rotulo: "Processo muito grande", resposta: "Autos com muitas páginas são lidos em lotes, em segundo plano, sem travar o resto. A minuta vai para o Histórico.", botoes: [{ rotulo: "Ver processos em lotes", acao: "gigantes" }] },
  teses: { id: "teses", icone: "📖", rotulo: "Teses, modelos e súmulas", resposta: "Cadastre as teses e os modelos de decisão do gabinete; depois aplique um modelo em qualquer minuta pronta.", botoes: [{ rotulo: "Abrir Teses & Modelos", acao: "teses" }] },
  conhecer: { id: "conhecer", icone: "🧭", rotulo: "Conhecer o sistema", resposta: "Quer conhecer melhor o sistema? Abra o manual completo ou o guia passo a passo do dia a dia.", botoes: [{ rotulo: "Abrir o manual", acao: "manual" }, { rotulo: "Guia do assessor", acao: "guia" }] },
};

const RAIZ: Record<Perfil, string[]> = {
  assessor: ["fila", "avulso", "historico", "audiencias", "outras"],
  magistrado: ["lupa", "lupa_fila", "fila", "historico", "avulso", "audiencias", "outras"],
};

// caminho (pais → filho) até uma opção, para abrir direto na resposta certa
const caminhoDe = (id: string): string[] => { const pai = Object.values(NOS).find((n) => n.filhos?.includes(id)); return pai ? [pai.id, id] : [id]; };
// palavras-chave locais: respondem na hora, sem IA; se não bater, pergunta à IA
const CHAVES: [string, RegExp][] = [
  ["lupa_fila", /lupa.*(fila|lote|v[aá]rios)|(fila|lote).*lupa/i], ["lupa", /lupa|conferir.*minuta|auditar|revisar.*assessor/i],
  ["sentenca_fila", /(v[ií]deos?|audi[eê]ncias?).*(fila|lote|v[aá]rias|v[aá]rios)|(fila|lote).*(v[ií]deo|audi[eê]ncia)/i], ["sentenca_individual", /v[ií]deo|mutir[aã]o|sentenciar.*audi[eê]ncia/i],
  ["mesa", /pauta|ata|audi[eê]ncia/i], ["fila", /fila|lote|v[aá]rios processos|em massa|esteira/i],
  ["grandes", /grande|muitas p[aá]ginas|gigante|volumos/i], ["turbo", /turbo|r[aá]pid/i], ["teses", /tese|modelo|s[uú]mula|paradigma/i],
  ["historico", /hist[oó]rico|minutas? prontas?|copiar|baixar|docx|lan[cç]ar/i], ["conhecer", /manual|guia|ajuda|conhecer|como funciona/i],
  ["avulso", /um processo|avulso|analisar|minutar|gerar minuta|sentença|decis[aã]o|despacho/i],
];
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const chaveDia = (uid: string) => `assessor_assistente_dia_${uid || "anon"}`;
const lerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

interface Props { aoAcao: (acao: AcaoAssistente) => void }

export const AssistenteBoasVindas: React.FC<Props> = ({ aoAcao }) => {
  const { user, userProfile, isJudge } = useAuth() as any;
  const uid: string = user?.uid || "";
  const nome = String(userProfile?.name || user?.displayName || "").split(" ")[0];
  const perfil: Perfil = isJudge ? "magistrado" : "assessor";      // vem SÓ do cadastro: o assessor nunca vê as opções do magistrado
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [trilha, setTrilha] = useState<string[]>([]);      // escolhas feitas, em ordem
  const [aviso, setAviso] = useState<{ no: string; texto: React.ReactNode } | null>(null);      // resposta da extensão (aparece na própria conversa)
  const [versaoExt, setVersaoExt] = useState<string>(() => extensaoInstalada());
  const fimRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [falas, setFalas] = useState<{ voce: string; bot: string }[]>([]);      // perguntas digitadas e as respostas
  const [pensando, setPensando] = useState(false);

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

  // reabrir pelo botão do menu lateral: sempre do começo da conversa
  useEffect(() => {
    const abrir = () => { setAberto(true); setMinimizado(false); setTrilha([]); setAviso(null); setFalas([]); };
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

  useEffect(() => { fimRef.current?.scrollIntoView?.({ block: "end" }); }, [trilha, aviso, aberto, minimizado, falas, pensando]);

  const raiz = useMemo(() => RAIZ[perfil].map((id) => NOS[id]), [perfil]);
  const atual = trilha.length ? NOS[trilha[trilha.length - 1]] : null;
  const opcoesAgora = atual ? (atual.filhos || []).map((id) => NOS[id]) : raiz;

  const fechar = () => { try { localStorage.setItem(chaveDia(uid), hojeLocal()); } catch { /* sem armazenamento: volta na próxima abertura */ } setAberto(false); };
  const reabrir = () => { setTrilha([]); setAviso(null); setFalas([]); setMinimizado(false); };      // a pílula leva ao começo da conversa
  const escolher = (id: string) => { setAviso(null); setTrilha((t) => [...t, id]); };
  const voltar = () => { setAviso(null); setTrilha((t) => t.slice(0, -1)); };

  // botões da extensão abrem a página dela numa aba nova; os demais abrem a função aqui dentro do Studio
  const clicar = (no: string, acao: AcaoAssistente) => {
    if (acao === "ext-painel" || acao === "ext-pauta") {
      const r = abrirPaginaDaExtensao(acao === "ext-painel" ? "painel.html" : "pauta.html");
      if (r === "aberto") { setMinimizado(true); return; }
      if (r === "sem-extensao") {
        try { window.open(URL_EXTENSAO_CHROME_STORE, "_blank", "noopener"); } catch { /* sem pop-up */ }
        setAviso({ no, texto: <>A extensão <b>Conclusões Projudi</b> não foi detectada neste navegador. Abri a página de instalação em outra aba; depois de instalar, volte aqui e clique de novo.</> });
        return;
      }
      setAviso({ no, texto: <>Para abrir {acao === "ext-painel" ? "o painel completo" : "a pauta de audiências"}, clique no ícone <b>Conclusões Projudi</b> na barra do navegador (se não aparecer, clique no ícone de peça de quebra-cabeça 🧩 e fixe a extensão) e depois em <b>{acao === "ext-painel" ? "Abrir painel completo" : "Pauta de audiências"}</b>. Com a extensão na versão 2.0.6 ou mais nova, este botão abre direto.</> });
      return;
    }
    aoAcao(acao); setMinimizado(true);
  };

  const permitido = (id: string) => RAIZ[perfil].includes(id) || RAIZ[perfil].some((r) => NOS[r].filhos?.includes(id));
  const enviar = async () => {
    const t = texto.trim(); if (t.length < 3 || pensando) return;
    setTexto(""); setAviso(null); setPensando(true);
    let id = (CHAVES.find(([k, re]) => permitido(k) && re.test(t)) || [""])[0], resp = "";
    if (!id) {
      try {
        const r = await fetch("/api/assistente-sugerir", { method: "POST", headers: getApiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ perfil, texto: t }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.id && d.id !== "nenhuma" && permitido(d.id)) { id = d.id; resp = d.resposta || ""; }
      } catch { /* sem rede/IA: cai na mensagem abaixo */ }
    }
    setPensando(false);
    if (!id) { setFalas((f) => [...f, { voce: t, bot: "Não entendi bem. Escolha uma das opções abaixo ou escreva de outro jeito (ex.: “mandar fila de processos”, “sentença com vídeo”)." }]); return; }
    setFalas((f) => [...f, { voce: t, bot: resp || "Entendi! Veja abaixo o que abrir." }]);
    setTrilha(caminhoDe(id));
  };

  if (!aberto) return null;

  if (minimizado) {
    return (
      <button onClick={reabrir} data-testid="assistente-pilula" title="Abrir o assistente do dia"
        className="fixed right-3 bottom-14 max-md:bottom-16 z-[9000] flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-xl border border-indigo-300 cursor-pointer">
        <MessageCircle className="w-4 h-4" /> O que fazer hoje?
      </button>
    );
  }

  const Balao: React.FC<{ de: "bot" | "voce"; children: React.ReactNode; testid?: string }> = ({ de, children, testid }) => (
    <div className={`flex ${de === "voce" ? "justify-end" : "justify-start"}`}>
      <div data-testid={testid} className={`max-w-[92%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${de === "voce" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>{children}</div>
    </div>
  );

  return (
    <aside data-testid="assistente-boas-vindas" aria-label="Assistente do dia"
      className="fixed right-3 bottom-14 max-md:bottom-16 z-[9000] w-[min(94vw,22rem)] max-h-[min(34rem,calc(100vh-8rem))] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl border border-indigo-200 overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600 text-white shrink-0">
        <Sparkles className="w-4 h-4 shrink-0" />
        <div className="min-w-0 flex-1 text-sm font-extrabold leading-tight">Assistente do dia</div>
        <button onClick={() => setMinimizado(true)} className="p-1 rounded hover:bg-white/20 cursor-pointer" title="Minimizar" aria-label="Minimizar" data-testid="assistente-minimizar"><Minus className="w-4 h-4" /></button>
        <button onClick={fechar} className="p-1 rounded hover:bg-white/20 cursor-pointer" title="Fechar (volta amanhã)" aria-label="Fechar" data-testid="assistente-fechar"><X className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        <Balao de="bot" testid="assistente-saudacao">{nome ? `Olá, ${nome}! ` : "Olá! "}<b>O que você quer fazer hoje?</b></Balao>

        {falas.map((f, i) => (<React.Fragment key={"f" + i}><Balao de="voce">{f.voce}</Balao><Balao de="bot" testid="assistente-resposta-texto">{f.bot}</Balao></React.Fragment>))}
        {pensando && <Balao de="bot" testid="assistente-pensando">Entendendo seu pedido…</Balao>}

        {trilha.map((id, i) => {
          const no = NOS[id], ultimo = i === trilha.length - 1;
          return (
            <React.Fragment key={id + i}>
              <Balao de="voce">{no.icone} {no.rotulo}</Balao>
              <Balao de="bot" testid={`assistente-resposta-${id}`}>
                {no.resposta}
                {no.exigeExtensao && !versaoExt && <div className="mt-1 text-[12px] text-amber-800">⚠ Precisa da extensão instalada.</div>}
              </Balao>
              {ultimo && no.botoes && (
                <div className="flex flex-col gap-2 pl-1">
                  {no.botoes.map((b, k) => (
                    <button key={b.acao + b.rotulo} onClick={() => clicar(id, b.acao)} data-testid={`assistente-acao-${b.acao}`}
                      className={`px-3 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer text-left ${k === 0 ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300"}`}>
                      {k === 0 ? "▶ " : ""}{b.rotulo}
                    </button>
                  ))}
                </div>
              )}
              {ultimo && aviso && aviso.no === id && <Balao de="bot" testid="assistente-msg-extensao">{aviso.texto}</Balao>}
            </React.Fragment>
          );
        })}

        {opcoesAgora.length > 0 && (
          <div className="grid grid-cols-1 gap-2 pt-0.5" data-testid="assistente-opcoes">
            {opcoesAgora.map((n, i) => {
              const principal = !atual && i === 0;
              return (
                <button key={n.id} onClick={() => escolher(n.id)} data-testid={`assistente-op-${n.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-[13px] font-bold cursor-pointer transition ${principal ? "bg-indigo-50 border-indigo-400 text-indigo-900 hover:bg-indigo-100" : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"}`}>
                  <span className="text-lg leading-none" aria-hidden>{n.icone}</span>
                  <span className="flex-1">{n.rotulo}</span>
                  {principal && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">PRINCIPAL</span>}
                </button>
              );
            })}
          </div>
        )}

        {trilha.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <button onClick={voltar} data-testid="assistente-voltar" className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold cursor-pointer flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Voltar</button>
            <button onClick={() => { setTrilha([]); setAviso(null); }} data-testid="assistente-inicio" className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold cursor-pointer flex items-center gap-1"><Home className="w-3.5 h-3.5" /> Início</button>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="px-3 py-2 border-t border-slate-200 flex items-center gap-2 shrink-0 bg-white">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} placeholder="Ou escreva o que você precisa…" data-testid="assistente-campo"
          className="flex-1 min-w-0 px-3 py-2 rounded-full border border-slate-300 text-[13px] focus:outline-none focus:border-indigo-500" />
        <button type="submit" disabled={pensando || texto.trim().length < 3} data-testid="assistente-enviar" aria-label="Enviar" className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white cursor-pointer"><Send className="w-4 h-4" /></button>
      </form>

      <div className="px-3 py-1.5 border-t border-slate-100 text-[11px] shrink-0 bg-slate-50" data-testid="assistente-extensao">
        {versaoExt
          ? <span className="text-emerald-700">✔ Extensão instalada (versão {versaoExt})</span>
          : <span className="text-amber-800">⚠ Extensão não detectada. <a href={URL_EXTENSAO_CHROME_STORE} target="_blank" rel="noreferrer" className="underline font-bold" data-testid="assistente-instalar">Instalar</a></span>}
      </div>
    </aside>
  );
};
