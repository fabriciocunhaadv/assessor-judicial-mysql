const m: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } };
import { assinaturaDosVideos, degravacaoGuardada, guardarDegravacao } from '../src/utils/degravacaoGuardada';
const ok = (c: boolean, t: string) => { if (!c) { console.error('FALHOU:', t); process.exit(1); } console.log('ok:', t); };
const a = assinaturaDosVideos([{ name: 'a.mp4', size: 10 }, { name: 'b.mp4', size: 20 }]);
ok(degravacaoGuardada(a) === '', 'sem guardado, volta vazio');
guardarDegravacao(a, 'x'.repeat(100)); ok(degravacaoGuardada(a).length === 100, 'guarda e devolve para os mesmos vídeos');
ok(degravacaoGuardada(assinaturaDosVideos([{ name: 'a.mp4', size: 11 }])) === '', 'vídeo diferente não reaproveita');
for (let i = 0; i < 7; i++) guardarDegravacao('v' + i, 'y'.repeat(60)); ok(Object.keys(JSON.parse(m['assessor_degravacoes_v1'])).length === 5, 'mantém só as 5 mais recentes');
console.log('TUDO OK');
