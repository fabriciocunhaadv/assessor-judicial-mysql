// Rodar: npx tsx testes/teste_fontes_pendentes.ts
import assert from "node:assert";
import { extrairCitacoes } from "../src/utils/citacoesFontes";
import { jaTemNaBase, fundirOcorrencia, hostPermitido, type ContextoBase } from "../server/fontesPendentes";
const base: ContextoBase = {
  outras: [{ esfera: "estadual", ente: "Goiás", tipo: "lei", numero: "21792", ano: 2023 }, { esfera: "municipal", ente: "Montes Claros de Goiás", tipo: "lei", numero: "1234", ano: 2015 }, { esfera: "estadual", ente: "Goiás", tipo: "constituição estadual", numero: "0", ano: 1989 }],
  precedentes: [{ tribunal: "STJ", type: "sumula", number: "297" }, { tribunal: "STF", type: "sumula_vinculante", number: "25" }, { tribunal: "STJ", type: "tese_repetitivo", number: "1061" }],
};
const tem = (t: string) => extrairCitacoes(t).map((c) => [c.rotulo, jaTemNaBase(c, base)] as const);
// federais do catálogo do Planalto (CPC, CDC, Lei 14.905/2024, DPVAT) já estão na base
for (const [r, ok] of tem("Lei nº 13.105/2015 e Lei 8.078/90 e Lei nº 14.905/2024 e Lei nº 6.194/1974")) assert.ok(ok, `${r} está no catálogo do Planalto`);
// federal que NÃO está no catálogo
assert.deepEqual(tem("a Lei nº 9.999/1999"), [["Lei 9999/1999", false]]);
// estadual e municipal conferem por número, ano e ente
assert.deepEqual(tem("Lei Estadual nº 21.792/2023"), [["Lei Estadual 21792/2023", true]]);
assert.deepEqual(tem("Lei Estadual nº 21.793/2023"), [["Lei Estadual 21793/2023", false]]);
assert.equal(tem("Lei Municipal nº 1.234/2015 do Município de Montes Claros de Goiás")[0][1], true);
assert.equal(tem("Lei Municipal nº 1.234/2015 do Município de Goiânia")[0][1], false, "mesmo número em outro município não vale");
assert.equal(tem("Lei nº 21.792/2023")[0][1], true, "esfera indefinida: basta existir a lei na base");
// constituições
assert.deepEqual(Object.fromEntries(tem("Constituição Federal e Constituição do Estado de Goiás")), { "Constituição Federal de 1988": true, "Constituição do Estado de Goiás": true });
// súmulas e temas
assert.deepEqual(Object.fromEntries(tem("Súmula 297 do STJ; Súmula 54 do STJ; Súmula Vinculante 25; Tema 1.061 do STJ; Tema 999 do STJ")), { "Súmula 297 do STJ": true, "Súmula 54 do STJ": false, "Súmula Vinculante 25 do STF": true, "Tema 1061 do STJ": true, "Tema 999 do STJ": false });
// tratados nunca estão na base
assert.equal(tem("a Convenção sobre os Direitos da Criança")[0][1], false);
// fusão de ocorrências
const c = extrairCitacoes("Lei nº 9.999/1999")[0];
let f = fundirOcorrencia(null, c, "normal", 1000); f = fundirOcorrencia(f, c, "turbo", 2000); f = fundirOcorrencia(f, c, "normal", 3000);
assert.equal(f.ocorrencias, 3); assert.deepEqual(f.motores, { normal: 2, turbo: 1 }); assert.equal(f.primeira, 1000); assert.equal(f.ultima, 3000); assert.equal(f.status, "pendente");
// só os sites que a extensão pode abrir
assert.ok(hostPermitido("https://leisestaduais.com.br/go") && hostPermitido("https://acessoainformacao.montesclarosdegoias.go.leg.br/cidadao/legislacao/leis"));
assert.ok(!hostPermitido("http://leisestaduais.com.br/go") && !hostPermitido("https://evil.com/x") && !hostPermitido("https://leisestaduais.com.br.evil.com/"));
console.log("OK fontes pendentes (núcleo)");
