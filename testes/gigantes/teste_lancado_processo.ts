import { idsDoMesmoProcesso } from "../../src/utils/lancadoProcesso";
let f = 0; const ok = (c: boolean, m: string) => { console.log((c ? "ok: " : "FALHOU: ") + m); if (!c) f++; };
const L = [{ id: "a1", processNumber: "5668365-59.2025.8.09.0166" }, { id: "a2", processNumber: "5668365-59.2025.8.09.0166" }, { id: "a3", processNumber: "56683655920258090166" }, { id: "b1", processNumber: "5704118-43.2026.8.09.0166" }, { id: "c1", processNumber: "" }];
const r = idsDoMesmoProcesso(L, L[0]).sort();
ok(JSON.stringify(r) === JSON.stringify(["a1", "a2", "a3"]), "todas as minutas do processo (com ou sem pontuação): " + r);
ok(idsDoMesmoProcesso(L, L[3]).join() === "b1", "outro processo não é afetado");
ok(idsDoMesmoProcesso(L, L[4]).join() === "c1", "sem número legível: só a própria");
ok(idsDoMesmoProcesso(L, { id: "novo", processNumber: "5668365-59.2025.8.09.0166" }).sort().join() === "a1,a2,a3,novo", "inclui a minuta clicada mesmo fora da lista");
process.exit(f ? 1 : 0);
