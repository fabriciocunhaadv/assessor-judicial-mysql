// Partes lidas da minuta externa: só linhas que começam pelo rótulo. Rodar: npx tsx testes/teste_partes_minuta.ts
import { organizarMinutaExterna, pegarParte } from "../src/utils/organizarMinutaExterna";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const A = "Exequente|Autor(?:a|es|as)?|Requerentes?", R = "Executad[oa]s?|R[ée]u?s?|Requerid[oa]s?";
ok(pegarParte("Autor: João da Silva\nRéu: Maria Souza", "Autor(?:a)?") === "João da Silva", "linha com rótulo");
ok(pegarParte("**Requerente:** Ruan Gleivas Gonçalves e Silva", "Requerentes?") === "Ruan Gleivas Gonçalves e Silva", "rótulo em negrito");
ok(pegarParte("- Exequente (menor representado): A. G. M. V.", "Exequentes?") === "A. G. M. V.", "com parênteses e iniciais");
ok(pegarParte("Os menores, representados pela genitora, autora: a genitora e A\nnada", "Autor(?:a)?") === "", "rótulo no meio da frase não conta");
ok(pegarParte("Réu: para", "R[ée]u?") === "", "valor que não parece nome é recusado");
ok(pegarParte("Autora: a genitora e A", "Autor(?:a)?") === "", "valor que começa com artigo é recusado");
const texto = `DECISÃO\n\nProcesso nº 5627216-83.2025.8.09.0166\n\nTrata-se de cumprimento de sentença de alimentos movido por A. G. M. V. e D. M. M. V., menores representados pela genitora, contra Hiago Pires Viana. O autor: a genitora e A tem direito; o réu: para pagar.\n\nI - RELATÓRIO\nTrata-se de cumprimento.\n\nII - FUNDAMENTAÇÃO\nTexto.\n\nIII - DISPOSITIVO\nDefiro.`;
const o = organizarMinutaExterna(texto, "");
ok(o.autor === "" && o.reu === "", `sem linha de rótulo, partes ficam vazias (veio autor="${o.autor}" réu="${o.reu}")`);
const o2 = organizarMinutaExterna("Autor: João da Silva\nRéu: Maria Souza\n\nDECISÃO\n\nI - RELATÓRIO\nx\nII - FUNDAMENTAÇÃO\ny\nIII - DISPOSITIVO\nz", "");
ok(o2.autor === "João da Silva" && o2.reu === "Maria Souza", "com linhas de rótulo, lê as partes");
if (falhas) process.exit(1); console.log("TUDO OK");
