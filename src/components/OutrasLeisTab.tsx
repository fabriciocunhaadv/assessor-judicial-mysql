import React, { useEffect, useRef, useState } from "react";
import { extractTextFromPdf } from "../utils/pdfExtractor";

interface Resumo { id: string; esfera: string; ente: string; tipo: string; numero: string; ano: number; titulo: string; salvoEm: number; artigos: number }
interface Linha { chave: string; arquivo: File; formato: "" | "texto"; bytes: ArrayBuffer; esfera: string; ente: string; tipo: string; numero: string; ano: string; titulo: string; artigos: number; amostra: string; estado: "lendo" | "pronto" | "salvando" | "salvo" | "erro"; msg: string }
const TIPOS = ["lei", "lei complementar", "decreto", "decreto-lei", "resolução", "portaria", "provimento", "emenda constitucional"];
const campo = "border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-900";
const btn = "px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50";
const rotulo = (l: Pick<Resumo, "esfera" | "tipo" | "numero" | "ano" | "ente">) => `${l.tipo.charAt(0).toUpperCase() + l.tipo.slice(1)}${l.esfera === "estadual" ? " Estadual" : l.esfera === "municipal" ? " Municipal" : ""} nº ${l.numero}/${l.ano}${l.ente ? ` (${l.ente})` : ""}`;

