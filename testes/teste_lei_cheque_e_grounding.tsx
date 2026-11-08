// Rodar: npx vite-node testes/teste_lei_cheque_e_grounding.tsx
import assert from "node:assert";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decodificar, htmlParaLinhas, extrairArtigos } from "../server/fontesOficiais";
import { AvisoGrounding, rotuloGrounding } from "../src/components/AvisoGrounding";
import { AvisosDaMinuta } from "../src/components/AvisosDaMinuta";

// Lei do Cheque (Planalto): "Art . 1º" com espaço antes do ponto — antes dava 0 artigos e a lei nunca ficava pronta
const buf = fs.readFileSync("testes/fixtures/L7357.html");
let texto: string; try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = decodificar(buf); }
const ex = extrairArtigos(htmlParaLinhas(texto));
assert.equal(ex.total, 71, "a Lei do Cheque tem 71 artigos"); assert.equal(ex.vetados, 2, "arts. 5º e 43 vetados"); assert.ok(ex.artigos["5"].v && ex.artigos["43"].v);
assert.ok(ex.artigos["59"].t.startsWith("Art. 59"), "texto do art. 59 (prescrição em 6 meses)");

// selo do Grounding na tela
assert.equal(rotuloGrounding("ok", 3), "🔎 Pesquisa ao vivo · 3 fonte(s)"); assert.match(rotuloGrounding("desligado"), /desligada/); assert.match(rotuloGrounding("falhou"), /falhou/);
const html = renderToStaticMarkup(<AvisoGrounding info={{ status: "ok", fontes: [{ title: "STJ Súmula 297", url: "https://scon.stj.jus.br/sumula297" }] }} />);
assert.ok(html.includes("STJ Súmula 297") && html.includes('rel="noopener noreferrer"') && html.includes('target="_blank"'));
assert.match(renderToStaticMarkup(<AvisoGrounding info={{ status: "falhou", mensagem: "429 quota" }} />), /429 quota/);
const barra = (r: any) => renderToStaticMarkup(<AvisosDaMinuta result={r} />);
assert.ok(barra({ groundingStatus: "ok", groundingSources: [{ url: "https://x.gov.br/a" }] }).includes("Pesquisa ao vivo · 1 fonte(s)"), "botão do aviso aparece quando executou");
assert.ok(barra({ groundingStatus: "desligado" }).includes("Pesquisa ao vivo desligada"));
assert.ok(!barra({}).includes("Pesquisa ao vivo"), "sem status, nada aparece");

console.log("OK lei do cheque + selo do grounding"); process.exit(0);
