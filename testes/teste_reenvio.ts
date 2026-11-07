// Rodar: npm i --no-save fake-indexeddb && npx vite-node testes/teste_reenvio.ts
import assert from "node:assert";
await import("fake-indexeddb/auto");
const store: Record<string,string> = {};
(globalThis as any).localStorage = { getItem: (k:string)=>store[k]??null, setItem:(k:string,v:string)=>{store[k]=v}, removeItem:(k:string)=>{delete store[k]} };
const enviados: any[] = [];
(globalThis as any).fetch = async (url: string, init: any) => { enviados.push({ url, init }); return new Response("{}"); };
const m = await import("../src/utils/reenvioPendente");
await m.guardarRequisicao("A", "/api/generate-minute", '{"x":1}');
assert.ok(await m.temRequisicao("A"));
const n1 = await m.reenviarRequisicao("A"); assert.ok(n1 && n1 !== "A");
assert.equal(enviados[0].url, "/api/generate-minute"); assert.equal(enviados[0].init.body, '{"x":1}'); assert.equal(enviados[0].init.headers["x-progresso-id"], n1);
assert.ok(!(await m.temRequisicao("A"))); assert.ok(await m.temRequisicao(n1!));
const n2 = await m.reenviarRequisicao(n1!); assert.ok(n2);
assert.equal(await m.reenviarRequisicao(n2!), null, "limite de reenvios");
assert.equal(await m.reenviarRequisicao("inexistente"), null);
await m.guardarRequisicao("B", "/x", '{}'); await m.apagarRequisicao("B"); assert.ok(!(await m.temRequisicao("B")));
console.log("OK reenvio"); process.exit(0);
