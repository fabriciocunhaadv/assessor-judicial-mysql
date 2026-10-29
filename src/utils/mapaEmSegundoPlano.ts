// Mapa do processo em segundo plano: cada parte lida é gravada no navegador (IndexedDB). O usuário pode navegar por outras telas;
// se a página for atualizada ou fechada, o mapa retoma da parte em que parou, e um mapa já pronto do mesmo texto é reaproveitado.
import { getApiHeaders } from "./apiKeyManager";
import type { MapaProcesso } from "./mapaDoProcesso";

export interface TarefaMapa {
  id: string;                      // resumo (hash) do texto dos autos
  nome: string;
  numeroProcesso?: string;
  status: "planejando" | "lendo" | "consolidando" | "concluido" | "erro" | "cancelado";
  etapa: string;
  partesTotal: number;
  partesFeitas: number;
  partesFalhas: number;
  movs: number;
  ultima: number;
  partes: Record<number, { eventos: any[]; numeroProcesso: string; partes: string }>;
  mapa?: MapaProcesso;
  bloco?: string;
  erro?: string;
  texto?: string;                  // só enquanto não concluído (para retomar depois de atualizar a página)
  criadoEm: number;
  atualizadoEm: number;
}
export interface MapaPronto { mapa: MapaProcesso; bloco: string }

const NOME_BANCO = "assessor_mapas_v1";
/** O histórico temporário do mapa (e de tentativas paradas) é apagado sozinho depois de 24 horas. */
export const VALIDADE_MAPA_MS = 24 * 3600_000;
const vencida = (t: TarefaMapa) => !EM_ANDAMENTO.includes(t.status) && Date.now() - t.atualizadoEm > VALIDADE_MAPA_MS;
const EM_ANDAMENTO = ["planejando", "lendo", "consolidando"];

let abrindo: Promise<IDBDatabase> | null = null;
const abrir = (): Promise<IDBDatabase> => abrindo ||= new Promise((ok, falha) => {
  const rq = indexedDB.open(NOME_BANCO, 1);
  rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("mapas")) rq.result.createObjectStore("mapas", { keyPath: "id" }); };
  rq.onsuccess = () => ok(rq.result); rq.onerror = () => { abrindo = null; falha(rq.error); };
});
const pedido = <T,>(rq: IDBRequest<T>): Promise<T> => new Promise((ok, falha) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => falha(rq.error); });
const gravarBanco = async (t: TarefaMapa) => { const db = await abrir(); await pedido(db.transaction("mapas", "readwrite").objectStore("mapas").put(JSON.parse(JSON.stringify(t)))); };
const lerBanco = async (id: string): Promise<TarefaMapa | undefined> => pedido((await abrir()).transaction("mapas").objectStore("mapas").get(id));
const listarBanco = async (): Promise<TarefaMapa[]> => pedido((await abrir()).transaction("mapas").objectStore("mapas").getAll());
const apagarBanco = async (id: string) => { await pedido((await abrir()).transaction("mapas", "readwrite").objectStore("mapas").delete(id)); };

/** FNV-1a de 32 bits sobre o texto inteiro + tamanho: identifica os mesmos autos. */
export function resumoDosAutos(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `mapa-${texto.length.toString(36)}-${h.toString(36)}`;
}

type Ouvinte = (t: TarefaMapa[]) => void;
class GerenteMapas {
  private tarefas = new Map<string, TarefaMapa>();
  private ouvintes = new Set<Ouvinte>();
  private rodando = new Map<string, Promise<MapaPronto | null>>();
  private cancelar = new Set<string>();
  private carregado: Promise<void> | null = null;

  inscrever(fn: Ouvinte) { this.ouvintes.add(fn); fn(this.lista()); return () => { this.ouvintes.delete(fn); }; }
  lista(): TarefaMapa[] { return Array.from(this.tarefas.values()).sort((a, b) => b.criadoEm - a.criadoEm); }
  private avisar() { const l = this.lista(); this.ouvintes.forEach((f) => { try { f(l); } catch { /* ouvinte com erro */ } }); }
  private async gravar(t: TarefaMapa) { t.atualizadoEm = Date.now(); this.tarefas.set(t.id, t); this.avisar(); try { await gravarBanco(t); } catch (e) { console.warn("[Mapa] não consegui gravar o andamento:", e); } }

