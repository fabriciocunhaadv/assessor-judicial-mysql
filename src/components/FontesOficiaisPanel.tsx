import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApiHeaders } from "../utils/apiKeyManager";
import { OutrasLeisTab } from "./OutrasLeisTab";
import { BotaoVerLei } from "./VisualizadorLei";
import { extractTextFromPdf } from "../utils/pdfExtractor";
import { extensaoSabeBuscarLeis, extensaoSabeTestarSites, versaoDaExtensao, pedirLeisPelaExtensao, ligarEntregasDeLeis, type EntregaLei, type FimDaBusca, type ResultadoSiteNavegador } from "../utils/leisPelaExtensao";

interface Resultado { id: string; grupo: string; nome: string; url: string; status: number; urlFinal?: string; tipo?: string; bytes?: number; ms?: number; amostra?: string; linhas?: number; erro?: string; bloqueio?: string; leitura?: { artigos: number; revogados: number; vetados: number } }
interface Lei { id: string; nome: string; url: string; baixadoEm?: number; total?: number; revogados?: number; vetados?: number; erro?: string }
interface ItemEnvio { chave: string; arquivo: File; nome: string; estado: "enviando" | "ok" | "erro" | "nao_reconhecido"; msg: string; escolha?: string }

const chamarSimples = async (url: string) => { const r = await fetch(url, { headers: getApiHeaders() }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || j.erro || `erro ${r.status}`); return j; };
const nomeArquivo = (l: Lei) => l.url.split("/").pop() || "";
const pronta = (l: Lei) => !!l.baixadoEm;
/** O Planalto recusa o acesso do servidor (página de “Acesso Negado”): não é falha da lei, e a cópia enviada à mão continua valendo. */
const bloqueioDoPlanalto = (l: Lei) => !!l.erro && /bloque|acesso negado/i.test(l.erro);
const btn = "px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50";