/** Super Admin: envia leis estaduais, municipais e outras normas (HTML, texto ou PDF). O sistema passa a conferir os artigos citados nas minutas contra essas cópias. Base única de todos os gabinetes. */
export const OutrasLeisTab: React.FC = () => {
  const [lista, setLista] = useState<Resumo[] | null>(null), [linhas, setLinhas] = useState<Linha[]>([]), [erro, setErro] = useState(""), [busca, setBusca] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const carregar = async () => { try { const r = await fetch("/api/fontes/outras"); const j = await r.json(); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); setLista(j.leis); } catch (e: any) { setErro(e.message); } };
  useEffect(() => { void carregar(); }, []);
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((v) => v.map((x) => (x.chave === chave ? { ...x, ...p } : x)));

  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []); e.target.value = ""; setErro("");
    for (const f of arquivos) {
      const chave = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${f.name}`;
      const novo: Linha = { chave, arquivo: f, formato: "", bytes: new ArrayBuffer(0), esfera: "estadual", ente: "", tipo: "lei", numero: "", ano: "", titulo: "", artigos: 0, amostra: "", estado: "lendo", msg: "Lendo o arquivo..." };
      setLinhas((v) => [novo, ...v]);
      try {
        let bytes: ArrayBuffer, formato: "" | "texto" = "";
        if (/\.pdf$/i.test(f.name)) { const t = await extractTextFromPdf(f, undefined, { fullSequential: true }); if (!t?.text || t.text.trim().length < 100) throw new Error("não consegui ler texto deste PDF (se for imagem digitalizada, envie o texto ou a página HTML)"); bytes = new TextEncoder().encode(t.text).buffer as ArrayBuffer; formato = "texto"; }
        else if (/\.(html?|txt)$/i.test(f.name)) { bytes = await f.arrayBuffer(); formato = /\.txt$/i.test(f.name) ? "texto" : ""; }
        else throw new Error("formato não aceito (use .htm, .html, .txt ou .pdf)");
        const r = await fetch("/api/fontes/outras/analisar", { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-formato": formato }, body: bytes });
        const j = await r.json().catch(() => ({} as any)); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
        const s = j.sugestao || {};
        mudar(chave, { bytes, formato, esfera: s.esfera || "estadual", ente: s.ente || "", tipo: TIPOS.includes(s.tipo) ? s.tipo : "lei", numero: s.numero || "", ano: s.ano || "", artigos: j.artigos || 0, amostra: j.amostra || "", estado: "pronto", msg: j.artigos ? `${j.artigos} artigo(s) reconhecido(s). Confira os dados e salve.` : "Nenhum artigo reconhecido (linhas começando com “Art. 1º”)." });
      } catch (err: any) { mudar(chave, { estado: "erro", msg: err?.message || "falha ao ler" }); }
    }
  };
  const salvar = async (l: Linha) => {
    mudar(l.chave, { estado: "salvando", msg: "Salvando..." });
    try {
      const q = new URLSearchParams({ esfera: l.esfera, ente: l.ente, tipo: l.tipo, numero: l.numero, ano: l.ano, titulo: l.titulo });
      const r = await fetch(`/api/fontes/outras?${q.toString()}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-formato": l.formato }, body: l.bytes });
      const j = await r.json().catch(() => ({} as any)); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
      mudar(l.chave, { estado: "salvo", msg: `✅ Salva: ${rotulo(j.lei)} (${j.lei.artigos} artigos).`, bytes: new ArrayBuffer(0) });
      void carregar();
    } catch (err: any) { mudar(l.chave, { estado: "pronto", msg: `❌ ${err?.message || "falha ao salvar"}` }); }
  };
  const salvarTodas = async () => { for (const l of linhas.filter((x) => x.estado === "pronto" && x.artigos > 0 && x.numero && x.ano)) await salvar(l); };
  const excluir = async (l: Resumo) => {
    if (!window.confirm(`Excluir ${rotulo(l)} da base? Isso vale para todos os gabinetes.`)) return;
    try { const r = await fetch(`/api/fontes/outras/${encodeURIComponent(l.id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(`erro ${r.status}`); await carregar(); } catch (e: any) { setErro(e.message); }
  };
  const visiveis = (lista || []).filter((l) => !busca.trim() || `${rotulo(l)} ${l.titulo}`.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-2">{erro}</p>}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
        <p className="font-bold text-sm">Leis estaduais, municipais e outras normas</p>
        <p className="text-[11px] text-slate-600">O Planalto só tem as leis federais. Envie aqui o texto das leis do Estado e dos Municípios (e decretos, resoluções etc.): quando a minuta citar o artigo, o sistema confere na sua cópia, como faz com as leis federais. Aceita vários arquivos de uma vez: página salva em HTML, texto (.txt) ou PDF com texto. O sistema sugere número, ano e estado; confira antes de salvar. A cópia pode ficar desatualizada, por isso a IA é avisada da data e de confirmar a vigência.</p>
        <button onClick={() => entrada.current?.click()} className={`${btn} bg-[#673de6] text-white`}>Escolher arquivos (um ou vários)</button>
        <input ref={entrada} type="file" multiple accept=".htm,.html,.txt,.pdf" className="hidden" onChange={aoEscolher} data-testid="entrada-outras" />
      </div>

      {linhas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><strong>Arquivos desta sessão</strong><span className="flex gap-3"><button onClick={salvarTodas} disabled={!linhas.some((x) => x.estado === "pronto" && x.artigos > 0 && x.numero && x.ano)} className={`${btn} bg-[#673de6] text-white`}>Salvar todos os prontos</button><button onClick={() => setLinhas([])} className="text-[11px] text-slate-500 underline cursor-pointer">limpar lista</button></span></div>
          {linhas.map((l) => (
            <div key={l.chave} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5" data-testid="linha-outra">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] break-all">{l.arquivo.name}</span><span className={l.estado === "salvo" ? "text-emerald-700" : l.estado === "erro" || /❌/.test(l.msg) ? "text-red-700" : "text-slate-600"}>{l.msg}</span></div>
              {(l.estado === "pronto" || l.estado === "salvando") && (
                <div className="flex flex-wrap items-center gap-2">
                  <select className={campo} value={l.esfera} onChange={(e) => mudar(l.chave, { esfera: e.target.value })}><option value="estadual">Estadual</option><option value="municipal">Municipal</option><option value="federal">Federal</option><option value="outra">Outra</option></select>
                  <input className={`${campo} w-36`} value={l.ente} onChange={(e) => mudar(l.chave, { ente: e.target.value })} placeholder={l.esfera === "municipal" ? "Município (ex.: Goiânia)" : l.esfera === "estadual" ? "Estado (ex.: Goiás)" : "Órgão/ente (opcional)"} />
                  <select className={campo} value={l.tipo} onChange={(e) => mudar(l.chave, { tipo: e.target.value })}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  <input className={`${campo} w-24`} value={l.numero} onChange={(e) => mudar(l.chave, { numero: e.target.value })} placeholder="Número" />
                  <input className={`${campo} w-20`} value={l.ano} onChange={(e) => mudar(l.chave, { ano: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Ano" />
                  <input className={`${campo} flex-1 min-w-[140px]`} value={l.titulo} onChange={(e) => mudar(l.chave, { titulo: e.target.value })} placeholder="Título (opcional)" />
                  <button disabled={l.estado === "salvando" || !l.numero || !l.ano || !l.artigos} onClick={() => void salvar(l)} className={`${btn} bg-[#673de6] text-white`}>Salvar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><strong>Leis na base ({lista?.length ?? "…"})</strong><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, estado ou município" className={`${campo} flex-1 min-w-[200px]`} /></div>
        {lista && visiveis.length === 0 && <p className="text-slate-500">Nenhuma lei enviada ainda.</p>}
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {visiveis.map((l) => (
            <div key={l.id} className="p-2.5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]"><p className="font-semibold text-[12px]">{rotulo(l)}</p>{l.titulo && <p className="text-[11px] text-slate-500">{l.titulo}</p>}</div>
              <span className="text-[11px] text-slate-600">{l.artigos} artigos · enviada em {new Date(l.salvoEm).toLocaleDateString("pt-BR")}</span>
              <button onClick={() => void excluir(l)} className={`${btn} bg-white border border-red-300 text-red-700`}>Excluir</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