  /** Lê o banco local e retoma sozinho o que estava em andamento quando a página foi atualizada ou fechada. */
  carregar(): Promise<void> {
    return this.carregado ||= (async () => {
      try {
        for (const t of await listarBanco()) {
          if (vencida(t)) { await apagarBanco(t.id).catch(() => {}); continue; }
          this.tarefas.set(t.id, t);
        }
      } catch (e) { console.warn("[Mapa] banco local indisponível:", e); }
      this.avisar();
      if (typeof setInterval === "function") { const iv: any = setInterval(() => { void this.limparVencidas(); }, 10 * 60_000); iv?.unref?.(); }      // com a página aberta por muito tempo, a limpeza também acontece sozinha
      for (const t of this.tarefas.values()) if (EM_ANDAMENTO.includes(t.status) && t.texto) void this.garantir(t.texto, { nome: t.nome, numeroProcesso: t.numeroProcesso }).catch(() => null);
    })();
  }

  /** Apaga o que passou de 24 horas (mapas prontos, erros e cancelados). */
  async limparVencidas() {
    let mudou = false;
    for (const t of Array.from(this.tarefas.values())) if (vencida(t)) { this.tarefas.delete(t.id); mudou = true; try { await apagarBanco(t.id); } catch { /* ignora */ } }
    if (mudou) this.avisar();
  }

  /** O mapa destes autos, se já estiver pronto (guardado no navegador por 7 dias). */
  async pronto(autos: string): Promise<MapaPronto | null> {
    await this.carregar();
    const t = this.tarefas.get(resumoDosAutos(autos));
    return t?.status === "concluido" && t.mapa && t.bloco && !vencida(t) ? { mapa: t.mapa, bloco: t.bloco } : null;
  }

  /** Devolve o mapa dos autos: reaproveita o que já está pronto, retoma o que estava parado ou começa um novo. Nunca lança erro: devolve null se não conseguir. */
  async garantir(autos: string, info: { nome?: string; numeroProcesso?: string } = {}): Promise<MapaPronto | null> {
    await this.carregar();
    const id = resumoDosAutos(autos);
    const andando = this.rodando.get(id); if (andando) return andando;
    let t = this.tarefas.get(id);
    if (t?.status === "concluido" && t.mapa && t.bloco && !vencida(t)) return { mapa: t.mapa, bloco: t.bloco };
    if (!t) t = { id, nome: info.nome || "Autos do processo", numeroProcesso: info.numeroProcesso, status: "planejando", etapa: "Preparando o mapa do processo…", partesTotal: 0, partesFeitas: 0, partesFalhas: 0, movs: 0, ultima: 0, partes: {}, texto: autos, criadoEm: Date.now(), atualizadoEm: Date.now() };
    else { t.texto = autos; t.status = "planejando"; t.erro = undefined; t.etapa = "Retomando o mapa do processo…"; }
    this.cancelar.delete(id);
    const tarefa = t;      // o registro em `rodando` é feito antes de qualquer espera, para um pedido repetido se juntar a este
    const p = (async () => { await this.gravar(tarefa); return this.executar(tarefa); })().finally(() => { this.rodando.delete(id); });
    this.rodando.set(id, p);
    return p;
  }

  private async chamar(corpo: any, ms = 6 * 60_000): Promise<any> {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
    try {
      const resp = await fetch("/api/mapa-processo", { method: "POST", headers: getApiHeaders({ "x-progresso-id": `mapa-${Date.now().toString(36)}` }), body: JSON.stringify(corpo), signal: ctl.signal });
      const txt = await resp.text();
      let j: any = {}; try { j = JSON.parse(txt.trim()); } catch { /* resposta incompleta */ }
      if (j?.error) throw new Error(String(j.error));
      if (!resp.ok && !Object.keys(j).length) throw new Error(`Servidor respondeu ${resp.status}.`);
      return j;
    } finally { clearTimeout(to); }
  }

