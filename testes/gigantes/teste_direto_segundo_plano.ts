// Segundo plano "direto": Turbo e Etapa 1 com autos extensos entregam o pedido ao gerente, que monta o mapa e redige com os autos inteiros, grava no Histórico e publica o andamento.
// Roda com: npx tsx testes/gigantes/teste_direto_segundo_plano.ts (empacota o gerente com esbuild, sem os leitores de PDF; banco local e rede simulados).
import { build } from "esbuild";
import path from "node:path";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const raiz = path.resolve(import.meta.dirname, "../..");
const dados = new Map<string, Map<string, any>>();
const lojas = (n: string) => (dados.has(n) || dados.set(n, new Map()), dados.get(n)!);
const req = (v: any) => { const r: any = { result: v }; setTimeout(() => r.onsuccess?.(), 0); return r; };
const loja = (nome: string, chave: string) => { const m = lojas(nome); return { put: (v: any) => { m.set(v[chave], v); return req(v[chave]); }, get: (k: string) => req(m.get(k)), getAll: (faixa?: any) => req(Array.from(m.values()).filter((v) => !faixa || (faixa.lower <= v[chave] && v[chave] <= faixa.upper))), delete: (k: string) => { m.delete(k); return req(undefined); }, index: () => ({ openKeyCursor: () => { const r: any = {}; setTimeout(() => { r.result = null; r.onsuccess?.(); }, 0); return r; } }) }; };
(globalThis as any).indexedDB = { open: () => { const r: any = { result: { objectStoreNames: { contains: () => true }, transaction: () => { const t: any = { objectStore: (n: string) => loja(n, n === "paginas" ? "chave" : "id") }; setTimeout(() => t.oncomplete?.(), 5); return t; } } }; setTimeout(() => r.onsuccess?.(), 0); return r; } };
(globalThis as any).IDBKeyRange = { bound: (lower: string, upper: string) => ({ lower, upper }), only: (v: any) => ({ lower: v, upper: v }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = globalThis;
(globalThis as any).document = { documentElement: { dataset: {} }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {} }) };
(globalThis as any).addEventListener = () => {}; (globalThis as any).dispatchEvent = () => true;
const chamadas: { rota: string; modo?: string; corpo?: any }[] = []; let recusarTamanho = false;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const rota = String(url).split("?")[0]; let b: any = {}; try { b = JSON.parse(init.body || "{}"); } catch { /* sem corpo */ }
  chamadas.push({ rota, modo: b.modo, corpo: rota === "/api/generate-minute" ? b : undefined });
  const resp = (o: any, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(o), json: async () => o, headers: { get: () => "application/json" } });
  if (rota === "/api/mapa-processo") {
    if (b.modo === "plano") return resp({ total: 2, movs: 150, ultima: 150 });
    if (b.modo === "parte") return resp({ indice: b.indice, eventos: [{ mov: b.indice * 70 + 1, tipo: "Decisão", resumo: "x", situacao: "em_vigor" }], numeroProcesso: "5000001-00.2026.8.09.0042", partes: "A x B" });
    return resp({ mapa: { numeroProcesso: "5000001-00.2026.8.09.0042", eventos: b.eventos || [] }, bloco: "[MAPA DO PROCESSO] teste" });
  }
  if (rota === "/api/generate-minute") {
    if (recusarTamanho) return resp({ error: "Autos grandes para a chave gratuita: a leitura segue em segundo plano.", codigo: "AUTOS_GRANDES_SEGUNDO_PLANO" });
    return resp({ minute: { title: "SENTENÇA", processNumber: "5000001-00.2026.8.09.0042", relatorio: "r", fundamentacao: "f", dispositivo: "d", parties: {} }, analysisId: "an-1" });
  }
  if (rota === "/api/gigante-lote") return resp({ ficha: { resumo: "ficha" }, injecao: { verificado: true } });
  if (rota === "/api/gigante-fusao") return resp({ ficha: { resumo: "fusao" } });
  return resp({ ok: true });
};
const gravados: any[] = [];
const stubs = { name: "stubs", setup(b: any) {
  const alvo = (re: RegExp, conteudo: string) => { b.onResolve({ filter: re }, (a: any) => ({ path: a.path, namespace: "stub" })); b.onLoad({ filter: re, namespace: "stub" }, () => ({ contents: conteudo, loader: "js" })); };
  alvo(/pdfExtractor$/, "export const extractTextFromPdf = async () => ({ text: '', pageCount: 0 });");
  alvo(/ocrPaginas$/, "export const ocrPaginas = async () => ({ textos: {}, emBranco: [], falhas: [] }); export const abrirPdf = async () => ({});");
  alvo(/historyDb$/, "export const saveToHistory = async (a) => { (globalThis.__gravados ||= []).push(a); return { ok: true }; };");
  alvo(/tesesDb$/, "export const getCabinetTeses = async () => ({ isEnabled: false, text: '' });");
  alvo(/apiUsageTracker$/, "export const recordApiExecution = async () => {};");
  alvo(/monitorOperacao$/, "export const registrarOperacao = async () => {};");
  alvo(/apiKeyManager$/, "export const getApiHeaders = (h = {}) => ({ ...h });");
  alvo(/^react-hot-toast$/, "const f = () => 'id'; export const toast = Object.assign(f, { loading: f, success: f, error: f, dismiss() {} }); export default toast;");
  alvo(/pistaNormal$/, "export const instalarObservadorPistaNormal = () => {}; export const pistaNormalOcupada = () => false; export const ultimaAtividadePistaNormal = () => 0;");
} };
(globalThis as any).__gravados = gravados; (globalThis as any).__GIGANTE_FOLGA_MS = 0; (globalThis as any).__GIGANTE_INTERVALO_MS = 0;
const out = path.join(raiz, "testes/gigantes/.direto_bundle.mjs");
await build({ entryPoints: [path.join(raiz, "src/utils/gigantes/gerente.ts")], bundle: true, format: "esm", platform: "node", outfile: out, plugins: [stubs], logLevel: "silent" });
const processo = (movs: number) => Array.from({ length: movs }, (_, i) => `[Página ${i + 1} de ${movs}]\n[Mov. ${i + 1} · Arq. 1 · Pág. 1/1]\nTexto do ato ${i + 1}. ${"conteúdo ".repeat(60)}\nMovimentacao ${i + 1} : ${i + 1 === 150 ? "Conclusos para Sentença" : "Intimação"}\nArquivo 1: a${i + 1}.pdf - Pag.1/1\n`).join("");
const cfg: any = { promptText: "P", promptTitle: "Sentença", actType: "sentenca", unitId: "montes_claros", unitName: "Comarca / Vara", origem: "turbo", direto: true, ocr: false, userUid: "u1" };
const aguardar = async (g: any, f: (j: any) => boolean, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const j = g.lista()[0]; if (j && f(j)) return j; await new Promise((r) => setTimeout(r, 40)); } return g.lista()[0]; };
const mod: any = await import(out); const g = mod.gerenteGigantes;
await g.carregar();
const autos = processo(150);
await g.iniciarComTextos([{ nome: "Autos 5000001-00.2026.8.09.0042", texto: autos, pageCount: 150 }], cfg);
let j = await aguardar(g, (x) => ["concluido", "erro"].includes(x.status));
ok(j.status === "concluido", `modo direto: concluiu (${j.status}${j.erro ? " — " + j.erro : ""})`);
ok(chamadas.some((c) => c.modo === "plano") && chamadas.filter((c) => c.modo === "parte").length === 2 && chamadas.some((c) => c.modo === "consolidar"), "monta o mapa em partes e consolida");
const gm = chamadas.find((c) => c.rota === "/api/generate-minute")?.corpo;
ok(!!gm && gm.mapaProcesso?.startsWith("[MAPA DO PROCESSO") && gm.processText === autos, "a minuta é redigida com o mapa e com os autos INTEIROS (não com dossiê)");
ok(!chamadas.some((c) => c.rota === "/api/gigante-lote"), "não lê em lotes");
ok(gravados.length === 1 && gravados[0].result?.mapaProcesso && !gravados[0].result?.gigante && /íntegra/.test(gravados[0].processTextContext), "grava no Histórico com o mapa, sem o aviso de leitura em lotes");
ok(j.historicoId === gravados[0]?.id && !!j.fim, "o trabalho informa o id do Histórico e o fim (a esteira usa isso para trazer a minuta)");
// segunda rodada: a chave gratuita recusa o tamanho -> cai nos lotes sem perder nada
recusarTamanho = true; chamadas.length = 0; gravados.length = 0;
await g.iniciarComTextos([{ nome: "Autos 5000002", texto: processo(150).replace(/Texto do ato/g, "Outro ato"), pageCount: 150 }], cfg);
j = await aguardar(g, (x) => x.id !== j.id && ["concluido", "erro"].includes(x.status) || x.status === "lendo" && chamadas.some((c) => c.rota === "/api/gigante-lote"), 20000);
ok(chamadas.some((c) => c.rota === "/api/generate-minute" && c.corpo?.aceitaSegundoPlano) && chamadas.some((c) => c.rota === "/api/gigante-lote"), "recusada pela chave gratuita: o mesmo trabalho segue em lotes");
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); try { (await import("node:fs")).unlinkSync(out); } catch { /* ok */ }
process.exit(falhas ? 1 : 0);
