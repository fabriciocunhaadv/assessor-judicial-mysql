import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { SeletorServentia } from "./SeletorServentia";
import { lerEEnviar, NOME_EVENTO_CALIBRAGEM, registrarHospedeiroCalibragem, type DetalheEvento, type ResultadoEnvio } from "../utils/calibragemEnvio";

// Janela única do app (montada uma vez no App): aparece ao MARCAR COMO LANÇADO ou ao EXCLUIR uma minuta (qualquer motor) e oferece enviar a minuta para a calibragem.
// O texto não fala de "super administrador": para o usuário é o administrador do sistema.
type Fase = "pergunta" | "lendo" | "fim";
export function CalibragemEnvioHost() {
  const [atual, setAtual] = useState<DetalheEvento | null>(null);
  const [fase, setFase] = useState<Fase>("pergunta");
  const [andamento, setAndamento] = useState("");
  const [res, setRes] = useState<ResultadoEnvio | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const sair = registrarHospedeiroCalibragem();
    const ouvir = (e: Event) => { setAtual((e as CustomEvent<DetalheEvento>).detail); setFase("pergunta"); setRes(null); setAndamento(""); };
    window.addEventListener(NOME_EVENTO_CALIBRAGEM, ouvir);
    return () => { window.removeEventListener(NOME_EVENTO_CALIBRAGEM, ouvir); sair(); ctl.current?.abort(); };
  }, []);

  const fechar = useCallback((d: "continuar" | "cancelar") => { const a = atual; setAtual(null); a?.resolver(d); }, [atual]);
  const enviar = useCallback(async (serventiaUrl?: string) => {
    if (!atual) return;
    setFase("lendo"); setAndamento("Lendo a minuta no Projudi…"); ctl.current = new AbortController();
    const r = await lerEEnviar(atual.pedido, setAndamento, ctl.current.signal, serventiaUrl);
    setRes(r); setFase("fim");
  }, [atual]);

  if (!atual) return null;
  const excluir = atual.pedido.modo === "excluir";
  const acao = excluir ? "excluir" : "marcar como lançado";
  const mensagemFim = (): { ok: boolean; titulo: string; texto: string } => {
    switch (res?.status) {
      case "enviado": return { ok: true, titulo: "Enviado para a calibragem", texto: "Pronto: a minuta que você lançou no Projudi e a que o sistema gerou foram enviadas para comparação. Obrigado por ajudar a melhorar o sistema." };
      case "extensao-ausente": return { ok: false, titulo: "Extensão não encontrada", texto: "Para enviar é preciso ter a extensão Conclusões Projudi instalada e atualizada neste navegador. Nada foi enviado." };
      case "extensao-antiga": return { ok: false, titulo: "Atualize a extensão", texto: "A extensão Conclusões Projudi deste navegador está desatualizada. Atualize para a versão 3.0.10 ou mais nova (e recarregue esta página) para poder enviar. Nada foi enviado." };
      case "sem-minuta": return { ok: false, titulo: "Minuta não encontrada no Projudi", texto: "Não achei, no Projudi, a minuta lançada deste processo: ela precisa estar salva na pré-análise (Salvar Texto Parcial). Como ela não foi lançada lá, nada foi enviado." };
      case "cancelado": return { ok: false, titulo: "Leitura cancelada", texto: "Nada foi enviado." };
      default: return { ok: false, titulo: "Não consegui enviar", texto: `${res && res.status === "erro" ? res.mensagem : "Falha desconhecida."} Nada foi enviado.` };
    }
  };

  return (
    <div className="fixed inset-0 z-[100010] bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Enviar para a calibragem" data-testid="calibragem-janela">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <FlaskConical className="w-5 h-5 text-emerald-300" />
          <h2 className="font-black text-sm" data-testid="calibragem-titulo">{fase === "fim" ? mensagemFim().titulo : excluir ? "Antes de excluir: enviar para a calibragem?" : "Enviar para a calibragem?"}</h2>
          {fase === "pergunta" && <button onClick={() => fechar("cancelar")} aria-label="Fechar" className="ml-auto p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>}
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-[11px] text-slate-400">Processo <strong className="text-slate-200">{atual.pedido.processo}</strong></p>
          {fase === "pergunta" && (
            <>
              <p className="leading-relaxed" data-testid="calibragem-texto">Você pode ajudar a melhorar o sistema. Se enviar, o sistema vai <strong>ler, no Projudi, a minuta que você cadastrou</strong> (o texto salvo na pré-análise) e juntar a <strong>minuta que ele mesmo gerou</strong>. As duas vão para o <strong>administrador do sistema</strong>, que compara para ver erros e acertos e como a minuta deveria ter ficado, e assim calibrar o sistema.</p>
              <ul className="text-[11px] text-slate-400 list-disc pl-5 space-y-0.5">
                <li>Só é enviado se a minuta estiver mesmo lançada no Projudi (salva na pré-análise).</li>
                <li>É preciso a extensão Conclusões Projudi atualizada e o Projudi aberto e logado.</li>
                <li>O texto das minutas, com os dados do processo, fica guardado por 30 dias e depois é apagado.</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => void enviar(undefined)} data-testid="calibragem-enviar" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">Enviar para calibragem e {acao}</button>
                <button onClick={() => fechar("continuar")} data-testid="calibragem-sem-enviar" className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-xs font-bold cursor-pointer">{excluir ? "Excluir sem enviar" : "Só marcar como lançado"}</button>
                <button onClick={() => fechar("cancelar")} data-testid="calibragem-cancelar" className="px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-xs cursor-pointer">Cancelar</button>
              </div>
            </>
          )}
          {fase === "lendo" && (
            <>
              <div className="flex items-center gap-2 text-sky-200 text-xs" data-testid="calibragem-lendo"><Loader2 className="w-4 h-4 animate-spin" /> {andamento}</div>
              <p className="text-[11px] text-slate-400">Pode levar até um minuto. Não feche o Projudi.</p>
              <button onClick={() => ctl.current?.abort()} className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 text-xs cursor-pointer">Cancelar a leitura</button>
            </>
          )}
          {fase === "fim" && (() => { const m = mensagemFim(); return (
            <>
              <div className={`flex gap-2 rounded-xl border p-3 text-xs ${m.ok ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-100" : "border-amber-600/50 bg-amber-950/30 text-amber-100"}`} data-testid="calibragem-resultado">
                {m.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}<span>{m.texto}</span>
              </div>
              {(res?.status === "sem-minuta" || res?.status === "erro") && <SeletorServentia processo={atual.pedido.processo} rotuloBotao="Tentar de novo e enviar" aoTentar={(url) => void enviar(url)} />}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => fechar("continuar")} data-testid="calibragem-concluir" className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer">{excluir ? "Concluir e excluir a minuta" : "Concluir e marcar como lançado"}</button>
                {res?.status === "erro" && <button onClick={() => void enviar(undefined)} className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-xs cursor-pointer">Tentar de novo</button>}
              </div>
            </>
          ); })()}
        </div>
      </div>
    </div>
  );
}
