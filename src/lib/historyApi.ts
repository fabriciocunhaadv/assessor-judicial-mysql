// Cliente da API do Histórico em MySQL (server/historyRoutes.ts). Manda o token do Firebase Auth e o gabinete ativo.
import { auth } from './firebase';

export class ErroApiHistorico extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function chamarHistorico<T = any>(tenant: string, metodo: string, caminho: string, corpo?: any, consulta: Record<string, string | number | undefined> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ErroApiHistorico('login necessário', 401);
  const qs = Object.entries(consulta).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const r = await fetch(`/api/db/history${caminho}${qs ? '?' + qs : ''}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'X-Tenant-Id': tenant, ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) {
    const msg = await r.json().then((j) => j?.erro).catch(() => '') || `erro ${r.status}`;
    throw new ErroApiHistorico(msg, r.status);
  }
  return r.json();
}