/** Só Super Admin: central das fontes oficiais. Envio de várias leis salvas do Planalto de uma vez (arrastando ou escolhendo), andamento das 29 leis, envio por lei e testes de acesso. */
export const FontesOficiaisPanel: React.FC = () => {
  const [aberto, setAberto] = useState(false), [aba, setAba] = useState<"leis" | "outras" | "testes">("leis"), [erro, setErro] = useState("");
  const [leis, setLeis] = useState<Lei[] | null>(null), [atualizando, setAtualizando] = useState<string | null>(null), [lote, setLote] = useState<{ feitas: number; total: number } | null>(null);
  const [envios, setEnvios] = useState<ItemEnvio[]>([]), [arrastando, setArrastando] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "pendentes" | "prontas" | "erro">("todas"), [busca, setBusca] = useState("");
  const [testando, setTestando] = useState(false), [res, setRes] = useState<Resultado[] | null>(null);
  const [consulta, setConsulta] = useState(""), [saidaConsulta, setSaidaConsulta] = useState<any>(null), [consultando, setConsultando] = useState(false);
  const entradaArquivos = useRef<HTMLInputElement>(null), alvoLei = useRef<string | null>(null);
  const [viaExt, setViaExt] = useState<{ pedidoId: string; total: number; feitas: number } | null>(null);
  const viaExtRef = useRef<typeof viaExt>(null); viaExtRef.current = viaExt;
  const [sitesTeste, setSitesTeste] = useState<{ id: string; grupo: string; nome: string; url: string }[] | null>(null), [resNav, setResNav] = useState<Record<string, ResultadoSiteNavegador>>({}), [testandoNav, setTestandoNav] = useState(false);

  const chamar = async (caminho: string, metodo = "POST") => {
    const r = await fetch("/api/fontes" + caminho, { method: metodo, headers: getApiHeaders() });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); return j;
  };
  const carregarLeis = async () => { try { setLeis((await chamar("/leis", "GET")).leis); } catch (e: any) { setErro(e.message); } };
  useEffect(() => { void carregarLeis(); }, []);      // o contador "N de 29 prontas" aparece já na barra fechada

  const contagem = useMemo(() => {
    const ls = leis || [];
    return { total: ls.length, prontas: ls.filter(pronta).length, erro: ls.filter((l) => !!l.erro && !bloqueioDoPlanalto(l)).length, pendentes: ls.filter((l) => !pronta(l)).length };
  }, [leis]);
  const visiveis = useMemo(() => (leis || []).filter((l) => {
    if (filtro === "pendentes" && pronta(l)) return false;
    if (filtro === "prontas" && !pronta(l)) return false;
    if (filtro === "erro" && (!l.erro || bloqueioDoPlanalto(l))) return false;
    const q = busca.trim().toLowerCase();
    return !q || `${l.nome} ${nomeArquivo(l)}`.toLowerCase().includes(q);
  }), [leis, filtro, busca]);

  // ---------- envio de arquivos (vários de uma vez; ou um só para uma lei escolhida) ----------
  const enviarUm = async (item: ItemEnvio, idForcado?: string) => {
    const atualizar = (p: Partial<ItemEnvio>) => setEnvios((v) => v.map((x) => (x.chave === item.chave ? { ...x, ...p } : x)));
    atualizar({ estado: "enviando", msg: "Lendo..." });
    try {
      // HTML salvo do Planalto vai como está; PDF e .txt viram texto aqui no navegador (o servidor separa os artigos)
      let corpo: ArrayBuffer | Uint8Array, formato = "";
      if (/\.pdf$/i.test(item.arquivo.name)) {
        const t = await extractTextFromPdf(item.arquivo, undefined, { fullSequential: true });
        if (!t?.text || t.text.trim().length < 100) { atualizar({ estado: "erro", msg: "não consegui ler texto deste PDF (se for imagem digitalizada, não há texto para ler)" }); return; }
        corpo = new TextEncoder().encode(t.text); formato = "texto";
      } else if (/\.txt$/i.test(item.arquivo.name)) { corpo = await item.arquivo.arrayBuffer(); formato = "texto"; }
      else corpo = await item.arquivo.arrayBuffer();
      const r = await fetch("/api/fontes/leis/importar-arquivo" + (idForcado ? `?id=${encodeURIComponent(idForcado)}` : ""), { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-nome-arquivo": encodeURIComponent(item.arquivo.name), "x-formato": formato }, body: corpo as any });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) { atualizar({ estado: /não reconheci/i.test(j.erro || "") ? "nao_reconhecido" : "erro", msg: j.erro || `erro ${r.status}` }); return; }
      const l: Lei = j.lei;
      setLeis((ls) => (ls || []).map((x) => (x.id === l.id ? l : x)));
      atualizar(l.erro ? { estado: "erro", msg: `${l.nome}: ${l.erro}` } : { estado: "ok", msg: `${l.nome}: ${l.total} artigos, ${l.revogados} revogados, ${l.vetados} vetados` });
    } catch (err: any) { atualizar({ estado: "erro", msg: err?.message || "falha ao enviar" }); }
  };
  // ---------- busca pelo navegador (extensão): o Planalto bloqueia o servidor, mas não o navegador do Super Admin ----------
  const receberDaExtensao = async (e: EntregaLei) => {
    const chave = `ext_${Date.now()}_${e.id}`;
    const mudar = (p: Partial<ItemEnvio>) => setEnvios((v) => v.map((x) => (x.chave === chave ? { ...x, ...p } : x)));
    setEnvios((v) => [...v, { chave, arquivo: new File([], e.nome), nome: `${e.nome} (pela extensão)`, estado: "enviando", msg: "Recebido do navegador, gravando..." }]);
    try {
      const r = await fetch(`/api/fontes/leis/importar-arquivo?id=${encodeURIComponent(e.id)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-nome-arquivo": encodeURIComponent(e.nome), "x-formato": "" }, body: e.bytes as any });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) mudar({ estado: "erro", msg: j.erro || `erro ${r.status}` });
      else { const l: Lei = j.lei; setLeis((ls) => (ls || []).map((x) => (x.id === l.id ? l : x))); mudar(l.erro ? { estado: "erro", msg: `${l.nome}: ${l.erro}` } : { estado: "ok", msg: `${l.nome}: ${l.total} artigos, ${l.revogados} revogados, ${l.vetados} vetados` }); }
    } catch (err: any) { mudar({ estado: "erro", msg: err?.message || "falha ao gravar" }); }
    setViaExt((v) => (v ? { ...v, feitas: v.feitas + 1 } : v));
  };
  const terminouExtensao = (f: FimDaBusca) => {
    if (f.modo === "teste") { setTestandoNav(false); return; }
    setViaExt(null);
    if (f.erro) setErro(`A extensão não conseguiu iniciar a busca: ${f.erro}`);
    else if (f.bloqueios) setErro(`O Planalto bloqueou ${f.bloqueios} página(s) também no seu navegador. As demais foram gravadas; para as outras, use o envio dos arquivos salvos.`);
    else if (f.falhas) setErro(`${f.falhas} lei(s) não puderam ser buscadas pela extensão (veja os envios acima).`);
    void carregarLeis();
  };
  useEffect(() => ligarEntregasDeLeis(receberDaExtensao, terminouExtensao, (r) => setResNav((m) => ({ ...m, [r.id]: r }))), []);      // eslint-disable-line react-hooks/exhaustive-deps
  const extensaoPronta = extensaoSabeBuscarLeis(), extensaoTesta = extensaoSabeTestarSites();
  const testarPeloNavegador = async () => {
    setErro(""); setResNav({}); setTestandoNav(true);
    try {
      const sites = (await chamar("/sites-teste", "GET")).sites as { id: string; grupo: string; nome: string; url: string }[]; setSitesTeste(sites);
      pedirLeisPelaExtensao(sites, "teste");
      setTimeout(() => { setTestandoNav((t) => { if (t && Object.keys(resNavRef.current).length === 0) setErro("A extensão ainda não respondeu. Uma aba “Testar o acesso aos sites oficiais” deve ter aberto; se não abriu, confira se a extensão está atualizada (1.0.89 ou mais nova)."); return t; }); }, 15000);
    } catch (e: any) { setErro(e.message); setTestandoNav(false); }
  };
  const resNavRef = useRef(resNav); resNavRef.current = resNav;
  const linhasTeste = (res || sitesTeste || []) as Resultado[];
  const funciona = (r?: { status?: number; bloqueio?: string; erro?: string }) => !!r && !!r.status && r.status >= 200 && r.status < 300 && !r.bloqueio && !r.erro;
  const melhorCaminho = (srv?: Resultado, nav?: ResultadoSiteNavegador): { texto: string; cor: string } => funciona(srv) ? { texto: "servidor", cor: "text-emerald-700" } : funciona(nav) ? { texto: "navegador (extensão)", cor: "text-[#673de6]" } : (srv || nav) ? { texto: srv && nav ? "envio manual" : "…", cor: "text-red-700" } : { texto: "—", cor: "text-slate-400" };
  const buscarPelaExtensao = (alvos: Lei[]) => {
    if (!alvos.length) return; setErro("");
    const pedidoId = pedirLeisPelaExtensao(alvos.map((l) => ({ id: l.id, nome: l.nome, url: l.url })));
    setViaExt({ pedidoId, total: alvos.length, feitas: 0 });
    setTimeout(() => { if (viaExtRef.current?.pedidoId === pedidoId && viaExtRef.current.feitas === 0) setErro("A extensão ainda não respondeu. Uma nova aba de “Atualizar leis pelo navegador” deve ter aberto; se não abriu, confira se a extensão está atualizada (1.0.88 ou mais nova)."); }, 15000);
  };
  const enviarArquivos = async (arquivos: File[], idForcado?: string) => {
    const validos = arquivos.filter((f) => /\.(html?|pdf|txt)$/i.test(f.name));
    const ignorados = arquivos.length - validos.length;
    if (ignorados) setErro(`${ignorados} arquivo(s) ignorado(s): só entram HTML (.htm, .html), PDF ou texto (.txt).`); else setErro("");
    if (!validos.length) return;
    const itens: ItemEnvio[] = validos.map((f, i) => ({ chave: `${Date.now()}_${i}_${f.name}`, arquivo: f, nome: f.name, estado: "enviando", msg: "Na fila..." }));
    setEnvios((v) => [...itens, ...v].slice(0, 60));
    for (const it of itens) await enviarUm(it, idForcado && itens.length === 1 ? idForcado : undefined);
  };
  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []); e.target.value = "";
    const alvo = alvoLei.current; alvoLei.current = null;
    if (alvo && arquivos.length > 1) setErro("Para enviar para uma lei específica escolha um arquivo só; para vários, use a área de envio de cima.");
    void enviarArquivos(alvo && arquivos.length > 1 ? [] : arquivos, alvo || undefined);
  };
  const excluirLei = async (l: Lei) => {
    if (!window.confirm(`Excluir o que está guardado de “${l.nome}”? A lei volta a ficar pendente e pode ser enviada de novo.`)) return;
    try { const { lei } = await chamar(`/leis/${l.id}`, "DELETE"); setLeis((ls) => (ls || []).map((x) => (x.id === l.id ? lei : x))); setErro(""); } catch (e: any) { setErro(e.message); }
  };
  const escolherParaLei = (id: string) => { alvoLei.current = id; entradaArquivos.current?.click(); };
  const aoSoltar = (e: React.DragEvent) => { e.preventDefault(); setArrastando(false); void enviarArquivos(Array.from(e.dataTransfer.files || [])); };

  // ---------- atualização pelo site (só funciona se o Planalto não estiver bloqueando o servidor) ----------
  const atualizar = async (id: string): Promise<any> => { setAtualizando(id); try { const { lei } = await chamar(`/leis/${id}/atualizar`); setLeis((ls) => (ls || []).map((l) => (l.id === id ? lei : l))); return lei; } catch (e: any) { setErro(e.message); return null; } finally { setAtualizando(null); } };
  const atualizarTodas = async () => {
    if (!leis) return; setLote({ feitas: 0, total: leis.length }); setErro("");
    for (let i = 0; i < leis.length; i++) {
      const lei = await atualizar(leis[i].id); setLote({ feitas: i + 1, total: leis.length });
      if (lei?.erro && /bloque/i.test(lei.erro)) { setErro("O Planalto está bloqueando o servidor: a atualização em lote foi interrompida. Salve as leis no seu navegador (Ctrl+S) e envie os arquivos na área de envio."); break; }
      await new Promise((r) => setTimeout(r, 800));
    }
    setLote(null);
  };
  const copiar = (itens: Lei[], rotulo: string) => {
    const t = itens.map((l) => `${l.nome}\t${l.url}\t${nomeArquivo(l)}`).join("\n");
    navigator.clipboard?.writeText(t).then(() => window.alert(`${itens.length} ${rotulo} copiado(s): nome, endereço e nome do arquivo, um por linha.`)).catch(() => window.alert(t));
  };

  // ---------- testes de acesso ----------
  const testar = async () => { setTestando(true); setErro(""); setRes(null); try { setRes((await chamar("/reconhecer")).resultados); } catch (e: any) { setErro(e.message); } finally { setTestando(false); } };
  const testarConsulta = async () => {      // usa o fetch do app (leva a sessão); o endereço digitado direto no navegador não leva
    setConsultando(true); setErro(""); setSaidaConsulta(null);
    try { const [st, te] = await Promise.all([chamarSimples("/api/legislacao-status"), consulta.trim() ? chamarSimples("/api/legislacao-teste?q=" + encodeURIComponent(consulta.trim())) : Promise.resolve(null)]); setSaidaConsulta({ st, te }); }
    catch (e: any) { setErro(e.message); } finally { setConsultando(false); }
  };

  const pct = contagem.total ? Math.round((contagem.prontas / contagem.total) * 100) : 0;
  const aba_ = (id: "leis" | "outras" | "testes", rotulo: string) => (
    <button onClick={() => setAba(id)} className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer ${aba === id ? "border-[#673de6] text-[#673de6]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{rotulo}</button>
  );

  return (
    <div className="shrink-0 border-b border-[#c9b8ff] bg-[#f5f1ff]" data-testid="fontes-oficiais">
      <button onClick={() => setAberto(true)} className="w-full px-4 sm:px-6 py-2 text-left text-xs font-bold text-[#2f1c6a] flex items-center justify-between gap-3 cursor-pointer">
        <span>Central de fontes oficiais (Super Admin): leis do Planalto e testes de acesso</span>
        <span className="flex items-center gap-2 shrink-0">
          {leis && <span className="px-2 py-0.5 rounded-full bg-white border border-[#c9b8ff] text-[11px]">{contagem.prontas} de {contagem.total} leis prontas</span>}
          <span className="px-2.5 py-1 rounded-full bg-[#673de6] text-white text-[11px]">Abrir central</span>
        </span>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-900/60" onClick={() => setAberto(false)}>
          <div className="bg-white text-slate-800 w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 space-y-2 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">Central de fontes oficiais</h3>
                  <p className="text-[11px] text-slate-500">Leis do Planalto usadas na conferência das minutas. Só o Super Admin alimenta; vale para todos os gabinetes.</p>
                </div>
                <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer" aria-label="Fechar">✕</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#673de6] transition-all" style={{ width: `${pct}%` }} /></div>
                <span className="text-xs font-bold whitespace-nowrap">{contagem.prontas} de {contagem.total} leis prontas</span>
              </div>
              <div className="flex">{aba_("leis", "Leis do Planalto")}{aba_("outras", "Outras leis (estaduais e municipais)")}{aba_("testes", "Testes de acesso")}</div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-slate-700">
              {erro && <p className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-2">{erro}</p>}

              {aba === "leis" && (<>
                <div onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={aoSoltar} onClick={() => entradaArquivos.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition ${arrastando ? "border-[#673de6] bg-[#ebe4ff]" : "border-slate-300 bg-slate-50 hover:bg-[#f5f1ff]"}`} data-testid="area-envio">
                  <p className="text-sm font-bold">Arraste aqui os arquivos das leis (vários de uma vez) ou clique para escolher</p>
                  <p className="text-[11px] text-slate-500 mt-1">Páginas do Planalto salvas no navegador (Ctrl+S › “Página da Web, somente HTML”), ou o PDF ou .txt da lei (para PDF/.txt, use “Reenviar arquivo” na linha da lei certa). O sistema reconhece cada lei pelo nome do arquivo ou pelo começo do texto.</p>
                </div>
                <input ref={entradaArquivos} type="file" accept=".htm,.html,.pdf,.txt" multiple className="hidden" onChange={aoEscolher} data-testid="entrada-arquivos" />

                {envios.length > 0 && (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    <div className="px-3 py-1.5 flex items-center justify-between bg-slate-50 rounded-t-xl"><strong>Envios desta sessão ({envios.length})</strong><button onClick={() => setEnvios([])} className="text-[11px] text-slate-500 underline cursor-pointer">limpar lista</button></div>
                    {envios.map((it) => (
                      <div key={it.chave} className="px-3 py-1.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] break-all">{it.nome}</span>
                        <span className={it.estado === "ok" ? "text-emerald-700" : it.estado === "enviando" ? "text-slate-500" : "text-red-700"}>{it.estado === "ok" ? "✅ " : it.estado === "enviando" ? "⏳ " : "❌ "}{it.msg}</span>
                        {it.estado === "nao_reconhecido" && leis && (
                          <span className="flex items-center gap-1.5">
                            <select className="border border-slate-300 rounded-lg px-1.5 py-1 bg-white" value={it.escolha || ""} onChange={(e) => setEnvios((v) => v.map((x) => (x.chave === it.chave ? { ...x, escolha: e.target.value } : x)))}>
                              <option value="">Qual lei é?</option>
                              {leis.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                            </select>
                            <button disabled={!it.escolha} onClick={() => void enviarUm(it, it.escolha)} className={`${btn} bg-[#673de6] text-white`}>Enviar como esta lei</button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {([["todas", `Todas (${contagem.total})`], ["pendentes", `Pendentes (${contagem.pendentes})`], ["prontas", `Prontas (${contagem.prontas})`], ["erro", `Com erro (${contagem.erro})`]] as const).map(([id, rot]) => (
                    <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${filtro === id ? "bg-[#673de6] text-white border-[#673de6]" : "bg-white text-slate-600 border-slate-300"}`}>{rot}</button>
                  ))}
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lei ou nome do arquivo" className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-2 py-1 bg-white" />
                  <button className={`${btn} bg-white border border-slate-300 text-[#673de6]`} onClick={() => leis && copiar(leis.filter((l) => !pronta(l)), "endereço(s) das pendentes")}>Copiar endereços das pendentes</button>
                  <button className={`${btn} bg-white border border-slate-300 text-[#673de6]`} onClick={() => leis && copiar(leis, "endereço(s)")}>Copiar todos</button>
                  <button disabled={!extensaoPronta || !!viaExt || !leis || contagem.pendentes === 0} onClick={() => leis && buscarPelaExtensao(leis.filter((l) => !pronta(l)))} data-testid="buscar-pendentes-extensao" className={`${btn} bg-[#673de6] text-white`} title={extensaoPronta ? "A extensão busca no seu navegador as leis que faltam e entrega ao Studio" : `Precisa da extensão Conclusões Projudi 1.0.88 ou mais nova${versaoDaExtensao() ? ` (a sua é a ${versaoDaExtensao()})` : " instalada neste navegador"}`}>Buscar pendentes pelo navegador ({contagem.pendentes})</button>
                  <button disabled={!extensaoPronta || !!viaExt || !leis} onClick={() => leis && buscarPelaExtensao(leis)} data-testid="buscar-todas-extensao" className={`${btn} bg-white border border-[#673de6] text-[#673de6]`} title={extensaoPronta ? "A extensão busca no seu navegador todas as leis e entrega ao Studio" : "Precisa da extensão Conclusões Projudi 1.0.88 ou mais nova"}>Buscar todas pelo navegador</button>
                  <button disabled={!!atualizando || !!lote || !leis || !!(leis || []).some(bloqueioDoPlanalto)} onClick={atualizarTodas} className={`${btn} bg-white border border-slate-300 text-slate-600`} title={(leis || []).some(bloqueioDoPlanalto) ? "O Planalto está bloqueando o servidor: envie os arquivos salvos no seu navegador. (O botão “Atualizar pelo site” de cada lei continua disponível para testar de novo.)" : "Tenta baixar direto do site do Planalto (não funciona se o servidor estiver bloqueado)"}>{lote ? `Atualizando ${lote.feitas}/${lote.total}...` : (leis || []).some(bloqueioDoPlanalto) ? "Atualizar todas pelo site (bloqueado pelo Planalto)" : "Atualizar todas pelo site"}</button>
                </div>

                {viaExt && <p className="text-[#673de6] font-bold" data-testid="progresso-extensao">Buscando pelo navegador (extensão): {viaExt.feitas} de {viaExt.total} entregues… Acompanhe na aba aberta pela extensão (ela pede a permissão de acesso ao Planalto na primeira vez).</p>}
                {!leis && <p className="text-slate-500">Carregando a lista de leis...</p>}
                {leis && (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {visiveis.length === 0 && <p className="p-3 text-slate-500">Nenhuma lei neste filtro.</p>}
                    {visiveis.map((l) => (
                      <div key={l.id} className="p-2.5 flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[240px]">
                          <p className="font-semibold text-[12px]">{l.nome}</p>
                          <p className="text-[10px] text-slate-500 break-all">Salvar como <code className="bg-slate-100 px-1 rounded">{nomeArquivo(l)}</code> · <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[#673de6] underline">abrir no Planalto</a></p>
                        </div>
                        <div className="min-w-[190px] text-[11px]">
                          {pronta(l) ? <span className="text-emerald-700">✅ {l.total} artigos · {l.revogados} revogados · {l.vetados} vetados<br />{new Date(l.baixadoEm!).toLocaleDateString("pt-BR")}</span> : <span className="text-slate-500">⏳ pendente</span>}
                          {l.erro && (bloqueioDoPlanalto(l)
                            ? <span className="text-amber-700 block" data-testid="aviso-bloqueio-planalto">{pronta(l) ? "A cópia acima continua em uso. " : ""}O Planalto bloqueou a atualização automática pelo site. {pronta(l) ? "Reenvie o arquivo se a lei mudou." : "Envie o arquivo salvo no seu navegador."}</span>
                            : <span className="text-red-700 block">Falha: {l.erro}</span>)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pronta(l) && <BotaoVerLei caminho={`/api/fontes/leis/${encodeURIComponent(l.id)}/texto`} titulo={`Ver o texto guardado: ${l.nome}`} />}
                          <button onClick={() => escolherParaLei(l.id)} className={`${btn} bg-[#673de6] text-white`} title="Enviar o arquivo salvo desta lei (não precisa ter o nome certo)">{pronta(l) ? "Reenviar arquivo" : "Enviar arquivo"}</button>
                          {(pronta(l) || !!l.erro) && <button disabled={!!atualizando || !!lote} onClick={() => void excluirLei(l)} className={`${btn} bg-white border border-red-300 text-red-700`} title="Excluir o texto guardado desta lei">Excluir</button>}
                          <button disabled={!!atualizando || !!lote} onClick={() => atualizar(l.id)} className={`${btn} bg-white border border-slate-300 text-slate-600`}>{atualizando === l.id ? "..." : "Atualizar pelo site"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">O sistema guarda a lista de artigos revogados e vetados de cada lei (poucos KB) e uma cópia compactada do texto (cerca de 100 KB por lei) que serve de reserva quando o Planalto não responde na hora da minuta.</p>
              </>)}

              {aba === "outras" && <OutrasLeisTab />}

              {aba === "testes" && (<>
                <div className="space-y-1.5">
                  <p><strong>Teste de acesso:</strong> o servidor da Hostinger tenta abrir os sites do STF, STJ, TNU, TJGO e do Planalto e mostra o que veio.</p>
                  <button disabled={testando} onClick={testar} className={`${btn} bg-[#673de6] text-white`}>{testando ? "Testando (até 1 min)..." : "Testar acesso aos sites oficiais"}</button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button disabled={testandoNav || !extensaoTesta} onClick={testarPeloNavegador} data-testid="testar-pelo-navegador" className={`${btn} bg-white border border-[#673de6] text-[#673de6]`} title={extensaoTesta ? "A extensão abre os mesmos sites no seu navegador e mostra o que veio, para comparar com o servidor" : `Precisa da extensão Conclusões Projudi 1.0.89 ou mais nova${versaoDaExtensao() ? ` (a sua é a ${versaoDaExtensao()})` : " instalada neste navegador"}`}>{testandoNav ? "Testando pelo navegador…" : "Testar também pelo navegador (extensão)"}</button>
                    {testandoNav && <span className="text-[#673de6] font-bold" data-testid="progresso-teste-navegador">{Object.keys(resNav).length} de {(sitesTeste || []).length || "…"} sites testados. Acompanhe na aba aberta pela extensão.</span>}
                  </div>
                  {(res || sitesTeste) && (
                    <table className="w-full text-[11px] border border-slate-200 bg-white rounded-lg overflow-hidden" data-testid="tabela-teste-acesso"><thead className="bg-[#ebe4ff] text-left"><tr><th className="p-1.5">Site</th><th className="p-1.5">Servidor (Hostinger)</th><th className="p-1.5">Seu navegador</th><th className="p-1.5">Melhor caminho</th><th className="p-1.5">Amostra / leitura</th></tr></thead>
                      <tbody>{linhasTeste.map((r) => { const nav = resNav[r.id], cam = melhorCaminho(res ? r : undefined, nav); return (
                        <tr key={r.id} className="border-t border-slate-200 align-top">
                          <td className="p-1.5 font-semibold">{r.nome}</td>
                          <td className={`p-1.5 font-bold ${res ? (funciona(r) ? "text-emerald-700" : "text-red-700") : "text-slate-400"}`}>{res ? <>{r.status || "falhou"}{r.ms ? ` · ${r.ms} ms` : ""}{r.bytes ? <span className="font-normal text-slate-500"> · {Math.round(r.bytes / 1024)} KB</span> : null}</> : "—"}</td>
                          <td className={`p-1.5 font-bold ${nav ? (funciona(nav) ? "text-emerald-700" : "text-red-700") : "text-slate-400"}`} data-testid={`nav-${r.id}`}>{nav ? <>{nav.status || "falhou"}{nav.ms ? ` · ${nav.ms} ms` : ""}{nav.bytes ? <span className="font-normal text-slate-500"> · {Math.round(nav.bytes / 1024)} KB</span> : null}</> : "—"}</td>
                          <td className={`p-1.5 font-bold ${cam.cor}`} data-testid={`caminho-${r.id}`}>{cam.texto}</td>
                          <td className="p-1.5 break-words">{res ? (r.erro || r.bloqueio || "") : ""}{res && r.leitura ? ` Artigos lidos: ${r.leitura.artigos} (revogados ${r.leitura.revogados}, vetados ${r.leitura.vetados}). ` : ""}{res ? r.amostra : (nav?.erro || nav?.bloqueio || nav?.amostra || "")}{res && r.urlFinal ? ` → ${r.urlFinal}` : ""}</td>
                        </tr>); })}</tbody></table>
                  )}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <p><strong>Consulta na hora da minuta:</strong> ao gerar a minuta o sistema busca no Planalto o texto oficial dos artigos citados (de qualquer lei federal) e usa a cópia salva se o site não responder. Teste aqui:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="ex.: art. 6º da Lei 8.987/1995 (opcional)" className="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-2 py-1 bg-white" />
                    <button disabled={consultando} onClick={testarConsulta} className={`${btn} bg-white border border-[#673de6] text-[#673de6]`}>{consultando ? "Testando..." : "Testar consulta"}</button>
                  </div>
                  {saidaConsulta && <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                    <div>Leis alcançáveis agora no site do Planalto: <strong>{saidaConsulta.st.ok}/{saidaConsulta.st.total}</strong> {saidaConsulta.st.ok === 0 && <span className="text-amber-800">(bloqueado: vale a cópia salva)</span>}</div>
                    {saidaConsulta.te && <pre className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-[10px]">{JSON.stringify(saidaConsulta.te, null, 1).slice(0, 2500)}</pre>}
                  </div>}
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
