import React, { useState } from "react";
import { getApiHeaders } from "../utils/apiKeyManager";

interface Resultado { id: string; grupo: string; nome: string; url: string; status: number; urlFinal?: string; tipo?: string; bytes?: number; ms?: number; amostra?: string; linhas?: number; erro?: string; bloqueio?: string; leitura?: { artigos: number; revogados: number; vetados: number } }
interface Lei { id: string; nome: string; url: string; baixadoEm?: number; total?: number; revogados?: number; vetados?: number; erro?: string }

/** Só Super Admin: testa se o servidor alcança os sites oficiais e importa as leis do Planalto (com a marca de revogado/vetado de cada artigo). */
export const FontesOficiaisPanel: React.FC = () => {
  const [aberto, setAberto] = useState(false), [testando, setTestando] = useState(false), [res, setRes] = useState<Resultado[] | null>(null), [erro, setErro] = useState("");
  const [envio, setEnvio] = useState<string[]>([]), [enviando, setEnviando] = useState(false);
  const [leis, setLeis] = useState<Lei[] | null>(null), [atualizando, setAtualizando] = useState<string | null>(null), [lote, setLote] = useState<{ feitas: number; total: number } | null>(null);
  const chamar = async (caminho: string, metodo = "POST") => {
    const r = await fetch("/api/fontes" + caminho, { method: metodo, headers: getApiHeaders() });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); return j;
  };
  const carregarLeis = async () => { try { setLeis((await chamar("/leis", "GET")).leis); } catch (e: any) { setErro(e.message); } };
  const abrir = () => { setAberto((v) => !v); if (!leis) void carregarLeis(); };
  const testar = async () => { setTestando(true); setErro(""); setRes(null); try { setRes((await chamar("/reconhecer")).resultados); } catch (e: any) { setErro(e.message); } finally { setTestando(false); } };
  const atualizar = async (id: string) => { setAtualizando(id); try { const { lei } = await chamar(`/leis/${id}/atualizar`); setLeis((ls) => (ls || []).map((l) => (l.id === id ? lei : l))); } catch (e: any) { setErro(e.message); } finally { setAtualizando(null); } };
  const atualizarTodas = async () => { if (!leis) return; setLote({ feitas: 0, total: leis.length }); for (let i = 0; i < leis.length; i++) { await atualizar(leis[i].id); setLote({ feitas: i + 1, total: leis.length }); await new Promise((r) => setTimeout(r, 800)); } setLote(null); };
  const enviarArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []); e.target.value = ""; if (!arquivos.length) return;
    setEnviando(true); setEnvio([]);
    for (const f of arquivos) {
      try {
        const r = await fetch("/api/fontes/leis/importar-arquivo", { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-nome-arquivo": encodeURIComponent(f.name) }, body: await f.arrayBuffer() });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
        const l: Lei = j.lei;
        setLeis((ls) => (ls || []).map((x) => (x.id === l.id ? l : x)));
        setEnvio((v) => [...v, l.erro ? `❌ ${f.name} → ${l.nome}: ${l.erro}` : `✅ ${f.name} → ${l.nome}: ${l.total} artigos, ${l.revogados} revogados, ${l.vetados} vetados`]);
      } catch (err: any) { setEnvio((v) => [...v, `❌ ${f.name}: ${err.message}`]); }
    }
    setEnviando(false);
  };
  const btn = "px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50";
  return (
    <div className="shrink-0 border-b border-[#c9b8ff] bg-[#f5f1ff]" data-testid="fontes-oficiais">
      <button onClick={abrir} className="w-full px-4 sm:px-6 py-2 text-left text-xs font-bold text-[#2f1c6a] flex items-center justify-between cursor-pointer">
        <span>Fontes oficiais (Super Admin): teste de acesso aos sites e leis do Planalto</span><span>{aberto ? "▲" : "▼"}</span>
      </button>
      {aberto && (
        <div className="px-4 sm:px-6 pb-3 space-y-3 max-h-[40vh] overflow-y-auto text-xs text-slate-700">
          {erro && <p className="text-red-700">{erro}</p>}
          <div className="space-y-1.5">
            <p><strong>1. Teste de acesso:</strong> o servidor da Hostinger tenta abrir os sites do STF, STJ, TNU, TJGO e do Planalto e mostra o que veio. Envie esse resultado ao desenvolvedor para planejar a importação das súmulas.</p>
            <button disabled={testando} onClick={testar} className={`${btn} bg-[#673de6] text-white`}>{testando ? "Testando (até 1 min)..." : "Testar acesso aos sites oficiais"}</button>
            {res && (
              <table className="w-full text-[11px] border border-[#e4e5ed] bg-white rounded-lg overflow-hidden"><thead className="bg-[#ebe4ff] text-left"><tr><th className="p-1.5">Site</th><th className="p-1.5">Resposta</th><th className="p-1.5">Tamanho</th><th className="p-1.5">Amostra / leitura</th></tr></thead>
                <tbody>{res.map((r) => (
                  <tr key={r.id} className="border-t border-[#e4e5ed] align-top">
                    <td className="p-1.5 font-semibold">{r.nome}</td>
                    <td className={`p-1.5 font-bold ${r.status === 200 && !r.bloqueio ? "text-emerald-700" : "text-red-700"}`}>{r.status || "falhou"}{r.ms ? ` · ${r.ms} ms` : ""}</td>
                    <td className="p-1.5">{r.bytes ? `${Math.round(r.bytes / 1024)} KB` : "—"}</td>
                    <td className="p-1.5 break-words">{r.erro || r.bloqueio || ""}{r.leitura ? ` Artigos lidos: ${r.leitura.artigos} (revogados ${r.leitura.revogados}, vetados ${r.leitura.vetados}). ` : ""}{r.amostra}{r.urlFinal ? ` → ${r.urlFinal}` : ""}</td>
                  </tr>))}</tbody></table>
            )}
          </div>
          <div className="space-y-1.5">
            <p><strong>2. Leis do Planalto:</strong> o sistema guarda <em>só a lista de artigos revogados e vetados</em> de cada lei (poucos KB; o texto das leis não vai para o banco). A minuta avisa quando cita artigo revogado, vetado ou inexistente, e o prompt lista os dispositivos revogados das leis mencionadas. Atualize de tempos em tempos (as leis mudam).</p>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900"><strong>Se o Planalto bloquear o servidor</strong> (aparece “Acesso Negado” no teste ou na lista), faça assim: abra a lei no <em>seu</em> navegador, aperte <kbd>Ctrl</kbd>+<kbd>S</kbd>, escolha “Página da Web, somente HTML” e envie os arquivos abaixo (vários de uma vez; mantenha o nome original, ex.: l13105.htm).</p>
            <label className={`${btn} inline-block bg-white border border-[#673de6] text-[#673de6]`}>{enviando ? "Lendo arquivos..." : "Enviar arquivos salvos do Planalto"}
              <input type="file" accept=".htm,.html" multiple className="hidden" disabled={enviando} onChange={enviarArquivos} />
            </label>
            {envio.length > 0 && <ul className="space-y-0.5">{envio.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            <button disabled={!!atualizando || !!lote || !leis} onClick={atualizarTodas} className={`${btn} bg-[#673de6] text-white`}>{lote ? `Atualizando ${lote.feitas}/${lote.total}...` : "Atualizar todas as leis"}</button>
            {leis && (
              <table className="w-full text-[11px] border border-[#e4e5ed] bg-white rounded-lg overflow-hidden"><tbody>{leis.map((l) => (
                <tr key={l.id} className="border-t border-[#e4e5ed] align-top">
                  <td className="p-1.5 font-semibold">{l.nome}</td>
                  <td className="p-1.5">{l.baixadoEm ? <span className="text-emerald-700">{l.total} artigos · {l.revogados} revogados · {l.vetados} vetados · {new Date(l.baixadoEm).toLocaleDateString("pt-BR")}</span> : <span className="text-slate-500">ainda não baixada</span>}{l.erro && <span className="text-red-700 block">Falha: {l.erro}</span>}</td>
                  <td className="p-1.5 text-right"><button disabled={!!atualizando || !!lote} onClick={() => atualizar(l.id)} className={`${btn} bg-white border border-[#c9cbd8] text-[#673de6]`}>{atualizando === l.id ? "..." : "Atualizar"}</button></td>
                </tr>))}</tbody></table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
