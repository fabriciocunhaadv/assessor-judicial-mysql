import { expandirPorSecoes, lerRoteiro, desenvelopar, MARCAS_CONTINGENCIA as M, type EtapaSecao } from "../server/contingenciaSecoes";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const roteiro = JSON.stringify({ topicos: [
  { titulo: "Preliminar", questao: "q1", provas: [{ loc: "Mov. 1, Arq. 1, Pág. 1", trecho: "trecho um" }], normas: ["art. 35"], argumentos: ["a1"] },
  { titulo: "Mérito", questao: "q2", provas: [], normas: [], argumentos: [] },
  { titulo: "Dano moral", questao: "q3", provas: [], normas: [], argumentos: [] }],
  cronologia: [{ loc: "Mov. 1", ato: "Inicial" }], resultados: [{ pedido: "cobrança", resultado: "acolhido", comando: "condenar" }] });
const longo = (n: number, s = "Texto da seção com análise concreta da prova e da norma. ") => s.repeat(n);
const base = { minuta: { relatorio: "Rel curto.", fundamentacao: "Fund curta.", dispositivo: "Julgo procedente o pedido, com condenação do réu ao pagamento de R$ 10.000,00 e custas, nos termos da fundamentação acima, com os acréscimos legais." }, falhas: ["fundamentação com 11 caracteres (mínimo 4200)"], pisos: { rel: 1800, fund: 7000, disp: 500, par: 8 } };

// 1) caminho feliz
{
  const chamadas: { etapa: EtapaSecao; instrucao: string; json?: boolean }[] = []; const progresso: string[] = [];
  const r = await expandirPorSecoes({ ...base, aoProgresso: (t) => progresso.push(t), gerar: async (p) => { chamadas.push(p); return p.etapa === "roteiro" ? roteiro : p.etapa === "topico" ? longo(30) : p.etapa === "relatorio" ? longo(40, "Relatório. ") : longo(10, "Ante o exposto, julgo. "); } });
  ok(r && r.topicos === 3 && r.chamadas === 6, `6 chamadas (roteiro + 3 tópicos + relatório + dispositivo): ${r?.chamadas}`);
  ok(chamadas[0].etapa === "roteiro" && chamadas[0].json === true && chamadas[0].instrucao.includes(M.roteiro) && chamadas[0].instrucao.includes("Fund curta."), "roteiro pede JSON e leva a minuta preliminar");
  ok(chamadas.filter((c) => c.etapa === "topico").length === 3 && chamadas[1].instrucao.includes(M.topico) && chamadas[1].instrucao.includes("trecho um") && chamadas[1].instrucao.includes("art. 35") && chamadas[1].instrucao.includes("Mov. 1, Arq. 1, Pág. 1"), "cada tópico leva as suas provas, normas e localização");
  ok(!chamadas[1].instrucao.includes("já escritos") && chamadas[3].instrucao.includes("Preliminar; Mérito"), "o 3º tópico sabe o que já foi escrito (não repete); o 1º não");
  ok(chamadas.filter((c) => c.etapa === "topico").every((c) => /mínimo (\d+) caracteres/.test(c.instrucao) && Number(/mínimo (\d+) caracteres/.exec(c.instrucao)![1]) >= 900), "cada tópico pede tamanho mínimo (>= 900 caracteres)");
  ok(r!.fundamentacao.split("\n\n").length === 3 && r!.fundamentacao.length > 4000, `fundamentação montada com 3 partes (${r!.fundamentacao.length} caracteres)`);
  ok(r!.relatorio.length > 300 && r!.relatorio !== "Rel curto." && r!.dispositivo.includes("Ante o exposto"), "relatório e dispositivo vêm das chamadas próprias");
  ok(progresso.some((x) => /roteiro/.test(x)) && progresso.some((x) => /tópico 2 de 3/.test(x)) && progresso.some((x) => /relatório/.test(x)) && progresso.some((x) => /dispositivo/.test(x)), "mostra o andamento ao usuário");
  ok(chamadas.find((c) => c.etapa === "dispositivo")!.instrucao.includes("condenar") && chamadas.find((c) => c.etapa === "dispositivo")!.instrucao.includes("Mantenha TODOS os comandos"), "o dispositivo leva o resultado de cada pedido e mantém os comandos do preliminar");
}
// 2) tópico curto: uma nova tentativa pedindo ampliação
{
  let n = 0;
  const r = await expandirPorSecoes({ ...base, gerar: async (p) => { if (p.etapa === "roteiro") return roteiro; if (p.etapa === "topico") { n++; return /ficou CURTA/.test(p.instrucao) ? longo(30) : "curto"; } return longo(20); } });
  ok(r && n === 6, `tópico curto é refeito uma vez (6 chamadas de tópico para 3 tópicos): ${n}`);
  ok(r!.fundamentacao.length > 3000, "a versão ampliada é a que fica");
}
// 3) roteiro inválido duas vezes: null (o servidor mantém o aviso de minuta curta)
{
  let n = 0; const r = await expandirPorSecoes({ ...base, gerar: async () => { n++; return "isto não é JSON"; } });
  ok(r === null && n === 2, `roteiro inválido: 2 tentativas e devolve null (${n})`);
}
// 4) IA falha no relatório e no dispositivo: mantém o preliminar, mas entrega a fundamentação nova
{
  const r = await expandirPorSecoes({ ...base, gerar: async (p) => { if (p.etapa === "roteiro") return roteiro; if (p.etapa === "topico") return longo(30); throw new Error("503"); } });
  ok(r && r.relatorio === "Rel curto." && r.dispositivo === base.minuta.dispositivo && r.fundamentacao.length > 3000, "falha em relatório/dispositivo não derruba: mantém o preliminar e entrega a fundamentação nova");
}
// 5) falha em todos os tópicos: null
{
  const r = await expandirPorSecoes({ ...base, gerar: async (p) => { if (p.etapa === "roteiro") return roteiro; throw new Error("503"); } });
  ok(r === null, "nenhum tópico escrito: null");
}
// 6) desenvelopar
ok(desenvelopar("topico", '{"fundamentacao":"Texto A","relatorio":"R"}') === "Texto A" && desenvelopar("relatorio", '{"relatorio":"R1"}') === "R1" && desenvelopar("dispositivo", '```json\n{"dispositivo":"D1"}\n```') === "D1", "tira o JSON e as cercas de código quando o modelo devolve o campo embrulhado");
ok(desenvelopar("topico", "Parágrafo normal.") === "Parágrafo normal." && desenvelopar("topico", "{ texto que começa com chave") === "{ texto que começa com chave", "texto puro passa intacto");
// 7) roteiro: limites e tolerância
{
  const grande = JSON.stringify({ topicos: Array.from({ length: 20 }, (_, i) => ({ titulo: "T" + i, questao: "q" })), cronologia: [], resultados: [] });
  ok(lerRoteiro(grande)!.topicos.length === 20 && lerRoteiro("```json\n" + roteiro + "\n```")!.topicos.length === 3 && lerRoteiro('texto {"topicos":[{"titulo":"x","questao":"y"}]} fim')!.topicos.length === 1 && lerRoteiro("{}") === null, "lê roteiro com cerca, com texto em volta; sem tópicos = null");
  const chamadas: string[] = []; await expandirPorSecoes({ ...base, maxTopicos: 4, gerar: async (p) => { chamadas.push(p.etapa); return p.etapa === "roteiro" ? grande : longo(30); } });
  ok(chamadas.filter((e) => e === "topico").length === 4, "respeita o máximo de tópicos (4)");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
