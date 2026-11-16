import { readFileSync } from "node:fs";
import { FONTES_COLETA, extrairItens, escolherItens, coletarPrecedentes, chaveDoPrecedente, anoDoItem, AVISO_ORIGEM_COLETA } from "../server/coletorPrecedentes";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const html: Record<string, string> = Object.fromEntries(FONTES_COLETA.map((f) => [f.id, readFileSync(`testes/fixtures/coletor/${f.id}.html`, "utf8")]));
// ---- leitura por fonte
for (const f of FONTES_COLETA) {
  const it = extrairItens(html[f.id], f);
  ok(it.length >= 30, `${f.id}: leu ${it.length} itens`);
  ok(it.every((x) => x.numero > 0 && x.texto !== "Apoio Jurídico" && !/!important|google-anno|Salvar$/.test(x.texto + x.titulo)), `${f.id}: texto limpo (sem lixo de anúncio)`);
  ok(it.filter((x) => x.firme).every((x) => x.texto.length >= 20), `${f.id}: item firme tem texto`);
}
// ---- datas só do rodapé
ok(anoDoItem("Aprovada em 06/08/2026", "tese") === 2026, "Aprovada em → 2026");
ok(anoDoItem("Publicada em 17/12/2024", "x") === 2024, "Publicada em → 2024");
ok(anoDoItem("", "texto (SÚMULA 673, PRIMEIRA SEÇÃO, julgado em 11/9/2024, DJe de 16/9/2024)") === 2024, "julgado em do STJ");
ok(anoDoItem("", "Lei 8.880, de 22/12/2022, é aplicada") === null, "data citada no texto NÃO vale como ano do item");
// ---- escolha
const stj = extrairItens(html["stj-sumulas"], FONTES_COLETA[1]);
const e2026 = escolherItens(stj, 2026), e2027 = escolherItens(stj, 2027);
ok(e2026.escolhidos.every((x) => x.ano == null || (x.ano >= 2024 && x.ano <= 2026)), "2026: janela 2024–2026");
ok(e2027.escolhidos.every((x) => x.ano == null || (x.ano >= 2025 && x.ano <= 2027)), "2027: janela 2025–2027 (a janela anda sozinha)");
const rep = extrairItens(html["stj-teses"], FONTES_COLETA[4]);
ok(rep.some((x) => !x.firme), "STJ temas: há itens sem tese firmada (afetado, em julgamento, cancelado)");
ok(escolherItens(rep, 2026).escolhidos.every((x) => x.firme), "só entra tema com tese firmada");
const muitos = Array.from({ length: 400 }, (_, i) => ({ numero: i + 1, tipo: "tese_repetitivo" as const, rotulo: `Tema ${i + 1}`, titulo: "t", texto: "x".repeat(30), ano: null, situacao: "Julgado", area: "", link: "u", firme: true }));
const e = escolherItens(muitos, 2026); ok(e.escolhidos.length === 150 && Math.min(...e.escolhidos.map((x) => x.numero)) === 251, "sem data: só os 150 de maior número");
// ---- coleta, duplicidade
const gravados: any[] = [];
const r1 = await coletarPrecedentes({ existentes: [], htmlPorFonte: html, anoAtual: 2026, gravar: async (l) => { gravados.push(...l); } });
ok(r1.totalNovos > 20 && gravados.length === r1.totalNovos, `1ª coleta cadastrou ${r1.totalNovos}`);
ok(gravados.every((p) => p.origem === "coletor_site_apoio" && p.avisoOrigem === AVISO_ORIGEM_COLETA && p.statement.length > 10 && p.sourceUrl.startsWith("https://")), "todo item vem marcado como coletado do site de apoio, com link");
ok(new Set(gravados.map((p) => p.id)).size === gravados.length, "ids sem repetição");
const r2 = await coletarPrecedentes({ existentes: gravados, htmlPorFonte: html, anoAtual: 2026, gravar: async () => { ok(false, "2ª coleta não deveria gravar nada"); } });
ok(r2.totalNovos === 0 && r2.totalJaExistiam === r1.totalNovos + r1.totalJaExistiam, `2ª coleta: 0 novos e ${r2.totalJaExistiam} já existiam`);
// parte já existe vinda de PDF/base interna com outro id: não duplica
const um = gravados[0], k = chaveDoPrecedente(um);
const r3 = await coletarPrecedentes({ existentes: [{ id: "custom-123", tribunal: um.tribunal, type: um.type, number: um.number }], htmlPorFonte: html, anoAtual: 2026 });
ok(r3.totalNovos === r1.totalNovos - 1, "item que já existe por outro caminho (PDF) não é cadastrado de novo");
ok(chaveDoPrecedente({ tribunal: "STF", number: "Súmula Vinculante 4" }) !== chaveDoPrecedente({ tribunal: "STF", number: "Súmula 4" }), "SV 4 ≠ Súmula 4");
// simulação não grava
let gravou = false; const r4 = await coletarPrecedentes({ existentes: [], htmlPorFonte: html, anoAtual: 2026, simular: true, gravar: async () => { gravou = true; } });
ok(!gravou && r4.simulado && r4.totalNovos === r1.totalNovos, "simulação mostra o que entraria e não grava");
// falha de uma fonte não derruba as outras
const r5 = await coletarPrecedentes({ existentes: [], htmlPorFonte: { ...html, "stf-teses": "<html>bloqueado</html>" }, anoAtual: 2026, simular: true });
ok(r5.fontes.find((f) => f.id === "stf-teses")?.ok === false && r5.fontes.filter((f) => f.ok).length === 5, "uma fonte com erro não derruba as outras");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
