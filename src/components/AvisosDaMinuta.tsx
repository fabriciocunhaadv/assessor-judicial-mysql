import React, { useState, useEffect } from "react";
import type { GenerationResult } from "../types";
import { AvisoAutosReduzidos } from "./AvisoAutosReduzidos";
import { AvisoCoberturaLeitura } from "./AvisoCoberturaLeitura";
import { AvisoGigante } from "./AvisoGigante";
import { AvisoPromptInjection } from "./AvisoPromptInjection";
import { AvisoFontesConsultadas } from "./AvisoFontesConsultadas";
import { AvisoGrounding, rotuloGrounding } from "./AvisoGrounding";
import { conferirComMapa } from "../utils/mapaDoProcesso";

type Tom = "ok" | "atencao" | "perigo" | "info";
const COR: Record<Tom, string> = {
  ok: "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100",
  atencao: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100",
  perigo: "bg-red-50 border-red-400 text-red-900 hover:bg-red-100",
  info: "bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100",
};
interface Item { id: string; rotulo: string; tom: Tom; conteudo: React.ReactNode }

/** Avisos do começo da minuta (alerta de prompt injection, fontes consultadas, leitura dos autos...): ficam RECOLHIDOS em botões; o usuário abre só o que quiser ver. */
export function AvisosDaMinuta({ result }: { result: Partial<GenerationResult> & Record<string, any> }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [rotulos, setRotulos] = useState<boolean>(() => { try { return localStorage.getItem("avisos_dock_nomes") === "1"; } catch { return false; } });
  const alternarRotulos = () => setRotulos((v) => { const n = !v; try { localStorage.setItem("avisos_dock_nomes", n ? "1" : "0"); } catch { /* sem armazenamento */ } return n; });
  const alternar = (id: string) => setAbertos((a) => { const n = new Set(a); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const itens: Item[] = [];
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") setAbertos(new Set()); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);

  const inj = result?.alertaInjecao;
  if (inj && inj.verificado !== false) itens.push({ id: "injecao", tom: inj.total ? "perigo" : "ok", rotulo: inj.total ? `🚨 Alerta de prompt injection (${inj.total})` : "✅ Prompt injection: nada encontrado", conteudo: <AvisoPromptInjection info={inj} /> });

  const f = result?.fontesConsultadas;
  if (f) {
    const atencao = (f.naoLocalizados?.length || 0) + (f.indisponiveis?.length || 0) + (f.locais?.length || 0);
    const partes = [`${f.legislacao?.length || 0} artigo(s) conferido(s)`, ...(atencao ? [`${atencao} com atenção`] : [])];
    itens.push({ id: "fontes", tom: atencao ? "atencao" : (f.legislacao?.length || f.precedentes?.length ? "ok" : "info"), rotulo: (f.legislacao?.length || 0) + atencao + (f.precedentes?.length || 0) === 0 ? "📚 Fontes consultadas · nenhum artigo de lei citado nos autos" : `📚 Fontes consultadas · ${partes.join(" · ")}`, conteudo: <AvisoFontesConsultadas info={f} /> });
  }

  // Pesquisa ao vivo (Grounding): só há status na resposta FINAL (a 1ª etapa não pesquisa); mostra de relance se foi executada, com os links
  const gs = result?.groundingStatus as string | undefined;
  if (gs) itens.push({ id: "grounding", tom: gs === "ok" ? "ok" : gs === "desligado" ? "info" : "atencao", rotulo: rotuloGrounding(gs, (result?.groundingSources || []).length), conteudo: <AvisoGrounding info={{ status: gs, fontes: result?.groundingSources || [], mensagem: result?.groundingMensagem }} /> });

  const mp = result?.mapaProcesso;
  if (mp?.estadoAtual) {
    const m: any = result?.minute || {};
    const textoMinuta = [m.relatorio, m.fundamentacao, m.dispositivo, m.fullFormattedText].filter(Boolean).join("\n");
    const avisos = conferirComMapa(textoMinuta, mp);
    itens.push({ id: "mapa", tom: avisos.length ? "info" : "ok", rotulo: avisos.length ? `🗺️ Mapa do processo · ${avisos.length} ponto(s) para conferir` : "🗺️ Mapa do processo", conteudo: (
      <div data-testid="aviso-mapa" className="max-w-4xl mx-auto rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 space-y-1.5">
        <div><strong>Mapa do processo</strong> ({mp.movimentacoes?.movs} movimentações, até a Mov. {mp.movimentacoes?.ultima}): o sistema leu todos os autos para decidir de forma coerente com o estado atual.</div>
        <div><strong>O que está para ser decidido agora:</strong> {mp.estadoAtual.questaoAtual || "—"}</div>
        {mp.estadoAtual.pendencias?.length > 0 && <div><strong>Pendências:</strong> {mp.estadoAtual.pendencias.join("; ")}</div>}
        {mp.estadoAtual.vigentes?.length > 0 && <div><strong>Em vigor:</strong> {mp.estadoAtual.vigentes.join("; ")}</div>}
        {avisos.length > 0 && <ul className="list-disc pl-4 space-y-0.5 text-sky-800">{avisos.map((x) => <li key={x.codigo}>{x.texto}</li>)}</ul>}
        <div className="text-[11px] text-sky-700">É um apoio de leitura, não uma regra: confira com os autos.</div>
      </div>
    ) });
  }

  if (result?.gigante?.refeitaPorFase) itens.push({ id: "refeita-fase", tom: "info", rotulo: "🔁 Minuta refeita pela fase do processo", conteudo: (
    <div data-testid="aviso-refeita-fase" className="max-w-4xl mx-auto rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">A primeira versão voltou a sentenciar um processo que já tinha sentença. O sistema refez a minuta como <strong>decisão sobre o que veio depois da sentença</strong>. Confira se é o ato que você queria.</div>
  ) });
  if (result?.gigante?.semMapa) itens.push({ id: "sem-mapa", tom: "atencao", rotulo: "🗺️ Sem mapa do processo — confira o ato", conteudo: (
    <div data-testid="aviso-sem-mapa" className="max-w-4xl mx-auto rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Não foi possível montar o mapa do processo</strong> (fase atual e o que já foi decidido). Esta minuta foi redigida só com o dossiê: <strong>confira se o ato cabível agora é mesmo este</strong> (por exemplo, se o processo já foi sentenciado, o ato costuma ser a decisão sobre o que veio depois) e se as citações Mov./Arq./Pág. batem com o Projudi.
    </div>
  ) });
  if (result?.gigante) itens.push({ id: "gigante", tom: "info", rotulo: "📚 Processo gigante", conteudo: <AvisoGigante info={result.gigante} /> });
  if (result?.autosReduzidos) { const perdeu = (result.autosReduzidos.omitidas?.length || 0) + (result.autosReduzidos.abreviadas?.length || 0) > 0; itens.push({ id: "reduzidos", tom: perdeu ? "atencao" : "ok", rotulo: perdeu ? "✂️ Autos reduzidos" : "✔ Autos compactados (nenhuma página omitida)", conteudo: <AvisoAutosReduzidos info={result.autosReduzidos} /> }); }

  const c = result?.coberturaLeitura;
  if (c) {
    const incompleta = (c.lacunas || []).length > 0 || !!c.textoCortado;
    if (incompleta || c.paginasOcr || c.paginasImagem) itens.push({ id: "cobertura", tom: incompleta ? "perigo" : "ok", rotulo: incompleta ? "⚠️ Leitura incompleta dos autos" : "✅ Leitura completa dos autos", conteudo: <AvisoCoberturaLeitura info={c} /> });
  }

  const loc = result?.avisoLocalizacao;
  if (loc && loc.movsInexistentes?.length > 0) itens.push({
    id: "localizacao", tom: "atencao", rotulo: `📍 Conferir localização (${loc.movsInexistentes.length})`,
    conteudo: <div data-testid="aviso-localizacao" className="max-w-4xl mx-auto rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Conferir localização:</strong> a minuta cita {loc.movsInexistentes.map((n: number) => `Mov. ${n}`).join(", ")}, que não aparece(m) nos carimbos dos autos enviados. Confira antes de usar.</div>,
  });

  const al = result?.alertasLegislacao;
  if (al && al.length > 0) itens.push({ id: "legislacao", tom: "perigo", rotulo: `⚖️ Conferir a legislação citada (${al.length})`, conteudo: (
    <div data-testid="alerta-legislacao" className="max-w-4xl mx-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 space-y-1">
                <strong>Conferir a legislação citada (Planalto):</strong>
                <ul className="list-disc list-inside">
                  {al.map((a: any, i: number) => (
                    <li key={i}>{a.tipo === "cpc1973" ? (a.nota || "Referência ao CPC de 1973.") : <>art. {a.artigo} ({a.lei}): <strong>{a.tipo === "revogado" ? "REVOGADO" : a.tipo === "vetado" ? "VETADO" : "inexistente"}</strong>{a.nota ? ` (${a.nota})` : ""}</>}</li>
                  ))}
                </ul>
                <span>Corrija a minuta antes de assinar (a conferência é automática e pode errar; confirme no texto oficial).</span>
              </div>
  ) });

  const caixa = (cor: string, testid: string, children: React.ReactNode) => <div data-testid={testid} className={`max-w-4xl mx-auto rounded-lg border px-3 py-2 text-xs ${cor}`}>{children}</div>;
  const comp = result?.avisoCompetencia;
  if (comp) itens.push({ id: "competencia", tom: "perigo", rotulo: "⚖️ Conferir competência do juízo", conteudo: caixa("border-red-400 bg-red-50 text-red-900", "aviso-competencia", <><strong>Conferir competência:</strong> o juízo da capa ({comp.juizo}) parece incompatível com o objeto: {comp.motivo}. Revise o ato antes de usar.</>) });
  const ped = result?.avisoPedidoSemPeca;
  if (ped?.length) itens.push({ id: "pedido-sem-peca", tom: "atencao", rotulo: `🧾 Pedido de parte sem peça (${ped.length})`, conteudo: caixa("border-amber-300 bg-amber-50 text-amber-900", "aviso-pedido-sem-peca", <><strong>Pedido ou manifestação sem localização:</strong> confirme nos autos se existe a peça.<ul className="list-disc pl-5 mt-1">{ped.map((t: string, i: number) => <li key={i}>“{t}”</li>)}</ul></>) });
  const vaz = result?.avisoVazamento;
  if (vaz?.length) itens.push({ id: "vazamento", tom: "atencao", rotulo: "🧹 Título interno na minuta", conteudo: caixa("border-amber-300 bg-amber-50 text-amber-900", "aviso-vazamento", <><strong>Título de etapa interna no texto:</strong> {vaz.join(", ")}. Remova antes de usar.</>) });
  const cit = result?.avisoCitacao;
  if (cit?.length) itens.push({ id: "citacao", tom: "atencao", rotulo: `📍 Arquivo/página inexistente (${cit.length})`, conteudo: caixa("border-amber-300 bg-amber-50 text-amber-900", "aviso-citacao", <><strong>Conferir citação:</strong> {cit.join("; ")} — o arquivo ou a página não existe nos carimbos dos autos enviados.</>) });

  const dd = result?.avisoDescumprimento;
  if (dd) itens.push({ id: "descumprimento", tom: dd.decide && dd.minutaSentenciou === false ? "perigo" : "atencao", rotulo: dd.decide ? "⏱️ Parte não cumpriu determinação" : "⏱️ Conferir cumprimento da determinação", conteudo: caixa(dd.decide && dd.minutaSentenciou === false ? "border-red-400 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900", "aviso-descumprimento", <><strong>{dd.decide ? "Descumprimento de determinação detectado nos autos:" : "Possível cumprimento — confira:"}</strong> {dd.motivo}{dd.decide && <> Ato sugerido: <strong>{dd.atoSugerido}</strong>.{dd.minutaSentenciou === false ? " ATENÇÃO: a minuta gerada não indeferiu a inicial nem extinguiu o processo; confira se o ato certo foi minutado." : ""}</>}</>) });
  const ca = result?.conferenciaArgumentos, matrizArg: any[] = Array.isArray(result?.auditAnalysis?.argumentoVsResposta) ? result.auditAnalysis.argumentoVsResposta : [];
  if (ca && ca.total > 0) {
    const faltam = (ca.semResposta?.length || 0) + (ca.naoLocalizados?.length || 0), marcado = new Set([...(ca.semResposta || []), ...(ca.naoLocalizados || [])].map((x: any) => x.argumento));
    const rotuloRes = (r: string) => ({ acolhido: "acolhido", rejeitado: "rejeitado", prejudicado: "prejudicado", nao_enfrentado: "SEM RESPOSTA" } as any)[r] || r || "—";
    itens.push({ id: "argumentos", tom: faltam ? "atencao" : "info", rotulo: faltam ? `🧩 Argumentos sem resposta (${faltam} de ${ca.total})` : `🧩 Argumentos × Resposta (${ca.total})`, conteudo: caixa(faltam ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-300 bg-sky-50 text-sky-900", "aviso-argumentos",
      <><strong>Argumento × Resposta:</strong> {ca.respondidos} de {ca.total} argumento(s) relevante(s) das partes têm resposta na minuta{faltam ? <>; <strong>{faltam} precisa(m) de conferência</strong> (sem resposta, ou a resposta indicada não foi localizada no texto)</> : ""}.
        <ul className="list-disc pl-5 mt-1">{matrizArg.slice(0, 40).map((x: any, i: number) => <li key={i} className={marcado.has(x.argumento) ? "font-bold text-red-800" : ""}>[{String(x.parte || "").toLowerCase() === "reu" ? "réu" : x.parte || "parte"}] {x.argumento} — <em>{rotuloRes(String(x.resultado || ""))}</em>{x.localizacao ? <span className="opacity-70"> ({x.localizacao})</span> : null}{marcado.has(x.argumento) && x.resultado !== "nao_enfrentado" ? <span className="text-red-700"> — resposta indicada não localizada na minuta</span> : null}</li>)}</ul>
        <div className="mt-1 opacity-70">Conferência automática: pode errar. Confira a minuta antes de assinar.</div></>) });
  }
  const cf = result?.conferenciaFase;
  if (cf && (cf.avisos?.length || cf.tesesOmitidas)) {
    const pendente = !!cf.avisos?.length && !cf.resolvido;
    itens.push({ id: "fase", tom: pendente ? "perigo" : "info", rotulo: pendente ? "🧭 Minuta pode estar fora da fase" : cf.refeita ? "🧭 Minuta corrigida pela fase" : "🧭 Conferida com a fase", conteudo: caixa(pendente ? "border-red-400 bg-red-50 text-red-900" : "border-sky-300 bg-sky-50 text-sky-900", "aviso-fase",
      <><strong>Fase do processo (lida do quadro de movimentações): {String(cf.fase).replace("_", "-")}</strong> <span className="opacity-70">(confiança {cf.confianca})</span>.
        {cf.avisos?.length ? <ul className="list-disc pl-5 mt-1">{cf.avisos.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : null}
        {pendente ? <div className="mt-1">{cf.refeita ? "O sistema tentou refazer uma vez e o problema continuou: " : ""}confira o ato antes de assinar; a conferência é automática e pode errar.</div> : cf.refeita ? <div className="mt-1">O sistema refez a minuta uma vez para ajustá-la à fase e a nova versão passou na conferência.</div> : null}
        {cf.tesesOmitidas ? <div className="mt-1">{cf.tesesOmitidas} tese(s) de mérito do Caderno deixaram de ser enviadas ao motor por causa da fase.</div> : null}
        {cf.sinais?.length ? <div className="mt-1 opacity-70">Sinais: {cf.sinais.join("; ")}.</div> : null}</>) });
  }
  const prof = result?.avisoProfundidade;
  if (prof?.length) itens.push({ id: "profundidade", tom: "perigo", rotulo: "⚠️ Minuta curta (contingência)", conteudo: caixa("border-red-400 bg-red-50 text-red-900", "aviso-profundidade", <><strong>Minuta gerada em contingência:</strong> {prof[0]}</>) });
  const fl = result?.avisoFundamentoLegal;
  if (fl?.length) itens.push({ id: "fundamento-legal", tom: "atencao", rotulo: `📚 Fundamento do indeferimento (${fl.length})`, conteudo: caixa("border-amber-300 bg-amber-50 text-amber-900", "aviso-fundamento-legal", <><strong>Conferir o fundamento legal:</strong><ul className="list-disc list-inside">{fl.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>) });
  const esp = result?.espolioQualificado;
  if (esp?.length) itens.push({ id: "espolio", tom: "info", rotulo: "🪦 Parte falecida: Espólio", conteudo: caixa("border-sky-300 bg-sky-50 text-sky-900", "aviso-espolio", <><strong>Parte falecida:</strong> no cabeçalho, {esp.join("; ")} passou a constar como “Espólio de …”, porque os autos tratam o nome como espólio. Confira a qualificação.</>) });

  if (itens.length === 0) return null;
  // DOCK FLUTUANTE NA LATERAL DIREITA (a esquerda já tem outros botões): um botão por aviso (ícone + cor do estado + número), o painel abre ao lado e mostra um por vez.
  const aberto = itens.find((x) => abertos.has(x.id));
  const abrirUm = (id: string) => setAbertos((a) => (a.has(id) ? new Set() : new Set([id])));
  const partir = (rotulo: string) => { const m = String(rotulo).match(/^(\S+)\s+(.*)$/); return { icone: m ? m[1] : "•", nome: m ? m[2] : String(rotulo) }; };
  const contagem = (nome: string) => { const m = nome.match(/\((\d+)/); return m ? m[1] : ""; };
  const nAtencao = itens.filter((x) => x.tom === "perigo" || x.tom === "atencao").length;
  return (
    <div className="print:hidden relative md:sticky md:top-52 md:mr-1.5 md:z-30">
      <nav data-testid="avisos-da-minuta" aria-label="Avisos da minuta" className={`flex flex-row items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-white/95 backdrop-blur border border-slate-300 shadow-xl md:flex-col md:items-stretch md:overflow-x-hidden md:overflow-y-auto md:max-h-[calc(100vh-14rem)] ${rotulos ? "" : "md:w-11"}`}>
        <button type="button" onClick={alternarRotulos} data-testid="avisos-alternar-nomes" title={rotulos ? "Mostrar só os ícones" : "Mostrar os nomes dos avisos"}
          className="shrink-0 flex flex-row sm:flex-col items-center justify-center gap-1 sm:gap-0.5 text-[8px] font-extrabold uppercase tracking-normal text-slate-500 hover:text-slate-900 cursor-pointer px-1 pb-0.5 leading-none">
          <span>Avisos</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] ${nAtencao ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700"}`}>{nAtencao || itens.length}</span>
        </button>
        {itens.map((it) => {
          const { icone, nome } = partir(it.rotulo), n = contagem(nome), ativo = abertos.has(it.id);
          return (
            <button key={it.id} type="button" data-testid={`chip-${it.id}`} aria-expanded={ativo} aria-label={it.rotulo} title={it.rotulo} onClick={() => abrirUm(it.id)}
              className={`relative shrink-0 flex items-center gap-2 rounded-xl border cursor-pointer transition ${COR[it.tom]} ${rotulos ? "px-2.5 py-1.5 min-h-9 text-left" : "w-9 h-9 justify-center"} ${ativo ? "ring-2 ring-offset-1 ring-indigo-400" : ""}`}>
              <span className="text-base leading-none shrink-0">{icone}</span>
              {rotulos && <span className="text-[11px] font-bold leading-tight max-w-[200px]">{nome}</span>}
              {!rotulos && n ? <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-white text-[9px] font-extrabold flex items-center justify-center">{n}</span> : null}
              {!rotulos && (it.tom === "perigo" || it.tom === "atencao") && !n ? <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${it.tom === "perigo" ? "bg-red-500" : "bg-amber-500"}`} /> : null}
            </button>
          );
        })}
      </nav>
      <div hidden={!aberto} data-testid="avisos-painel-flutuante" role="dialog" aria-label={aberto ? aberto.rotulo : "Aviso"}
        className="absolute z-40 right-0 bottom-full mb-2 w-[min(94vw,480px)] max-h-[60vh] overflow-y-auto rounded-xl bg-white border border-slate-300 shadow-2xl md:bottom-auto md:top-0 md:mb-0 md:right-full md:mr-2 md:max-h-[calc(100vh-14rem)]">
        {aberto && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-extrabold text-slate-800">{aberto.rotulo}</span>
            <button type="button" onClick={() => setAbertos(new Set())} aria-label="Fechar o aviso" data-testid="avisos-fechar" className="text-slate-500 hover:text-slate-900 cursor-pointer text-sm font-bold px-1">✕</button>
          </div>
        )}
        {itens.map((it) => <div key={it.id} hidden={!abertos.has(it.id)} data-testid={`painel-${it.id}`} className="p-2">{it.conteudo}</div>)}
      </div>
    </div>
  );
}
