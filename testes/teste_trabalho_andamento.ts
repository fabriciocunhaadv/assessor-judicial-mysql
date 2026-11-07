// Rodar: npx vite-node testes/teste_trabalho_andamento.ts
import assert from "node:assert";
const store: Record<string,string> = {};
(globalThis as any).localStorage = { getItem: (k:string)=>store[k]??null, setItem:(k:string,v:string)=>{store[k]=v}, removeItem:(k:string)=>{delete store[k]} };
const ds: any = {}; (globalThis as any).document = { documentElement: { dataset: ds } };
const { trabalhoEmAndamento } = await import("../src/utils/trabalhoEmAndamento");
assert.deepStrictEqual(trabalhoEmAndamento(), []);
store["assessor_analise_pendente"] = JSON.stringify({ progId: "x", iniciadoEm: Date.now() });
assert.ok(trabalhoEmAndamento().includes("análise aguardando resultado"));
delete store["assessor_analise_pendente"];
ds.assessorAuto = "1"; assert.ok(trabalhoEmAndamento().includes("esteira automática")); ds.assessorAuto = "0";
assert.deepStrictEqual(trabalhoEmAndamento(), []);
console.log("OK trabalhoEmAndamento");
process.exit(0);
