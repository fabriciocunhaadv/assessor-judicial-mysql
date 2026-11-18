import assert from "node:assert";
import { selecionarBase } from "../server/baseRelevante";
const lei = (n: number) => Array.from({ length: 60 }, (_, i) => `Art. ${i + 1}. ${n === 1 ? "A concessão de abono de permanência ao servidor público municipal exige requisitos de aposentadoria voluntária." : "O contrato de locação de imóvel urbano rege-se pelo aluguel e pela garantia fiduciária do fiador."}\n`).join("");
const docs = [
  { name: "Modelo curto do gabinete", extractedText: "Siga o estilo objetivo.\nUse itens numerados." },
  { name: "Estatuto do servidor", extractedText: lei(1) },
  { name: "Lei do inquilinato", extractedText: lei(2) },
  { name: "Doutrina enorme", extractedText: lei(2).repeat(6) },
];
const caso = ["O servidor público municipal requer o abono de permanência e a aposentadoria voluntária.", "Minute a sentença."];
const r = selecionarBase(docs, caso, 12000);
assert.ok(r.texto.includes("Modelo curto do gabinete"), "curto entra inteiro");
assert.ok(r.texto.includes("Estatuto do servidor"), "doc relacionado entra");
assert.ok(!r.texto.includes("Lei do inquilinato"), "doc sem relação fica de fora");
assert.ok(r.omitidos.includes("Lei do inquilinato"), "registrado como omitido");
assert.ok(r.totalEnviado <= 12000 + 600, "respeita o teto (" + r.totalEnviado + ")");
const pequeno = selecionarBase(docs.slice(0, 1), caso, 150000);
assert.ok(pequeno.texto.includes("Siga o estilo") && pequeno.omitidos.length === 0, "base pequena vai inteira");
assert.strictEqual(selecionarBase([], caso).texto, "");
console.log("ok", r.enviados.map((e) => `${e.nome}:${e.chars}${e.parcial ? "*" : ""}`).join(" | "));
