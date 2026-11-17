import { PRONTIDAO_AUDITORIA, PRONTIDAO_DO_ATO } from "../server/prontidaoDoAto";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
ok(/QUESTÃO PRÉVIA A SUPERAR/.test(PRONTIDAO_AUDITORIA), "a Lupa ganhou a exceção da questão prévia");
ok(/gratuidade/.test(PRONTIDAO_AUDITORIA) && /tutela de urgência/.test(PRONTIDAO_AUDITORIA) && /vista ao Ministério Público/.test(PRONTIDAO_AUDITORIA) && /NÃO reduza a nota/.test(PRONTIDAO_AUDITORIA), "cobre gratuidade, tutela, vista ao MP e a nota");
ok(/nunca bloqueante/.test(PRONTIDAO_AUDITORIA), "urgência concreta vira, no máximo, atenção");
ok(!/QUESTÃO PRÉVIA A SUPERAR/.test(PRONTIDAO_DO_ATO), "a geração das minutas NÃO foi alterada (só a Lupa)");
ok(/Gere ALERTA CRÍTICO/.test(PRONTIDAO_AUDITORIA) && /pendência não enfrentada/.test(PRONTIDAO_AUDITORIA), "a regra geral de prontidão continua");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
