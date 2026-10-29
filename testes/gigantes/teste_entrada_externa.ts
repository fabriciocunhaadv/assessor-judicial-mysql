// Caixa de entrada das minutas do Agaia: guarda no navegador antes de confirmar, grava no Histórico em segundo plano, tenta de novo se a rede cair e retoma depois de "atualizar a página".
import { build } from "esbuild";
import path from "node:path";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const raiz = path.resolve(import.meta.dirname, "../..");
const dados = new Map<string, any>();
const req = (v: any) => { const r: any = { result: v }; setTimeout(() => r.onsuccess?.(), 0); return r; };
const loja = { put: (v: any) => { dados.set(v.id, v); return req(v.id); }, get: (k: string) => req(dados.get(k)), getAll: () => req(Array.from(dados.values())), delete: (k: string) => { dados.delete(k); return req(undefined); } };
(globalThis as any).indexedDB = { open: () => { const r: any = { result: { objectStoreNames: { contains: () => true }, transaction: () => ({ objectStore: () => loja }) } }; setTimeout(() => r.onsuccess?.(), 0); return r; } };
(globalThis as any).window = globalThis; (globalThis as any).addEventListener = () => {};
const gravados: any[] = []; let redeCaida = false;
(globalThis as any).__saveToHistory = async (a: any) => { if (redeCaida) throw new Error("Failed to fetch"); gravados.push(a); return { ok: true }; };
const stubs = { name: "stubs", setup(b: any) { b.onResolve({ filter: /historyDb$/ }, (a: any) => ({ path: a.path, namespace: "stub" })); b.onLoad({ filter: /historyDb$/, namespace: "stub" }, () => ({ contents: "export const saveToHistory = (a) => globalThis.__saveToHistory(a);", loader: "js" })); } };
const out = path.join(raiz, "testes/gigantes/.entrada_bundle.mjs");
await build({ entryPoints: [path.join(raiz, "src/utils/entradaExterna.ts")], bundle: true, format: "esm", platform: "node", outfile: out, plugins: [stubs], logLevel: "silent" });
const texto = ["Processo nº: 5285460-70.2025.8.09.0166", "DECISÃO INTERLOCUTÓRIA", "I. RELATÓRIO", "Trata-se de cumprimento de sentença. ".repeat(6), "II. FUNDAMENTAÇÃO", "x ".repeat(80), "III. DISPOSITIVO", "Intimem-se."].join("\n");
const minuta = { processo: "5285460-70.2025.8.09.0166", serventia: "Montes Claros de Goias - Juizado Especial Civel - GO", prompt: "Outros Área Judicial - Fabrício JEC", minutaTexto: texto, origem: "Agaia" };
const espera = async (f: () => boolean, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise((r) => setTimeout(r, 20)); } return f(); };
const m1: any = await import(out + "?a"); const e1 = m1.entradasExternas;
e1.definirContexto({ unidades: [{ id: "mc_jec", name: "Montes Claros de Goiás / Juizado Especial Cível" }], ativa: null, user: { uid: "u1", email: "f@x" } });
const r = await e1.receber(minuta);
ok(r.ok && dados.size === 1, "guarda a minuta no navegador (IndexedDB) antes de confirmar à extensão");
ok(await espera(() => gravados.length === 1), "grava no Histórico em segundo plano");
ok(gravados[0].unitId === "mc_jec" && gravados[0].processNumber === "5285460-70.2025.8.09.0166" && /Fabrício JEC/.test(gravados[0].promptTitle), "na unidade da serventia, com o prompt e o número do processo");
ok(e1.lista()[0].status === "gravada", "o selo do Studio mostra “gravada”");
await e1.receber(minuta); await new Promise((r) => setTimeout(r, 100));
ok(gravados.length === 1, "a esteira reenviou a mesma minuta: não grava duas vezes");
// rede caída: guarda, tenta e fica pendente; quando a rede volta, grava sozinho
dados.clear(); gravados.length = 0; redeCaida = true;
const m2: any = await import(out + "?b"); const e2 = m2.entradasExternas;
e2.definirContexto({ unidades: [], ativa: { id: "montes_claros", name: "Montes Claros / Vara Única" }, user: { uid: "u1" } });
const outra = { ...minuta, processo: "5285461-71.2025.8.09.0166", minutaTexto: texto.replace("5285460-70", "5285461-71") };
const r2 = await e2.receber(outra);
ok(r2.ok, "com a internet caída a minuta é recebida e guardada mesmo assim");
await espera(() => e2.lista()[0]?.status === "tentando");
ok(e2.lista()[0].status === "tentando" && gravados.length === 0, "fica “tentando de novo”, sem perder nada");
// a página é atualizada (módulo novo) com a rede ainda caída, depois a rede volta
const m3: any = await import(out + "?c"); const e3 = m3.entradasExternas;
e3.definirContexto({ unidades: [], ativa: { id: "montes_claros", name: "x" }, user: { uid: "u1" } });
redeCaida = false;
await e3.carregar();
ok(await espera(() => gravados.length === 1), "depois de atualizar a página, o que ficou pendente é retomado e gravado sozinho");
ok(e3.lista()[0].status === "gravada", "e passa a constar como gravada");
// minuta colada à mão: a unidade escolhida vale (mesmo sem nome parecido com a serventia)
dados.clear(); gravados.length = 0;
const m4: any = await import(out + "?d"); const e4 = m4.entradasExternas;
e4.definirContexto({ unidades: [{ id: "a", name: "Comarca A" }, { id: "fp", name: "Fazendas Públicas" }], ativa: { id: "a", name: "Comarca A" }, user: { uid: "u1" } });
await e4.receber({ processo: "5189520-44.2026.8.09.0166", serventia: "Fazendas Públicas", unidadeId: "fp", prompt: "Prompt X", minutaTexto: texto.replace("5285460-70", "5189520-44"), origem: "Colada manualmente" });
await espera(() => gravados.length === 1);
ok(gravados[0]?.unitId === "fp" && gravados[0].promptTitle === "Prompt X" && /Colada manualmente/.test(gravados[0].processTextContext), "minuta colada à mão: grava na unidade escolhida, com o prompt informado e a origem");
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); try { (await import("node:fs")).unlinkSync(out); } catch { /* ok */ }
process.exit(falhas ? 1 : 0);
