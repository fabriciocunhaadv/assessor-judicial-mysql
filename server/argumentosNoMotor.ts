// Argumento × Resposta no motor (regras A, B, C e D de 15/11/2026): liga o texto único de src/utils/argumentosResposta.ts aos motores e confere a matriz da etapa 2.
// ARGUMENTOS_RESPOSTA=off no servidor desliga tudo (volta ao comportamento anterior sem mexer em código).
import { regraArgumentoResposta, INSTRUCAO_MATRIZ_ARGUMENTOS, REGRA_LUPA_ARGUMENTO_RESPOSTA, conferirArgumentoResposta, type ConferenciaArgumentos } from "../src/utils/argumentosResposta";

export const argumentosLigado = () => String(process.env.ARGUMENTOS_RESPOSTA || "on").toLowerCase() !== "off";
/** Regra para as instruções do motor que redige a minuta (cláusula conforme o ato). */
export const blocoArgumentos = (ato?: string): string => { try { return argumentosLigado() ? regraArgumentoResposta(ato) : ""; } catch { return ""; } };
/** Instrução para a etapa 2 devolver a matriz Argumento × Resposta. */
export const instrucaoMatrizArgumentos = (): string => argumentosLigado() ? INSTRUCAO_MATRIZ_ARGUMENTOS : "";
/** Regras 14 e 15 da Lupa (auditoria). */
export const regraLupaArgumentos = (): string => argumentosLigado() ? REGRA_LUPA_ARGUMENTO_RESPOSTA : "";
/** Confere a matriz da etapa 2 contra a minuta; nunca derruba a minuta. */
export const conferirArgumentos = (matriz: any, minuta: any): ConferenciaArgumentos | null => { try { return argumentosLigado() ? conferirArgumentoResposta(matriz, minuta) : null; } catch { return null; } };
