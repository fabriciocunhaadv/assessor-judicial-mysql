import { aplicarUnidade, lerPedidoDeLote } from "../../src/utils/mudarUnidade";
const erros: string[] = [];
const ato = { id: "a1", unitId: "montes_claros", processNumber: "5033370-53.2025.8.09.0042", createdBy: "u1", result: { minute: { judicialUnit: "Montes Claros de Goiás - Vara Cível", comarca: "Montes Claros", relatorio: "texto" }, score: 90 }, lancadoProjudi: 123 };
const novo = aplicarUnidade(ato, { unitId: "fazenda_nova", judicialUnit: "Fazenda Nova - Vara Cível" });
if (novo.unitId !== "fazenda_nova" || novo.result.minute.judicialUnit !== "Fazenda Nova - Vara Cível") erros.push("não trocou a unidade");
if (novo.result.minute.comarca !== "Montes Claros" || novo.result.minute.relatorio !== "texto" || novo.result.score !== 90 || novo.lancadoProjudi !== 123 || novo.createdBy !== "u1") erros.push("mexeu no que não devia");
if (ato.unitId !== "montes_claros" || ato.result.minute.judicialUnit !== "Montes Claros de Goiás - Vara Cível") erros.push("alterou o original (deve devolver cópia)");
const semResultado = aplicarUnidade({ id: "a2", unitId: "x" }, { unitId: "y", judicialUnit: "Y" });
if (semResultado.unitId !== "y" || "result" in semResultado) erros.push("ato sem resultado");
const com = aplicarUnidade(ato, { unitId: "y", judicialUnit: "Y", comarca: "Comarca Y", vara: "Vara Y" });
if (com.result.minute.comarca !== "Comarca Y" || com.result.minute.vara !== "Vara Y") erros.push("comarca/vara do destino");
const bom = lerPedidoDeLote({ ids: ["a", "a", " b ", ""], processos: ["5033370-53.2025.8.09.0042"], unitId: "fazenda_nova", judicialUnit: " Fazenda Nova ", comarca: "" });
if ("erro" in bom || bom.ids.join() !== "a,b" || bom.processos.length !== 1 || bom.destino.judicialUnit !== "Fazenda Nova" || bom.destino.comarca !== undefined) erros.push("pedido válido: " + JSON.stringify(bom));
for (const [b, msg] of [[{ ids: ["a"], judicialUnit: "X" }, "unidade"], [{ unitId: "x", judicialUnit: "X" }, "nada"], [null, "unidade"]] as const) {
  const r: any = lerPedidoDeLote(b); if (!r.erro || !r.erro.toLowerCase().includes(msg)) erros.push("pedido inválido não recusado: " + msg);
}
const muitos = lerPedidoDeLote({ ids: Array.from({ length: 500 }, (_, i) => "i" + i), processos: Array.from({ length: 300 }, (_, i) => "p" + i), unitId: "x", judicialUnit: "X" }) as any;
if (muitos.ids.length !== 200 || muitos.processos.length !== 100) erros.push("limites do lote");
if (erros.length) { console.error(erros.join("\n")); process.exit(1); }
console.log("OK");
