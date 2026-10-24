// Sessão do login próprio (substitui o Firebase Auth). O token fica neste navegador e vai em cada chamada à API.
import { UserProfile } from '../types';

export interface AppUser { uid: string; email: string; displayName: string; photoURL?: string | null; getIdToken: () => Promise<string> }
export type PerfilServidor = UserProfile & { superAdmin?: boolean; mustChangePassword?: boolean };

const CHAVE = 'assessor_sessao_v1';
let token: string | null = null;
let perfil: PerfilServidor | null = null;
let pronto = false;
const ouvintes = new Set<(u: AppUser | null) => void>();

const lerToken = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const gravarToken = (t: string | null) => { try { t ? localStorage.setItem(CHAVE, t) : localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } };
const comoUsuario = (p: PerfilServidor): AppUser => ({ uid: p.uid, email: p.email, displayName: p.name, getIdToken: async () => token || '' });
const avisar = () => { const u = perfil ? comoUsuario(perfil) : null; ouvintes.forEach((f) => { try { f(u); } catch (e) { console.warn(e); } }); };

async function api<T = any>(metodo: string, caminho: string, corpo?: any): Promise<T> {
  const r = await fetch(`/api/auth${caminho}`, { method: metodo, headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.erro || `erro ${r.status}`), { status: r.status });
  return j;
}
export const chamarAuth = api;

/** Mesmo formato que o código do app já usava com o Firebase (auth.currentUser, quem está logado). */
export const auth = {
  get currentUser(): AppUser | null { return perfil ? comoUsuario(perfil) : null; },
  get perfil(): PerfilServidor | null { return perfil; },
  onChange(cb: (u: AppUser | null) => void): () => void {
    ouvintes.add(cb);
    if (pronto) cb(perfil ? comoUsuario(perfil) : null);
    return () => { ouvintes.delete(cb); };
  },
  async signOut() { token = null; perfil = null; gravarToken(null); avisar(); },
};

export async function entrar(email: string, password: string): Promise<void> {
  const r = await api<{ token: string; perfil: PerfilServidor }>('POST', '/login', { email, password });
  token = r.token; perfil = r.perfil; gravarToken(token); pronto = true; avisar();
}
export const cadastrar = (name: string, email: string, password: string) => api<{ mensagem: string }>('POST', '/register', { name, email, password });
export async function recarregarPerfil(): Promise<PerfilServidor | null> {
  if (!token) return null;
  try { perfil = (await api<{ perfil: PerfilServidor }>('GET', '/me')).perfil; }
  catch (e: any) { if (e?.status === 401) { token = null; perfil = null; gravarToken(null); } }
  avisar();
  return perfil;
}

// Toda chamada do app às rotas /api (análises, Lupa, Mesa, Turbo, chat...) leva a sessão num cabeçalho próprio; o servidor recusa quem não tem login.
if (typeof window !== 'undefined' && !(window as any).__assessorFetchSessao) {
  (window as any).__assessorFetchSessao = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada: any, opcoes?: RequestInit) => {
    try {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.pathname : '';
      if (token && url.startsWith('/api/') && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
        const h = new Headers(opcoes?.headers || {});
        if (!h.has('X-Assessor-Sessao')) h.set('X-Assessor-Sessao', token);
        return fetchOriginal(entrada, { ...opcoes, headers: h });
      }
    } catch { /* segue sem o cabeçalho */ }
    return fetchOriginal(entrada, opcoes);
  };
}

// ao abrir o sistema: confere a sessão guardada
token = lerToken();
void (async () => {
  if (token) { try { perfil = (await api<{ perfil: PerfilServidor }>('GET', '/me')).perfil; } catch (e: any) { if (e?.status === 401) { token = null; gravarToken(null); } } }
  pronto = true; avisar();
})();
