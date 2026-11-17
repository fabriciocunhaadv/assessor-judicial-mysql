import { agregarPadroes, montarPromptResumo, lerRespostaResumo, type DocComparacao } from "../server/calibragemMinutas";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const corte = "A parte autora requer a gratuidade da justiça e a inversão do ônus da prova conforme o artigo";
const mk = (i: number, ap: number, disp: boolean, extra: Partial<DocComparacao> = {}): DocComparacao => ({
  processo: `5000${i}`, ato: "SENTENÇA", geradoEm: 1000 + i, promptTitulo: i % 2 ? "Prompt A" : "Prompt B", motor: "turbo", aproveitamentoPct: ap, dispositivoMudou: disp,
  porSecao: [{ secao: "Relatório", aproveitamentoPct: 100 }, { secao: "Dispositivo", aproveitamentoPct: disp ? 40 : 100 }],
  mudancas: [{ tipo: "removido", secao: "Fundamentação", original: corte }, { tipo: "adicionado", secao: "Fundamentação", lancado: "Cumpre ressaltar o entendimento consolidado do tribunal local sobre o tema" }], ...extra });
const docs = [mk(1, 90, false), mk(2, 70, true), mk(3, 80, false, { assinado: { aproveitamentoLancadaPct: 96, aproveitamentoGeradaPct: 78, dispositivoMudouDaLancada: false } })];
const p = agregarPadroes(docs);
ok(p.total === 3 && p.aproveitamentoMedioPct === 80, `média ${p.aproveitamentoMedioPct}`);
ok(p.dispositivoAlteradoPct === 33, "um terço com dispositivo alterado");
ok(p.porSecao.find((s) => s.secao === "Dispositivo")?.aproveitamentoPct === 80, "média por seção");
ok(p.porPrompt.length === 2 && p.porPrompt[0].nome === "Prompt A" && p.porPrompt[0].n === 2, "agrupa por prompt");
ok(p.maisCortados[0]?.vezes === 3 && p.maisAcrescentados[0]?.vezes === 3, "trecho repetido nas 3 minutas aparece com a contagem");
ok(p.assinados.n === 1 && p.assinados.aproveitamentoLancadaPct === 96 && p.assinados.aproveitamentoGeradaPct === 78, "dados do documento assinado");
const vazio = agregarPadroes([]); ok(vazio.total === 0 && vazio.aproveitamentoMedioPct === 0 && vazio.assinados.aproveitamentoGeradaPct === null, "sem dados não quebra");
const pr = montarPromptResumo(docs, p);
ok(pr.includes("3 comparação") && pr.includes("Prompt A") && pr.includes("ERA:") && pr.includes("SOMENTE um JSON"), "pedido à IA leva números e exemplos curtos");
ok(!pr.includes("textoLancado") && pr.length < 20000, "não leva o texto das minutas");
const r1 = lerRespostaResumo('```json\n{"resumo":"ok","padroes":["a"],"sugestoes":[{"titulo":"t","secao":"Relatório","instrucao":"Seja breve","motivo":"m","confianca":"alta"},{"titulo":"x","confianca":"zzz"}]}\n```');
ok(r1.resumo === "ok" && r1.sugestoes.length === 2 && r1.sugestoes[1].confianca === "baixa", "lê JSON em bloco e normaliza confiança");
const r2 = lerRespostaResumo("texto solto sem json"); ok(r2.resumo === "texto solto sem json" && r2.sugestoes.length === 0, "texto livre vira resumo");
const r3 = lerRespostaResumo('Aqui está: {"resumo":"r","padroes":[],"sugestoes":[]} fim'); ok(r3.resumo === "r", "acha o JSON no meio do texto");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
