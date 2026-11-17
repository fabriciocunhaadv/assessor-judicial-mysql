import { readFileSync } from "node:fs";
import { PRONTIDAO_AUDITORIA, PRONTIDAO_DO_ATO, REGRA_CONDICIONAL_AUDITORIA } from "../server/prontidaoDoAto";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
ok(/QUESTÃO PRÉVIA A SUPERAR/.test(PRONTIDAO_AUDITORIA), "a Lupa ganhou a exceção da questão prévia");
ok(/gratuidade/.test(PRONTIDAO_AUDITORIA) && /tutela de urgência/.test(PRONTIDAO_AUDITORIA) && /vista ao Ministério Público/.test(PRONTIDAO_AUDITORIA) && /NÃO reduza a nota/.test(PRONTIDAO_AUDITORIA), "cobre gratuidade, tutela, vista ao MP e a nota");
ok(/nunca bloqueante/.test(PRONTIDAO_AUDITORIA), "urgência concreta vira, no máximo, atenção");
ok(!/QUESTÃO PRÉVIA A SUPERAR/.test(PRONTIDAO_DO_ATO), "a geração das minutas NÃO foi alterada (só a Lupa)");
ok(/Gere ALERTA CRÍTICO/.test(PRONTIDAO_AUDITORIA) && /pendência não enfrentada/.test(PRONTIDAO_AUDITORIA), "a regra geral de prontidão continua");
ok(/CONFIRME A CONDIÇÃO NOS AUTOS/.test(REGRA_CONDICIONAL_AUDITORIA) && /autor pessoa jurídica/.test(REGRA_CONDICIONAL_AUDITORIA) && /autor é pessoa física, ainda que a RÉ seja pessoa jurídica/.test(REGRA_CONDICIONAL_AUDITORIA), "regra condicional: confirma a condição e o polo da parte");
ok(/caso aplicável/.test(REGRA_CONDICIONAL_AUDITORIA) && /PROIBIDO/.test(REGRA_CONDICIONAL_AUDITORIA), "proíbe alerta com condição em aberto");
ok(!/REGRA CONDICIONAL/.test(PRONTIDAO_DO_ATO), "geração das minutas não alterada");
{ const fonte = readFileSync(new URL("../server.ts", import.meta.url), "utf8"); ok(fonte.includes("${REGRA_CONDICIONAL_AUDITORIA}"), "a regra entra no prompt da auditoria (server.ts)"); }
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
