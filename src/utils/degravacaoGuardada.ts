// Guarda neste navegador a degravação dos vídeos já ouvidos (parte cara e demorada): se a sentença falhar ou o usuário quiser refazê-la
// (outro prompt, por exemplo) com os MESMOS vídeos, não é preciso enviar nem degravar tudo de novo. Fica por 7 dias; guarda só as 5 mais recentes.
const CHAVE = 'assessor_degravacoes_v1', VALIDADE = 7 * 86_400_000;
type Mapa = Record<string, { texto: string; em: number }>;
const ler = (): Mapa => { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch { return {}; } };
export const assinaturaDosVideos = (arqs: { name: string; size: number }[]) => arqs.map((f) => `${f.name}:${f.size}`).join('|');
export function degravacaoGuardada(assin: string): string {
  const r = ler()[assin]; return r && r.texto && Date.now() - r.em < VALIDADE ? r.texto : '';
}
export function guardarDegravacao(assin: string, texto: string) {
  if (!assin || !texto || texto.length < 40) return;
  try {
    const m = ler(); m[assin] = { texto, em: Date.now() };
    const l = Object.entries(m).filter(([, v]) => Date.now() - v.em < VALIDADE).sort((a, b) => b[1].em - a[1].em).slice(0, 5);
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(l)));
  } catch { /* sem espaço: só não guarda */ }
}
