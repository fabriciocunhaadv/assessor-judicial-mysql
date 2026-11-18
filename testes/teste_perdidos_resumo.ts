// Processos perdidos: o resumo do registro aponta as irregularidades do caso real (ato no gabinete do Dr. José Cássio com unidade de Montes Claros, sem índice coerente).
import { resumoDoRegistro } from "../server/historyRoutes";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) falhas++; console.log((c ? "ok: " : "FALHOU: ") + m); };
const data = JSON.stringify({ id: "analysis-1", tenant: "gab_dr_jose_cassio_de_sousa", unitId: "montes_claros", processNumber: "5097642-14.2021.8.09.0166", createdBy: "u1", creatorName: "Fabrício", creatorEmail: "f@x.com", result: { minute: { title: "SENTENÇA", judicialUnit: "Montes Claros / Vara Única" } } });
const sem = resumoDoRegistro({ tenant: "gab_dr_jose_cassio_de_sousa", id: "analysis-1", unit_id: "montes_claros", created_by: "u1", date: 1, atualizado_em: 2, data, idx_existe: 0, idx_unit: null });
ok(sem.problemas.some((p) => /não tem linha no índice/i.test(p)) && sem.processo === "5097642-14.2021.8.09.0166" && sem.vara.includes("Vara Única"), "sem linha no índice: aponta o problema e mostra processo e vara");
const dif = resumoDoRegistro({ tenant: "gab_dr_jose_cassio_de_sousa", id: "analysis-1", unit_id: "vara_dr_joviano_carneiro_neto", created_by: "u1", date: 1, atualizado_em: 2, data, idx_existe: 1, idx_unit: "montes_claros" });
ok(dif.problemas.some((p) => /índice/.test(p) && /difere/.test(p)) && dif.problemas.some((p) => /dentro do ato/.test(p)), "unidade do índice e do ato diferentes da coluna: aponta as duas");
const bom = resumoDoRegistro({ tenant: "t", id: "a", unit_id: "montes_claros", created_by: "u1", date: 1, atualizado_em: 2, data: JSON.stringify({ tenant: "t", unitId: "montes_claros", result: { minute: { title: "X" } } }), idx_existe: 1, idx_unit: "montes_claros" });
ok(bom.problemas.length === 0, "registro consistente: nenhum problema");
const ruim = resumoDoRegistro({ tenant: "t", id: "a", unit_id: "u", created_by: "anonymous", date: 1, atualizado_em: 2, data: "{quebrado", idx_existe: 1, idx_unit: "u" });
ok(ruim.problemas.some((p) => /Sem autor/.test(p)), "JSON ilegível não derruba: segue com o que há");
console.log(falhas ? `FALHAS: ${falhas}` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
