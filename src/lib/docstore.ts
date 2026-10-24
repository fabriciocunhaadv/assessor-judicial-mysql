// Cliente do ARMAZÉM DE DOCUMENTOS em MySQL (server/docsRoutes.ts). Tem os mesmos nomes e o mesmo jeito de uso do Firestore
// (collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot...), para os módulos trocarem só a linha de import.
// "Ao vivo" (onSnapshot) é uma consulta periódica leve: pergunta só "quantos documentos e qual a última alteração" e baixa de novo quando muda.
import { auth } from './sessao';

export class ErroDocstore extends Error { constructor(msg: string, public code: string) { super(msg); } }

async function chamar<T = any>(caminho: string, corpo: any): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ErroDocstore('login necessário', 'unauthenticated');
  const r = await fetch(`/api/db/docs${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(corpo) });
  if (!r.ok) {
    const msg = await r.json().then((j) => j?.erro).catch(() => '') || `erro ${r.status}`;
    throw new ErroDocstore(msg, r.status === 403 ? 'permission-denied' : r.status === 404 ? 'not-found' : r.status === 401 ? 'unauthenticated' : 'unavailable');
  }
  return r.json();
}

// ---------- referências ----------
export interface CollectionReference { tipo: 'colecao'; path: string; id: string }
export interface DocumentReference { tipo: 'doc'; path: string; id: string; parent: CollectionReference }
export interface Query { tipo: 'consulta'; col: string; where: any[]; orderBy: [string, string][]; lim?: number; depois?: string }
type Fonte = CollectionReference | Query;

const juntar = (seg: string[]) => seg.flatMap((s) => String(s).split('/')).filter(Boolean);
export const collection = (_db: any, ...seg: string[]): CollectionReference => { const p = juntar(seg); return { tipo: 'colecao', path: p.join('/'), id: p[p.length - 1] }; };
export const doc = (a: any, ...seg: string[]): DocumentReference => {
  let p: string[];
  if (a && a.tipo === 'colecao') p = [...a.path.split('/'), ...(seg.length ? juntar(seg) : [Math.random().toString(36).slice(2) + Date.now().toString(36)])];
  else p = juntar(seg);
  const id = p[p.length - 1];
  return { tipo: 'doc', path: p.join('/'), id, parent: { tipo: 'colecao', path: p.slice(0, -1).join('/'), id: p[p.length - 2] } };
};

// ---------- consulta ----------
type Restricao = { t: 'where'; c: string; op: string; v: any } | { t: 'order'; c: string; dir: string } | { t: 'limit'; n: number } | { t: 'depois'; id: string };
export const where = (c: string, op: string, v: any): Restricao => ({ t: 'where', c, op, v });
export const orderBy = (c: string, dir: string = 'asc'): Restricao => ({ t: 'order', c, dir });
export const limit = (n: number): Restricao => ({ t: 'limit', n });
export const startAfter = (snap: any): Restricao => ({ t: 'depois', id: snap?.id });
export const documentId = () => '__name__';
export const query = (fonte: Fonte, ...r: Restricao[]): Query => {
  const q: Query = fonte.tipo === 'consulta' ? { ...fonte, where: [...fonte.where], orderBy: [...fonte.orderBy] } : { tipo: 'consulta', col: fonte.path, where: [], orderBy: [] };
  for (const x of r) { if (x.t === 'where') q.where.push([x.c, x.op, x.v]); else if (x.t === 'order') q.orderBy.push([x.c, x.dir]); else if (x.t === 'limit') q.lim = x.n; else q.depois = x.id; }
  return q;
};
const comoConsulta = (f: Fonte): Query => (f.tipo === 'consulta' ? f : { tipo: 'consulta', col: f.path, where: [], orderBy: [] });

// ---------- valores especiais ----------
export const increment = (n: number) => ({ __fv: 'increment', n });
export const arrayUnion = (...v: any[]) => ({ __fv: 'arrayUnion', v });
export const serverTimestamp = () => ({ __fv: 'serverTimestamp' });
export const deleteField = () => ({ __fv: 'deleteField' });
const limpar = (d: any) => JSON.parse(JSON.stringify(d ?? {}));      // tira undefined, como o app já fazia antes de gravar

// ---------- leitura ----------
export interface DocumentSnapshot { id: string; ref: DocumentReference; exists: () => boolean; data: () => any }
export interface QuerySnapshot { docs: DocumentSnapshot[]; size: number; empty: boolean; forEach: (f: (d: DocumentSnapshot) => void) => void; docChanges: () => { type: string; doc: DocumentSnapshot }[] }
const criarDoc = (col: string, id: string, existe: boolean, data: any): DocumentSnapshot => ({ id, ref: doc(null, col, id), exists: () => existe, data: () => (existe ? data : undefined) });
const criarLista = (col: string, itens: { id: string; data: any }[]): QuerySnapshot => {
  const docs = itens.map((i) => criarDoc(col, i.id, true, i.data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (f) => docs.forEach(f), docChanges: () => docs.map((d) => ({ type: 'added', doc: d })) };
};

export const getDoc = async (ref: DocumentReference): Promise<DocumentSnapshot> => {
  const r = await chamar<{ existe: boolean; data?: any }>('/get', { path: ref.path });
  return criarDoc(ref.parent.path, ref.id, r.existe, r.data);
};
export const getDocs = async (fonte: Fonte): Promise<QuerySnapshot> => {
  const q = comoConsulta(fonte);
  const r = await chamar<{ docs: { id: string; data: any }[] }>('/list', { col: q.col, where: q.where, orderBy: q.orderBy, limit: q.lim, startAfterId: q.depois });
  return criarLista(q.col, r.docs);
};
export const getCountFromServer = async (fonte: Fonte): Promise<{ data: () => { count: number } }> => {
  const q = comoConsulta(fonte);
  const r = await chamar<{ count: number }>('/list', { col: q.col, where: q.where, contar: true });
  return { data: () => ({ count: r.count }) };
};

// ---------- escrita ----------
const EVENTO = 'assessor-docstore-mudou';
const avisar = (paths: string[]) => { try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO, { detail: paths })); } catch { /* sem janela */ } };
const enviar = async (ops: { tipo: string; path: string; data?: any }[]) => { await chamar('/escrever', { ops }); avisar(ops.map((o) => o.path.split('/').slice(0, -1).join('/'))); };
export const setDoc = (ref: DocumentReference, data: any, opcoes?: { merge?: boolean }) => enviar([{ tipo: opcoes?.merge ? 'merge' : 'set', path: ref.path, data: limpar(data) }]);
export const updateDoc = (ref: DocumentReference, data: any) => enviar([{ tipo: 'update', path: ref.path, data: limpar(data) }]);
export const deleteDoc = (ref: DocumentReference) => enviar([{ tipo: 'delete', path: ref.path }]);
export const writeBatch = (_db?: any) => {
  const ops: { tipo: string; path: string; data?: any }[] = [];
  const b = {
    set: (ref: DocumentReference, data: any, opcoes?: { merge?: boolean }) => { ops.push({ tipo: opcoes?.merge ? 'merge' : 'set', path: ref.path, data: limpar(data) }); return b; },
    update: (ref: DocumentReference, data: any) => { ops.push({ tipo: 'update', path: ref.path, data: limpar(data) }); return b; },
    delete: (ref: DocumentReference) => { ops.push({ tipo: 'delete', path: ref.path }); return b; },
    commit: async () => { for (let i = 0; i < ops.length; i += 400) await enviar(ops.slice(i, i + 400)); },
  };
  return b;
};

// ---------- "ao vivo" ----------
const INTERVALO = 30000;
export function onSnapshot(fonte: DocumentReference | Fonte, cb: (s: any) => void, erroCb?: (e: any) => void): () => void {
  let cancelado = false, ocupado = false, ultima = '';
  const col = fonte.tipo === 'doc' ? fonte.parent.path : comoConsulta(fonte).col;
  const baixar = async () => {
    if (fonte.tipo === 'doc') {
      const s = await getDoc(fonte); const chave = JSON.stringify(s.data() ?? null) + s.exists();
      if (chave !== ultima) { ultima = chave; if (!cancelado) cb(s); }
    } else {
      const q = comoConsulta(fonte);
      const a = await chamar<{ n: number; m: number }>('/assinatura', { col: q.col });
      const chave = `${a.n}|${a.m}`;
      if (chave === ultima) return;
      const s = await getDocs(fonte); ultima = chave; if (!cancelado) cb(s);
    }
  };
  const verificar = async (forcar: boolean) => {
    if (cancelado || ocupado || (!forcar && typeof document !== 'undefined' && document.hidden)) return;
    ocupado = true;
    try { await baixar(); } catch (e) { if (!cancelado && erroCb) erroCb(e); } finally { ocupado = false; }
  };
  void verificar(true);
  const timer = setInterval(() => { void verificar(false); }, INTERVALO);
  const aoGravar = (ev: Event) => { const caminhos: string[] = (ev as CustomEvent).detail || []; if (caminhos.includes(col)) { ultima = ''; void verificar(true); } };
  if (typeof window !== 'undefined') window.addEventListener(EVENTO, aoGravar);
  return () => { cancelado = true; clearInterval(timer); if (typeof window !== 'undefined') window.removeEventListener(EVENTO, aoGravar); };
}
