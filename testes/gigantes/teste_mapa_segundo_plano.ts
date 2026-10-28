// Mapa em segundo plano: grava cada parte, retoma depois de "atualizar a página" e reaproveita o mapa pronto. IndexedDB e fetch simulados.
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
// IndexedDB mínimo em memória (sobrevive à "recarga", como o do navegador)
const dados = new Map<string, any>();
const req = (v: any) => { const r: any = { result: v }; setTimeout(() => r.onsuccess?.(), 0); return r; };
const store = { put: (v: any) => { dados.set(v.id, v); return req(v.id); }, get: (k: string) => req(dados.get(k)), getAll: () => req(Array.from(dados.values())), delete: (k: string) => { dados.delete(k); return req(undefined); } };
(globalThis as any).indexedDB = { open: () => { const r: any = { result: { objectStoreNames: { contains: () => true }, transaction: () => ({ objectStore: () => store }) } }; setTimeout(() => r.onsuccess?.(), 0); return r; } };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const chamadas: any[] = []; let derrubarNaParte: number | null = null;
(globalThis as any).fetch = async (_u: string, init: any) => {
  const b = JSON.parse(init.body); chamadas.push({ modo: b.modo, indice: b.indice });
  const resp = (o: any, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(o) });
  if (b.modo === "plano") return resp({ total: 4, movs: 157, ultima: 157 });
  if (b.modo === "parte") { if (derrubarNaParte === b.indice) return resp({ error: "503 alta demanda" }, 503); return resp({ indice: b.indice, eventos: [{ mov: b.indice * 40 + 1, tipo: "Decisão", resumo: "x", situacao: "em_vigor" }], numeroProcesso: "5000001-00.2026.8.09.0042", partes: "A x B" }); }
  if (b.modo === "consolidar") return resp({ mapa: { numeroProcesso: "5000001-00.2026.8.09.0042", eventos: b.eventos }, bloco: "[MAPA DO PROCESSO] teste" });
  return resp({ error: "modo inesperado" }, 400);
};
const autos = "[Página 1 de 1]\n" + "texto dos autos ".repeat(300);
(async () => {
  const mod1: any = await import(String("../../src/utils/mapaEmSegundoPlano.ts?a"));
  derrubarNaParte = 2;                                             // a parte 3 (índice 2) sempre falha: o mapa segue com as demais
  const p1 = mod1.gerenteMapas.garantir(autos, { nome: "Autos teste" });
  const mesma = mod1.gerenteMapas.garantir(autos);                  // pedido repetido enquanto roda: junta-se ao que já está andando
  const r = await p1;
  ok(!!r && r.bloco.startsWith("[MAPA DO PROCESSO"), "monta o mapa lendo parte por parte e consolidando");
  ok((await mesma) === r || (await mesma)?.bloco === r?.bloco, "pedido repetido durante a execução não duplica o trabalho");
  ok(chamadas.filter((c) => c.modo === "plano").length === 1, "divide uma vez só");
  const t = mod1.gerenteMapas.lista()[0];
  ok(t.status === "concluido" && t.partesFalhas === 1 && t.partesFeitas === 3, `uma parte com falha não impede o mapa (feitas ${t.partesFeitas}, falhas ${t.partesFalhas})`);
  ok(chamadas.filter((c) => c.modo === "parte" && c.indice === 2).length === 3, "tenta a parte com falha 3 vezes");
  const antes = chamadas.length;
  const r2 = await mod1.gerenteMapas.garantir(autos);
  ok(!!r2 && chamadas.length === antes, "mapa já pronto do mesmo texto é reaproveitado sem chamar a IA");
  // "atualizar a página" durante a leitura: duas partes já gravadas, o resto falta
  dados.clear(); chamadas.length = 0; derrubarNaParte = null;
  const id = mod1.resumoDosAutos(autos);
  dados.set(id, { id, nome: "Autos teste", status: "lendo", etapa: "x", partesTotal: 4, partesFeitas: 2, partesFalhas: 0, movs: 157, ultima: 157, partes: { 0: { eventos: [{ mov: 1, tipo: "Decisão", resumo: "a" }], numeroProcesso: "", partes: "" }, 1: { eventos: [{ mov: 41, tipo: "Decisão", resumo: "b" }], numeroProcesso: "", partes: "" } }, texto: autos, criadoEm: Date.now(), atualizadoEm: Date.now() });
  const mod2: any = await import(String("../../src/utils/mapaEmSegundoPlano.ts?b"));   // módulo novo = página nova
  await mod2.gerenteMapas.carregar();
  for (let i = 0; i < 100 && mod2.gerenteMapas.lista()[0]?.status !== "concluido"; i++) await new Promise((r) => setTimeout(r, 20));
  const t2 = mod2.gerenteMapas.lista()[0];
  ok(t2?.status === "concluido", "depois de atualizar a página, o mapa retoma sozinho e conclui");
  ok(chamadas.filter((c) => c.modo === "parte").map((c) => c.indice).sort().join() === "2,3", `retoma só das partes que faltavam (${chamadas.filter((c) => c.modo === "parte").map((c) => c.indice).sort()})`);
  ok(chamadas.find((c) => c.modo === "consolidar") && !t2.texto, "ao concluir, descarta o texto dos autos guardado");
  console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK"); process.exit(falhas ? 1 : 0);
})();
