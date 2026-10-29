// Caixa de entrada de minutas que chegam prontas de fora (Agaia, pela esteira da extensão). Tudo em segundo plano, sem mexer no que a pessoa está fazendo no Studio:
// 1) a minuta é guardada NO NAVEGADOR (IndexedDB) antes de qualquer coisa e só então a extensão recebe a confirmação;
// 2) depois é gravada no Histórico (servidor) em segundo plano, com nova tentativa sozinha se a internet cair ou a página for atualizada;
// 3) ao abrir o Studio, o que ficou pendente (internet, energia, página fechada) é retomado.
import { saveToHistory } from "./historyDb";
import { montarAnaliseDeMinutaExterna, resolverUnidade, type MinutaExterna } from "./minutaExterna";

export interface EntradaExterna {
  id: string; processo: string; serventia?: string; prompt?: string;
  status: "recebida" | "gravando" | "gravada" | "tentando"; erro?: string; tentativas: number;
  recebidoEm: number; atualizadoEm: number; historicoId?: string; dados: MinutaExterna;
  formato?: number;      // versão do jeito de montar a minuta no Histórico: ao melhorar, o mesmo texto reenviado é regravado (mesmo id, sem duplicar)
}
export interface ContextoEntrada { unidades: any[]; ativa: any; user: any }

const NOME = "assessor_entrada_externa_v1";
const VALIDADE_GRAVADA_MS = 24 * 3600_000;
const FORMATO = 2;
let abrindo: Promise<IDBDatabase> | null = null;
const abrir = (): Promise<IDBDatabase> => abrindo ||= new Promise((ok, falha) => {
  const rq = indexedDB.open(NOME, 1);
  rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("itens")) rq.result.createObjectStore("itens", { keyPath: "id" }); };
  rq.onsuccess = () => ok(rq.result); rq.onerror = () => { abrindo = null; falha(rq.error); };
});
const pedido = <T,>(rq: IDBRequest<T>): Promise<T> => new Promise((ok, falha) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => falha(rq.error); });
const gravarBanco = async (e: EntradaExterna) => { const db = await abrir(); await pedido(db.transaction("itens", "readwrite").objectStore("itens").put(JSON.parse(JSON.stringify(e)))); };
const listarBanco = async (): Promise<EntradaExterna[]> => pedido((await abrir()).transaction("itens").objectStore("itens").getAll());
const apagarBanco = async (id: string) => { await pedido((await abrir()).transaction("itens", "readwrite").objectStore("itens").delete(id)); };

type Ouvinte = (l: EntradaExterna[]) => void;
class Entradas {
  private itens = new Map<string, EntradaExterna>();
  private ouvintes = new Set<Ouvinte>();
  private ctx: ContextoEntrada | null = null;
  private gravandoAgora = new Set<string>();
  private carregado: Promise<void> | null = null;

  definirContexto(c: ContextoEntrada) { this.ctx = c; }
  inscrever(fn: Ouvinte) { this.ouvintes.add(fn); fn(this.lista()); return () => { this.ouvintes.delete(fn); }; }
  lista(): EntradaExterna[] { return Array.from(this.itens.values()).sort((a, b) => b.recebidoEm - a.recebidoEm); }
  private avisar() { const l = this.lista(); this.ouvintes.forEach((f) => { try { f(l); } catch { /* ouvinte com erro */ } }); }
  private async guardar(e: EntradaExterna) { e.atualizadoEm = Date.now(); this.itens.set(e.id, e); this.avisar(); try { await gravarBanco(e); } catch (err) { console.warn("[Agaia] não consegui guardar no navegador:", err); } }

  /** Lê o que ficou guardado e retoma sozinho as gravações pendentes (página atualizada, internet ou energia que caiu). */
  carregar(): Promise<void> {
    return this.carregado ||= (async () => {
      try { for (const e of await listarBanco()) { if (e.status === "gravada" && Date.now() - e.atualizadoEm > VALIDADE_GRAVADA_MS) { await apagarBanco(e.id).catch(() => {}); continue; } this.itens.set(e.id, e); } } catch (err) { console.warn("[Agaia] caixa de entrada indisponível:", err); }
      this.avisar();
      if (typeof window !== "undefined") { window.addEventListener("online", () => void this.retomar()); setInterval(() => void this.retomar(), 30_000); }
      void this.retomar();
    })();
  }

  /** Recebe a minuta: guarda no navegador e devolve na hora (a gravação no Histórico segue em segundo plano). */
  async receber(d: MinutaExterna): Promise<{ ok: boolean; id?: string; erro?: string }> {
    await this.carregar();
    if (!d?.minutaTexto || d.minutaTexto.trim().length < 100) return { ok: false, erro: "minuta vazia" };
    const montada = this.montar({ id: "", processo: d.processo, status: "recebida", tentativas: 0, recebidoEm: Date.now(), atualizadoEm: Date.now(), dados: d } as EntradaExterna);
    const id = montada.id;
    const antiga = this.itens.get(id);
    if (antiga?.status === "gravada" && antiga.formato === FORMATO) return { ok: true, id };      // a esteira reenviou a mesma minuta: já está no Histórico
    const e: EntradaExterna = antiga ? { ...antiga, status: "recebida", dados: d, formato: FORMATO, tentativas: 0 } : { id, processo: montada.processNumber, serventia: d.serventia, prompt: d.prompt || d.promptAgaia, status: "recebida", tentativas: 0, recebidoEm: Date.now(), atualizadoEm: Date.now(), dados: d, formato: FORMATO };
    await this.guardar(e);
    void this.gravar(id);
    return { ok: true, id };
  }

  private montar(e: EntradaExterna) {
    const c = this.ctx; const escolhida = e.dados.unidadeId ? (c?.unidades || []).find((u: any) => u.id === e.dados.unidadeId) : null;      // unidade escolhida à mão (minuta colada)
    const un = escolhida ? { id: escolhida.id, name: escolhida.name } : resolverUnidade(e.dados.serventia || "", c?.unidades || [], c?.ativa);
    return montarAnaliseDeMinutaExterna(e.dados, { unitId: un.id, unitName: un.name, uid: c?.user?.uid, nome: c?.user?.displayName || c?.user?.email?.split("@")[0], email: c?.user?.email || "" });
  }

  private async gravar(id: string) {
    const e = this.itens.get(id); if (!e || e.status === "gravada" || this.gravandoAgora.has(id)) return;
    this.gravandoAgora.add(id);
    try {
      e.status = "gravando"; e.tentativas++; await this.guardar(e);
      const analise = this.montar(e);
      const g = await saveToHistory(analise);
      if (g.ok) { e.status = "gravada"; e.historicoId = analise.id; e.erro = undefined; } else { e.status = "tentando"; e.erro = g.erro || "não gravou"; }
    } catch (err: any) { e.status = "tentando"; e.erro = String(err?.message || err); }
    finally { this.gravandoAgora.delete(id); await this.guardar(e); }
  }

  async retomar() { for (const e of Array.from(this.itens.values())) if (e.status !== "gravada" && !this.gravandoAgora.has(e.id)) await this.gravar(e.id); }
  async remover(id: string) { this.itens.delete(id); this.avisar(); try { await apagarBanco(id); } catch { /* ignora */ } }
}
export const entradasExternas = new Entradas();
