import React, { useState } from "react";
import { getApiHeaders } from "../utils/apiKeyManager";

interface Resultado { id: string; grupo: string; nome: string; url: string; status: number; urlFinal?: string; tipo?: string; bytes?: number; ms?: number; amostra?: string; linhas?: number; erro?: string; bloqueio?: string; leitura?: { artigos: number; revogados: number; vetados: number } }
interface Lei { id: string; nome: string; url: string; baixadoEm?: number; total?: number; revogados?: number; vetados?: number; erro?: string }

const chamarSimples = async (url: string) => { const r = await fetch(url, { headers: getApiHeaders() }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || j.erro || `erro ${r.status}`); return j; };

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
  const atualizar = async (id: string): Promise<any> => { setAtualizando(id); try { const { lei } = await chamar(`/leis/${id}/atualizar`); setLeis((ls) => (ls || []).map((l) => (l.id === id ? lei : l))); return lei; } catch (e: any) { setErro(e.message); return null; } finally { setAtualizando(null); } };
  const atualizarTodas = async () => { if (!leis) return; setLote({ feitas: 0, total: leis.length }); for (let i = 0; i < leis.length; i++) { const lei = await atualizar(leis[i].id); setLote({ feitas: i + 1, total: leis.length }); if (lei?.erro && /bloque/i.test(lei.erro)) { setErro("O Planalto está bloqueando o servidor: a atualização em lote foi interrompida. Salve as leis no seu navegador (Ctrl+S) e use “Enviar arquivos salvos do Planalto”."); break; } await new Promise((r) => setTimeout(r, 800)); } setLote(null); };
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
  const [consulta, setConsulta] = useState(""), [saidaConsulta, setSaidaConsulta] = useState<any>(null), [consultando, setConsultando] = useState(false);
  const testarConsulta = async () => {      // usa o fetch do app (leva a sessão); o endereço digitado direto no navegador não leva
    setConsultando(true); setErro(""); setSaidaConsulta(null);
    try { const [st, te] = await Promise.all([chamarSimples("/api/legislacao-status"), consulta.trim() ? chamarSimples("/api/legislacao-teste?q=" + encodeURIComponent(consulta.trim())) : Promise.resolve(null)]); setSaidaConsulta({ st, te }); }
    catch (e: any) { setErro(e.message); } finally { setConsultando(false); }
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
            <p><strong>2. Leis do Planalto:</strong> o sistema guarda a lista de artigos revogados e vetados de cada lei (poucos KB) e, só das leis que você enviar/atualizar, uma cópia <em>compactada</em> do texto (cerca de 100 KB por lei) que serve de reserva quando o Planalto não responde na hora da minuta. A minuta avisa quando cita artigo revogado, vetado ou inexistente, e o prompt lista os dispositivos revogados das leis mencionadas. Atualize de tempos em tempos (as leis mudam).</p>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900"><strong>Se o Planalto bloquear o servidor</strong> (aparece “Acesso Negado” no teste ou na lista), faça assim: abra a lei no <em>seu</em> navegador, aperte <kbd>Ctrl</kbd>+<kbd>S</kbd>, escolha “Página da Web, somente HTML” e envie os arquivos abaixo (vários de uma vez; mantenha o nome original, ex.: l13105.htm).</p>
            <label className={`${btn} inline-block bg-white border border-[#673de6] text-[#673de6]`}>{enviando ? "Lendo arquivos..." : "Enviar arquivos salvos do Planalto"}
              <input type="file" accept=".htm,.html" multiple className="hidden" disabled={enviando} onChange={enviarArquivos} />
            </label>
            {envio.length > 0 && <ul className="space-y-0.5">{envio.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            <button disabled={!!atualizando || !!lote || !leis} onClick={atualizarTodas} className={`${btn} bg-[#673de6] text-white`}>{lote ? `Atualizando ${lote.feitas}/${lote.total}...` : "Atualizar todas as leis"}</button>
            <p className="pt-1"><strong>3. Consulta na hora da minuta:</strong> ao gerar a minuta o sistema busca no Planalto o texto oficial dos artigos citados (de qualquer lei federal) e usa a cópia salva acima se o site não responder. Teste aqui:</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="ex.: art. 6º da Lei 8.987/1995 (opcional)" className="flex-1 min-w-[220px] border border-[#c9cbd8] rounded-lg px-2 py-1 bg-white" />
              <button disabled={consultando} onClick={testarConsulta} className={`${btn} bg-white border border-[#673de6] text-[#673de6]`}>{consultando ? "Testando..." : "Testar consulta"}</button>
            </div>
            {saidaConsulta && <div className="rounded-lg border border-[#e4e5ed] bg-white p-2 space-y-1">
              <div>Leis alcançáveis agora no site do Planalto: <strong>{saidaConsulta.st.ok}/{saidaConsulta.st.total}</strong> {saidaConsulta.st.ok === 0 && <span className="text-amber-800">(bloqueado: vale a cópia salva)</span>}</div>
              {saidaConsulta.te && <pre className="whitespace-pre-wrap break-words max-h-48 overflow-auto text-[10px]">{JSON.stringify(saidaConsulta.te, null, 1).slice(0, 2500)}</pre>}
            </div>}
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
