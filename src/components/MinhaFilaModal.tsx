import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Smartphone, X, RefreshCw, Loader2, BellRing, BellOff, Laptop } from "lucide-react";
import { lerMinhaFila, salvarPrefs, enviarAvisoDeTeste, ativarAvisos, desativarAvisos, avisosAtivosNesteAparelho, suportaAvisos, registrarServiceWorker } from "../utils/filaCliente";
import type { ResumoFila } from "../utils/filaRegras";
import { instrucoesDeInstalacao, enderecoDoApp } from "../utils/instalacaoApp";

// o Chrome do Android avisa que o app pode ser instalado (uma vez, cedo): guardamos para oferecer o botão “Instalar agora”
let pedidoInstalar: any = null;
if (typeof window !== "undefined") window.addEventListener("beforeinstallprompt", (ev: any) => { ev.preventDefault(); pedidoInstalar = ev; });
const jaInstalado = () => { try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true; } catch { return false; } };

interface Estado { resumo: ResumoFila | null; ultimoSinal: number; online: boolean; prefs: Record<string, boolean>; aparelhos: number; minutosSemSinal: number }
const AVISOS = [{ id: "concluida", rotulo: "Fila concluída" }, { id: "erro", rotulo: "Um processo parou com erro" }, { id: "pausa", rotulo: "A IA pediu login ou verificação" }, { id: "parou", rotulo: "O computador parou de responder (15 min sem sinal)" }];
const quando = (t: number) => { if (!t) return "nunca"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "agora há pouco" : m < 60 ? `há ${m} min` : new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

/** "Minha fila": mostra a fila da extensão (também no celular), se o computador está dando sinal e liga os avisos deste aparelho. Abre pelo menu, por `fila:abrir` ou por /?fila=1. */
export function MinhaFilaModal() {
  const [aberto, setAberto] = useState(false), [e, setE] = useState<Estado | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  const [avisosAqui, setAvisosAqui] = useState(false), [ocupado, setOcupado] = useState(false), [qr, setQr] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setE(await lerMinhaFila()); setErro(""); setAvisosAqui(await avisosAtivosNesteAparelho()); } catch (x: any) { setErro(String(x?.message || x)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => {
    void registrarServiceWorker();
    const abrir = () => setAberto(true);
    window.addEventListener("fila:abrir", abrir);
    const msg = (ev: MessageEvent) => { if (ev.data?.acao === "abrir-fila") abrir(); };
    navigator.serviceWorker?.addEventListener("message", msg);
    try { if (new URLSearchParams(location.search).get("fila") === "1") { abrir(); history.replaceState(null, "", location.pathname); } } catch { /* sem URL */ }
    return () => { window.removeEventListener("fila:abrir", abrir); navigator.serviceWorker?.removeEventListener("message", msg); };
  }, []);
  useEffect(() => { if (!aberto) return; void carregar(); const t = setInterval(() => { if (!document.hidden) void carregar(); }, 15_000); return () => clearInterval(t); }, [aberto, carregar]);
  useEffect(() => {      // QR code do endereço do app (para abrir no celular a partir do computador)
    if (!aberto || qr) return; let vivo = true;
    import("qrcode").then((m) => (m.default || (m as any)).toDataURL(enderecoDoApp(location.origin), { margin: 1, width: 192 })).then((u: string) => { if (vivo) setQr(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [aberto, qr]);
  if (!aberto) return null;
  const inst = instrucoesDeInstalacao(navigator.userAgent, jaInstalado(), (navigator as any).platform || "", navigator.maxTouchPoints || 0);

  const r = e?.resumo, feitos = r ? r.concluidos : 0, pct = r && r.total ? Math.round((r.concluidos / r.total) * 100) : 0;
  const alternarAvisos = async () => { setOcupado(true); try { if (avisosAqui) { await desativarAvisos(); toast.success("Avisos desligados neste aparelho."); } else { await ativarAvisos(); toast.success("Avisos ligados neste aparelho."); } await carregar(); } catch (x: any) { toast.error(String(x?.message || x)); } finally { setOcupado(false); } };
  const mudarPref = async (id: string, v: boolean) => { if (!e) return; const prefs = { ...e.prefs, [id]: v }; setE({ ...e, prefs }); try { await salvarPrefs(prefs); } catch (x: any) { toast.error(String(x?.message || x)); void carregar(); } };
  const testar = async () => { try { const j = await enviarAvisoDeTeste(); toast[j.enviados ? "success" : "error"](j.enviados ? "Aviso enviado. Olhe o celular." : "Nenhum aparelho recebeu. Ligue os avisos neste aparelho primeiro."); } catch (x: any) { toast.error(String(x?.message || x)); } };

  return (
    <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" role="dialog" aria-label="Minha fila" data-testid="minha-fila">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white text-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2"><div className="p-2 rounded-xl bg-indigo-100 text-indigo-700"><Smartphone className="w-5 h-5" /></div><h3 className="text-base font-black flex-1">Minha fila</h3>
          <button type="button" onClick={carregar} className="p-2 rounded-lg hover:bg-slate-100" title="Atualizar">{carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</button>
          <button type="button" onClick={() => setAberto(false)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X className="w-4 h-4" /></button></div>
        {erro && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2" data-testid="fila-erro">Não consegui carregar: {erro}</div>}
        {e && (
          <>
            <div className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm font-bold ${e.online ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="fila-computador"><Laptop className="w-4 h-4" />
              {e.online ? "Computador ativo" : e.ultimoSinal ? `Computador sem sinal (${quando(e.ultimoSinal)})` : "Nenhum sinal do computador ainda"}</div>
            {!r || !r.total ? <p className="text-sm text-slate-600" data-testid="fila-vazia">Nenhuma fila enviada ainda. Deixe a extensão rodando com o Studio aberto no computador: o resumo aparece aqui.</p> : (
              <div className="space-y-2" data-testid="fila-resumo">
                <div className="flex items-end justify-between"><div className="text-3xl font-black">{feitos}<span className="text-base font-bold text-slate-500"> de {r.total}</span></div><div className="text-xs text-slate-500">{pct}% concluído · atualizado {quando(e.ultimoSinal)}</div></div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  {[["Na fila", r.aguardando, "text-slate-700"], ["Analisando", r.analisando, "text-sky-700"], ["Com erro", r.erros, r.erros ? "text-rose-700" : "text-slate-700"], ["Pausados", r.pausados, "text-amber-700"]].map(([n, v, c]) => <div key={String(n)} className="rounded-lg bg-slate-100 py-1.5"><div className={`text-lg font-black ${c}`}>{v}</div>{n}</div>)}
                </div>
                {r.ia && <div className="text-xs text-slate-600">Motor: {r.modo === "ia" ? `IA externa (${r.ia})` : r.modo || "Studio"}{r.versao ? ` · extensão v${r.versao}` : ""}</div>}
                {r.pausa && <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">⏸ {r.pausa}</div>}
                {r.ultimoErro && <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2">Último erro: {r.ultimoErro}</div>}
              </div>
            )}
            <details className="rounded-2xl border border-slate-200 p-3 text-sm" open={!inst.instalado && inst.aparelho !== "computador"} data-testid="fila-instalar">
              <summary className="font-bold cursor-pointer flex items-center gap-2">📲 {inst.titulo}</summary>
              <div className="mt-2 space-y-2">
                {inst.avisoNavegador && <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2" data-testid="fila-aviso-navegador">{inst.avisoNavegador}</div>}
                <div className="flex gap-3 items-start flex-wrap">
                  <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-700 flex-1 min-w-[200px]">{inst.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                  {!inst.instalado && inst.aparelho === "computador" && (
                    <div className="text-center" data-testid="fila-qr">{qr ? <img src={qr} alt="QR code para abrir o Studio no celular" className="w-40 h-40 rounded-lg border border-slate-200" /> : <div className="w-40 h-40 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">Gerando…</div>}
                      <div className="text-[10px] text-slate-500 mt-1 break-all max-w-[10rem]">{enderecoDoApp(location.origin)}</div></div>
                  )}
                </div>
                {!inst.instalado && inst.aparelho === "android" && pedidoInstalar && <button type="button" onClick={async () => { try { await pedidoInstalar.prompt(); } catch { /* cancelado */ } pedidoInstalar = null; }} className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600" data-testid="fila-instalar-agora">Instalar agora</button>}
              </div>
            </details>
            <div className="rounded-2xl border border-slate-200 p-3 space-y-2" data-testid="fila-avisos">
              <div className="flex items-center gap-2 font-bold text-sm">{avisosAqui ? <BellRing className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-slate-500" />} Avisos neste aparelho</div>
              {!suportaAvisos() ? <p className="text-xs text-slate-600">Este navegador não suporta avisos. No iPhone, abra o menu de compartilhar e escolha “Adicionar à Tela de Início”; depois abra o app por lá e volte aqui.</p> : (
                <div className="flex gap-2 flex-wrap"><button type="button" disabled={ocupado} onClick={alternarAvisos} className={`px-3 py-2 rounded-xl text-xs font-bold text-white ${avisosAqui ? "bg-slate-600" : "bg-indigo-600"}`}>{ocupado ? "Aguarde…" : avisosAqui ? "Desligar avisos" : "Ligar avisos neste aparelho"}</button>
                  {avisosAqui && <button type="button" onClick={testar} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 border border-slate-300">Enviar aviso de teste</button>}</div>
              )}
              <div className="space-y-1">{AVISOS.map((a) => <label key={a.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={e.prefs[a.id] !== false} onChange={(ev) => mudarPref(a.id, ev.target.checked)} /> {a.rotulo}</label>)}</div>
              <button type="button" onClick={() => { setAberto(false); window.dispatchEvent(new CustomEvent("chamado:abrir")); }} className="w-full py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold" data-testid="fila-abrir-chamado">🆘 Algo deu errado? Abrir chamado (com print)</button>
              <p className="text-[11px] text-slate-500">{e.aparelhos} aparelho(s) cadastrado(s). O aviso é um só por tipo a cada 10 minutos. O resumo tem só números e estados, sem número de processo.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