  private async executar(t: TarefaMapa): Promise<MapaPronto | null> {
    const autos = t.texto || "";
    const parou = () => this.cancelar.has(t.id);
    try {
      const plano = await this.chamar({ modo: "plano", processText: autos }, 60_000);
      t.partesTotal = Number(plano.total) || 0; t.movs = Number(plano.movs) || 0; t.ultima = Number(plano.ultima) || 0;
      if (!t.partesTotal) throw new Error("Não foi possível dividir os autos para o mapa.");
      t.status = "lendo"; t.partesFeitas = Object.keys(t.partes).length; t.partesFalhas = 0;
      t.etapa = `Lendo as partes dos autos (${t.partesFeitas} de ${t.partesTotal})…`; await this.gravar(t);
      const fila = [...Array(t.partesTotal).keys()].filter((i) => !t.partes[i]);
      const trabalhador = async () => {
        while (fila.length && !parou()) {
          const i = fila.shift()!;
          let ok = false;
          for (let tentativa = 0; tentativa < 3 && !ok && !parou(); tentativa++) {
            try {
              const r = await this.chamar({ modo: "parte", indice: i, processText: autos }, 5 * 60_000);
              t.partes[i] = { eventos: Array.isArray(r.eventos) ? r.eventos : [], numeroProcesso: String(r.numeroProcesso || ""), partes: String(r.partes || "") }; ok = true;
            } catch (e: any) { if (tentativa < 2) await new Promise((r) => setTimeout(r, 4000 * (tentativa + 1))); else console.warn(`[Mapa] parte ${i + 1} falhou:`, e?.message || e); }
          }
          if (!ok) t.partesFalhas++;
          t.partesFeitas = Object.keys(t.partes).length;
          t.etapa = `Lendo as partes dos autos (${t.partesFeitas} de ${t.partesTotal})…`; await this.gravar(t);
        }
      };
      await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
      if (parou()) { t.status = "cancelado"; t.etapa = "Cancelado."; await this.gravar(t); return null; }
      if (Object.keys(t.partes).length === 0) throw new Error("A IA não respondeu em nenhuma parte dos autos.");
      t.status = "consolidando"; t.etapa = "Amarrando o estado atual do processo…"; await this.gravar(t);
      const ordem = Object.keys(t.partes).map(Number).sort((a, b) => a - b);
      const eventos = ordem.flatMap((i) => t.partes[i].eventos);
      const numero = ordem.map((i) => t.partes[i].numeroProcesso).find(Boolean) || "", partesProc = ordem.map((i) => t.partes[i].partes).find(Boolean) || "";
      const r = await this.chamar({ modo: "consolidar", processText: autos, eventos, numeroProcesso: numero, partesProc }, 6 * 60_000);
      if (!r?.mapa || typeof r.bloco !== "string") throw new Error("A IA não devolveu um mapa utilizável.");
      t.mapa = r.mapa; t.bloco = r.bloco; t.numeroProcesso = t.numeroProcesso || r.mapa.numeroProcesso || numero || undefined;
      t.status = "concluido"; t.etapa = `Mapa pronto (${t.movs} movimentações, até a Mov. ${t.ultima}).`; t.texto = undefined; t.partes = {};
      await this.gravar(t);
      return { mapa: t.mapa, bloco: t.bloco };
    } catch (e: any) {
      t.status = "erro"; t.erro = String(e?.message || e).slice(0, 400); t.etapa = "Não consegui concluir o mapa (as partes já lidas ficaram guardadas)."; await this.gravar(t);
      return null;
    }
  }

  /** Botão "Tentar de novo": retoma da parte em que parou. */
  async tentarDeNovo(id: string) { const t = this.tarefas.get(id); if (t?.texto) await this.garantir(t.texto, { nome: t.nome, numeroProcesso: t.numeroProcesso }); }
  async cancelarTarefa(id: string) { this.cancelar.add(id); const t = this.tarefas.get(id); if (t && !this.rodando.has(id)) { t.status = "cancelado"; t.etapa = "Cancelado."; await this.gravar(t); } }
  async remover(id: string) { this.cancelar.add(id); this.tarefas.delete(id); this.avisar(); try { await apagarBanco(id); } catch { /* ignora */ } }
}
export const gerenteMapas = new GerenteMapas();
