import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiHeaders } from "../utils/apiKeyManager";
import { extractTextFromPdf } from "../utils/pdfExtractor";
import { extensaoSabeBuscarFontes, versaoDaExtensao, pedirFontesPelaExtensao, ligarEntregasDeFontes, type EntregaFonte, type FimDaBusca } from "../utils/leisPelaExtensao";

export interface FontePendente { id: string; tipo: string; esfera: string; ente: string; numero: string; ano: number; orgao: string; rotulo: string; status: "pendente" | "ignorada" | "incluida"; ocorrencias: number; motores: Record<string, number>; primeira: number; ultima: number; tentativas: { em: number; via: string; resultado: string }[]; link?: string; nota?: string }
interface SiteBusca { id: string; nome: string; esfera: "estadual" | "municipal"; ente: string; url: string; ativa: boolean }
const ROTULO_MOTOR: Record<string, string> = { normal: "Análise normal", turbo: "Turbo", lupa: "Lupa", gigante: "Gigantes", mesa: "Mesa" };
const TIPOS = ["lei", "lei complementar", "decreto", "decreto-lei", "medida provisória", "emenda constitucional", "resolução", "portaria", "provimento", "instrução normativa", "constituição", "tratado", "súmula", "súmula vinculante", "tema"];
/** Tipos que a extensão consegue procurar e o Studio consegue gravar como lei. Súmulas, temas e tratados seguem outro caminho. */
export const buscavel = (f: Pick<FontePendente, "tipo">) => !["súmula", "súmula vinculante", "tema", "tratado", "constituição"].includes(f.tipo);
const quando = (t: number) => (t ? new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const btn = "px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50";
const FONTE_OFICIAL: Record<string, string> = { STF: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=30", STJ: "https://www.stj.jus.br/sites/portalp/Jurisprudencia/Sumulas", TJGO: "https://transparencia.tjgo.jus.br/jurisprudencia", TNU: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/turma-nacional-de-uniformizacao/sumulas-da-tnu" };

export function FontesPendentesTab({ aoMudarContagem }: { aoMudarContagem?: (pendentes: number) => void }) {
  const [itens, setItens] = useState<FontePendente[] | null>(null), [sites, setSites] = useState<SiteBusca[]>([]), [hosts, setHosts] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<"pendente" | "incluida" | "ignorada" | "todas">("pendente"), [erro, setErro] = useState(""), [msgs, setMsgs] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState<{ pedidoId: string; total: number; feitas: number } | null>(null), [editando, setEditando] = useState<string | null>(null), [novo, setNovo] = useState(false), [editSites, setEditSites] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null), alvo = useRef<string | null>(null), buscaRef = useRef(busca); buscaRef.current = busca;
  const chamar = useCallback(async (caminho: string, opcoes: RequestInit = {}) => {
    const r = await fetch("/api/fontes/pendentes" + caminho, { ...opcoes, headers: { ...(opcoes.body && typeof opcoes.body === "string" ? { "Content-Type": "application/json" } : {}), ...getApiHeaders(), ...((opcoes.headers as any) || {}) } });
    const j = await r.json().catch(() => ({} as any)); if (!r.ok) throw Object.assign(new Error(j.erro || `erro ${r.status}`), { corpo: j }); return j;
  }, []);
  const carregar = useCallback(async () => { try { const j = await chamar(""); setItens(j.itens); setSites(j.fontesBusca); setHosts(j.hostsPermitidos || []); aoMudarContagem?.((j.itens as FontePendente[]).filter((i) => i.status === "pendente").length); } catch (e: any) { setErro(e.message); } }, [chamar, aoMudarContagem]);
  useEffect(() => { void carregar(); }, [carregar]);
  const trocar = (it: FontePendente) => setItens((l) => (l || []).map((x) => (x.id === it.id ? it : x)));

  // inclui o arquivo (da extensão ou enviado à mão): PDF vira texto aqui no navegador; HTML vai como está
  const incluir = async (id: string, nome: string, bytes: Uint8Array, contentType: string, via: string) => {
    const ehPdf = /pdf/i.test(contentType) || /\.pdf$/i.test(nome) || String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
    setMsgs((m) => ({ ...m, [id]: ehPdf ? "Lendo o PDF…" : "Gravando…" }));
    let corpo: Uint8Array = bytes, formato = "";
    if (ehPdf) {
      const t = await extractTextFromPdf(new File([bytes as any], nome || "lei.pdf", { type: "application/pdf" }), undefined, { fullSequential: true });
      if (!t?.text || t.text.trim().length < 100) { setMsgs((m) => ({ ...m, [id]: "Não consegui ler texto deste PDF (se for imagem digitalizada, não há texto)." })); return; }
      corpo = new TextEncoder().encode(t.text); formato = "texto";
    }
    try {
      const j = await chamar(`/${encodeURIComponent(id)}/incluir`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-nome-arquivo": encodeURIComponent(nome), "x-formato": formato, "x-via": via }, body: corpo as any });
      trocar(j.item); setMsgs((m) => ({ ...m, [id]: j.redirecionada ? `✅ Incluída na lista do Planalto (${j.redirecionada.nome}).` : `✅ Incluída em “Outras leis” (${j.lei?.artigos} artigos).` })); void carregar();
    } catch (e: any) { if (e.corpo?.item) trocar(e.corpo.item); setMsgs((m) => ({ ...m, [id]: `❌ ${e.message}` })); }
  };
  const receber = async (e: EntregaFonte) => {
    if (e.erro || !e.bytes) { setMsgs((m) => ({ ...m, [e.id]: `❌ ${e.erro || "sem arquivo"}${e.tentativas?.length ? ` (tentado: ${e.tentativas.slice(-2).join("; ").slice(0, 200)})` : ""}` })); try { trocar((await chamar(`/${encodeURIComponent(e.id)}`, { method: "PUT", body: JSON.stringify({ tentativa: { via: "extensao", resultado: e.erro || "sem arquivo" } }) })).item); } catch { /* ignora */ } }
    else await incluir(e.id, e.nome || "lei.htm", e.bytes, e.contentType, "extensao");
    setBusca((b) => (b ? { ...b, feitas: b.feitas + 1 } : b));
  };
  const terminou = (f: FimDaBusca) => { setBusca(null); if (f.erro) setErro(`A extensão não conseguiu iniciar a busca: ${f.erro}`); void carregar(); };
  useEffect(() => ligarEntregasDeFontes(receber, terminou), []);      // eslint-disable-line react-hooks/exhaustive-deps

  const extensaoPronta = extensaoSabeBuscarFontes();
  const buscarPelaExtensao = (alvos: FontePendente[]) => {
    const lista = alvos.filter((f) => buscavel(f) && f.status === "pendente"); if (!lista.length) return; setErro("");
    const pedidoId = pedirFontesPelaExtensao(lista.map((f) => ({ id: f.id, rotulo: f.rotulo, tipo: f.tipo, esfera: f.esfera, ente: f.ente, numero: f.numero, ano: f.ano })), sites.filter((s) => s.ativa));
    setBusca({ pedidoId, total: lista.length, feitas: 0 });
    setTimeout(() => { if (buscaRef.current?.pedidoId === pedidoId && buscaRef.current.feitas === 0) setErro("A extensão ainda não respondeu. Uma aba “Buscar as fontes pendentes pelo seu navegador” deve ter aberto; se não abriu, confira se a extensão está atualizada (1.0.90 ou mais nova)."); }, 15000);
  };
  const visiveis = useMemo(() => (itens || []).filter((i) => filtro === "todas" || i.status === filtro || !!msgs[i.id]), [itens, filtro, msgs]);      // a fonte que acabou de ser tratada continua na tela, com o resultado, até trocar de filtro ou recarregar
  const cont = useMemo(() => { const l = itens || []; return { pendente: l.filter((i) => i.status === "pendente").length, incluida: l.filter((i) => i.status === "incluida").length, ignorada: l.filter((i) => i.status === "ignorada").length, buscaveis: l.filter((i) => i.status === "pendente" && buscavel(i)).length }; }, [itens]);
  const mudarStatus = async (it: FontePendente, status: FontePendente["status"]) => { try { trocar((await chamar(`/${encodeURIComponent(it.id)}`, { method: "PUT", body: JSON.stringify({ status }) })).item); void carregar(); } catch (e: any) { setErro(e.message); } };
  const excluir = async (it: FontePendente) => { if (!window.confirm(`Excluir “${it.rotulo}” da lista?`)) return; try { await chamar(`/${encodeURIComponent(it.id)}`, { method: "DELETE" }); void carregar(); } catch (e: any) { setErro(e.message); } };
  const escolherArquivo = (id: string) => { alvo.current = id; arquivo.current?.click(); };
  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; const id = alvo.current; if (!f || !id) return; await incluir(id, f.name, new Uint8Array(await f.arrayBuffer()), f.type, "manual"); };

  return (
    <div className="space-y-3" data-testid="aba-fontes-pendentes">
      <input ref={arquivo} type="file" accept=".htm,.html,.pdf,.txt" className="hidden" onChange={aoEscolher} data-testid="entrada-arquivo-pendente" />
      <p className="text-slate-600">Tudo o que os autos citam (leis federais, estaduais e municipais, Constituições, tratados, súmulas e temas) e o Studio <strong>ainda não tem</strong>. Todos os motores alimentam esta lista (análise normal, Turbo, Lupa, Gigantes e Mesa). Só são guardados identificadores e contagens, nunca trechos do processo.</p>
      <div className="flex flex-wrap items-center gap-2">
        {([["pendente", `Pendentes (${cont.pendente})`], ["incluida", `Incluídas (${cont.incluida})`], ["ignorada", `Ignoradas (${cont.ignorada})`], ["todas", "Todas"]] as const).map(([id, rot]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${filtro === id ? "bg-[#673de6] text-white border-[#673de6]" : "bg-white text-slate-600 border-slate-300"}`}>{rot}</button>
        ))}
        <span className="flex-1" />
        <button disabled={!extensaoPronta || !!busca || cont.buscaveis === 0} onClick={() => itens && buscarPelaExtensao(itens)} data-testid="buscar-todas-pendentes" className={`${btn} bg-[#673de6] text-white`} title={extensaoPronta ? "A extensão procura no seu navegador todas as leis pendentes e entrega ao Studio" : `Precisa da extensão Conclusões Projudi 1.0.90 ou mais nova${versaoDaExtensao() ? ` (a sua é a ${versaoDaExtensao()})` : " instalada neste navegador"}`}>Buscar todas pela extensão ({cont.buscaveis})</button>
        <button onClick={() => setNovo((v) => !v)} className={`${btn} bg-white border border-[#673de6] text-[#673de6]`} data-testid="adicionar-fonte">+ Adicionar fonte</button>
        <button onClick={() => setEditSites((v) => !v)} className={`${btn} bg-white border border-slate-300 text-slate-600`} data-testid="editar-sites">Sites de busca ({sites.filter((s) => s.ativa).length})</button>
      </div>
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-2">{erro}</p>}
      {busca && <p className="text-[#673de6] font-bold" data-testid="progresso-fontes">Buscando pela extensão: {busca.feitas} de {busca.total} resolvidas… Acompanhe na aba aberta pela extensão (na primeira vez ela pede a permissão de acesso aos sites).</p>}
      {novo && <FormFonte aoSalvar={async (d) => { try { await chamar("", { method: "POST", body: JSON.stringify(d) }); setNovo(false); void carregar(); } catch (e: any) { setErro(e.message); } }} aoCancelar={() => setNovo(false)} />}
      {editSites && <EditorSites sites={sites} hosts={hosts} aoSalvar={async (l) => { try { const j = await chamar("/config-busca", { method: "PUT", body: JSON.stringify({ fontes: l }) }); setSites(j.fontesBusca); setEditSites(false); } catch (e: any) { setErro(e.message); } }} aoCancelar={() => setEditSites(false)} />}
      {!itens && <p className="text-slate-500">Carregando…</p>}
      {itens && visiveis.length === 0 && <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500" data-testid="pendentes-vazio">{filtro === "pendente" ? "Nenhuma fonte pendente. Quando um processo citar algo que o Studio não tem, aparece aqui." : "Nada neste filtro."}</p>}
      <div className="space-y-2">
        {visiveis.map((it) => (
          <div key={it.id} data-testid={`pendente-${it.id}`} className={`rounded-xl border p-3 space-y-1.5 ${it.status === "incluida" ? "border-emerald-200 bg-emerald-50/40" : it.status === "ignorada" ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[220px]">
                <div className="font-bold text-slate-900 break-words">{it.rotulo}</div>
                <div className="text-[11px] text-slate-500">{it.esfera === "indefinida" ? "esfera a confirmar" : it.esfera}{it.ente ? ` · ${it.ente}` : ""} · citada {it.ocorrencias}× · última em {quando(it.ultima)}</div>
                <div className="flex flex-wrap gap-1 mt-1">{Object.entries(it.motores).map(([m, n]) => <span key={m} className="px-1.5 py-0.5 rounded bg-[#ebe4ff] text-[#4c2bb3] text-[10px] font-bold">{ROTULO_MOTOR[m] || m} · {n}</span>)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {it.status === "pendente" && buscavel(it) && <button disabled={!extensaoPronta || !!busca} onClick={() => buscarPelaExtensao([it])} data-testid={`buscar-${it.id}`} className={`${btn} bg-[#673de6] text-white`} title={extensaoPronta ? "A extensão procura este ato e entrega ao Studio" : "Precisa da extensão 1.0.90 ou mais nova"}>Buscar pela extensão</button>}
                {it.status !== "incluida" && buscavel(it) && <button onClick={() => escolherArquivo(it.id)} className={`${btn} bg-white border border-[#673de6] text-[#673de6]`} title="Enviar o arquivo da lei (HTML, PDF ou .txt)">Enviar arquivo</button>}
                {(it.link || FONTE_OFICIAL[it.orgao]) && <a href={it.link || FONTE_OFICIAL[it.orgao]} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white border border-slate-300 text-slate-600 no-underline`}>Abrir fonte</a>}
                <button onClick={() => setEditando(editando === it.id ? null : it.id)} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Editar</button>
                {it.status === "pendente" ? <button onClick={() => mudarStatus(it, "ignorada")} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Ignorar</button> : <button onClick={() => mudarStatus(it, "pendente")} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Reabrir</button>}
                {!buscavel(it) && it.status === "pendente" && <button onClick={() => mudarStatus(it, "incluida")} className={`${btn} bg-white border border-emerald-400 text-emerald-700`} title="Marque quando já tiver conferido ou anexado esta fonte por outro caminho">Marcar como conferida</button>}
                <button onClick={() => excluir(it)} className={`${btn} bg-white border border-red-300 text-red-700`}>Excluir</button>
              </div>
            </div>
            {!buscavel(it) && it.status === "pendente" && <p className="text-[11px] text-slate-500">{it.tipo === "tratado" || it.tipo === "constituição" ? "Sem busca automática: cadastre o texto na aba “Outras leis” ou informe o link." : "Súmulas e temas entram pelo botão “Anexar PDF de Informativo / Súmula” da tela de Súmulas, Teses e Informativos."}</p>}
            {msgs[it.id] && <p className="text-[11px] font-semibold" data-testid={`msg-${it.id}`}>{msgs[it.id]}</p>}
            {it.tentativas.length > 0 && <p className="text-[10px] text-slate-500">Última tentativa ({it.tentativas[it.tentativas.length - 1].via}): {it.tentativas[it.tentativas.length - 1].resultado}</p>}
            {it.nota && <p className="text-[11px] text-slate-600">Nota: {it.nota}</p>}
            {editando === it.id && <FormEdicao it={it} aoSalvar={async (d) => { try { trocar((await chamar(`/${encodeURIComponent(it.id)}`, { method: "PUT", body: JSON.stringify(d) })).item); setEditando(null); } catch (e: any) { setErro(e.message); } }} aoCancelar={() => setEditando(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const campo = "border border-slate-300 rounded-lg px-2 py-1 bg-white";
function FormFonte({ aoSalvar, aoCancelar }: { aoSalvar: (d: any) => void; aoCancelar: () => void }) {
  const [d, setD] = useState({ tipo: "lei", esfera: "municipal", ente: "", numero: "", ano: "", orgao: "", nota: "", link: "" });
  const m = (k: string) => (e: React.ChangeEvent<any>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="rounded-xl border border-[#c9b8ff] bg-[#f5f1ff] p-3 flex flex-wrap items-end gap-2" data-testid="form-nova-fonte">
      <label className="flex flex-col gap-0.5">Tipo<select value={d.tipo} onChange={m("tipo")} className={campo}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flex flex-col gap-0.5">Esfera<select value={d.esfera} onChange={m("esfera")} className={campo}>{["federal", "estadual", "municipal", "indefinida"].map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flex flex-col gap-0.5">Estado/município<input value={d.ente} onChange={m("ente")} placeholder="ex.: Montes Claros de Goiás" className={`${campo} w-48`} /></label>
      <label className="flex flex-col gap-0.5">Número<input value={d.numero} onChange={m("numero")} className={`${campo} w-24`} /></label>
      <label className="flex flex-col gap-0.5">Ano<input value={d.ano} onChange={m("ano")} className={`${campo} w-20`} /></label>
      {/^(súmula|tema)/.test(d.tipo) && <label className="flex flex-col gap-0.5">Tribunal<input value={d.orgao} onChange={m("orgao")} placeholder="STJ" className={`${campo} w-20`} /></label>}
      <label className="flex flex-col gap-0.5 flex-1 min-w-[160px]">Link ou nota (opcional)<input value={d.link || d.nota} onChange={(e) => setD((x) => ({ ...x, link: /^https?:/i.test(e.target.value) ? e.target.value : "", nota: /^https?:/i.test(e.target.value) ? "" : e.target.value }))} className={campo} /></label>
      <button onClick={() => aoSalvar({ ...d, ano: Number(d.ano) || 0 })} className={`${btn} bg-[#673de6] text-white`}>Adicionar</button>
      <button onClick={aoCancelar} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Cancelar</button>
    </div>
  );
}
function FormEdicao({ it, aoSalvar, aoCancelar }: { it: FontePendente; aoSalvar: (d: any) => void; aoCancelar: () => void }) {
  const [d, setD] = useState({ esfera: it.esfera, ente: it.ente, rotulo: it.rotulo, link: it.link || "", nota: it.nota || "" });
  const m = (k: string) => (e: React.ChangeEvent<any>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex flex-wrap items-end gap-2" data-testid={`form-editar-${it.id}`}>
      <label className="flex flex-col gap-0.5">Esfera<select value={d.esfera} onChange={m("esfera")} className={campo}>{["federal", "estadual", "municipal", "indefinida"].map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flex flex-col gap-0.5">Estado/município<input value={d.ente} onChange={m("ente")} className={`${campo} w-48`} /></label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[180px]">Nome<input value={d.rotulo} onChange={m("rotulo")} className={campo} /></label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[180px]">Link<input value={d.link} onChange={m("link")} className={campo} /></label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[180px]">Nota<input value={d.nota} onChange={m("nota")} className={campo} /></label>
      <button onClick={() => aoSalvar(d)} className={`${btn} bg-[#673de6] text-white`}>Salvar</button>
      <button onClick={aoCancelar} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Cancelar</button>
    </div>
  );
}
function EditorSites({ sites, hosts, aoSalvar, aoCancelar }: { sites: SiteBusca[]; hosts: string[]; aoSalvar: (l: SiteBusca[]) => void; aoCancelar: () => void }) {
  const [l, setL] = useState<SiteBusca[]>(sites);
  const mudar = (i: number, p: Partial<SiteBusca>) => setL((x) => x.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="rounded-xl border border-[#c9b8ff] bg-[#f5f1ff] p-3 space-y-2" data-testid="editor-sites">
      <p className="text-[11px] text-slate-600">Sites onde a extensão procura leis <strong>estaduais e municipais</strong> (a página de listagem das leis). Só endereços https destes sites, que a extensão pode abrir: {hosts.join(", ")}.</p>
      {l.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input value={s.nome} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Nome" className={`${campo} w-48`} />
          <select value={s.esfera} onChange={(e) => mudar(i, { esfera: e.target.value as any })} className={campo}><option>municipal</option><option>estadual</option></select>
          <input value={s.ente} onChange={(e) => mudar(i, { ente: e.target.value })} placeholder="Município/estado" className={`${campo} w-44`} />
          <input value={s.url} onChange={(e) => mudar(i, { url: e.target.value })} placeholder="https://…/leis" className={`${campo} flex-1 min-w-[220px]`} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={s.ativa} onChange={(e) => mudar(i, { ativa: e.target.checked })} /> ativa</label>
          <button onClick={() => setL((x) => x.filter((_, j) => j !== i))} className={`${btn} bg-white border border-red-300 text-red-700`}>Remover</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setL((x) => [...x, { id: `s${Date.now().toString(36)}`, nome: "", esfera: "municipal", ente: "", url: "https://", ativa: true }])} className={`${btn} bg-white border border-[#673de6] text-[#673de6]`}>+ Adicionar site</button>
        <button onClick={() => aoSalvar(l)} className={`${btn} bg-[#673de6] text-white`}>Salvar</button>
        <button onClick={aoCancelar} className={`${btn} bg-white border border-slate-300 text-slate-600`}>Cancelar</button>
      </div>
    </div>
  );
}
