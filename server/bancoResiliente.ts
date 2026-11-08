// Consulta ao MySQL que aguenta queda curta: tenta de novo UMA vez (depois de 1 s) quando a conexão falha, sem nunca repetir gravação que possa já ter acontecido.
//  - falha ao ABRIR a conexão (ETIMEDOUT/ECONNREFUSED/... em "connect"): a consulta nem chegou ao banco, então qualquer uma pode ser repetida;
//  - conexão perdida NO MEIO (ECONNRESET, PROTOCOL_CONNECTION_LOST...): só se repete leitura (SELECT/SHOW/...); gravação não, para não duplicar.
// Também separa o que é erro de verdade do que o sistema trata de propósito (coluna que já existe...) e avisa quando o banco volta.
export const CODIGOS_ESPERADOS = new Set(["ER_DUP_FIELDNAME", "ER_TABLE_EXISTS_ERROR", "ER_DUP_KEYNAME", "ER_DUP_ENTRY"]);
const AO_CONECTAR = new Set(["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"]);
const NO_MEIO = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE", "ER_CON_COUNT_ERROR"]);
const LEITURA = /^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i;
export const ehErroEsperado = (e: any): boolean => CODIGOS_ESPERADOS.has(String(e?.code || ""));
export const falhouAoConectar = (e: any): boolean => AO_CONECTAR.has(String(e?.code || "")) && (e?.syscall === "connect" || e?.syscall === "getaddrinfo" || /^connect |^getaddrinfo /i.test(String(e?.message || "")) || !e?.syscall);
export const caiuNoMeio = (e: any): boolean => NO_MEIO.has(String(e?.code || "")) || (AO_CONECTAR.has(String(e?.code || "")) && !falhouAoConectar(e));
export const podeRepetir = (e: any, sql: string): boolean => falhouAoConectar(e) || (caiuNoMeio(e) && LEITURA.test(sql));

export interface GanchosBanco { aoErro?: (e: any, sql: string) => void; aoRecuperar?: (instavelPorMs: number) => void; esperar?: (ms: number) => Promise<void> }
const estado = { primeiraFalha: 0, ultimaFalha: 0, avisado: true };
/** Executa `original(...args)` com a regra acima. `ganchos` é lido a cada chamada (o monitor pode ser ligado depois). */
export async function consultarComTentativa(original: (...a: any[]) => Promise<any>, args: any[], ganchos: () => GanchosBanco): Promise<any> {
  const sql = typeof args[0] === "string" ? args[0] : String(args[0]?.sql || ""), g = () => ganchos() || {};
  const ok = (r: any) => { if (!estado.avisado && estado.ultimaFalha) { estado.avisado = true; const ms = Math.max(0, Date.now() - estado.primeiraFalha); try { g().aoRecuperar?.(ms); } catch { /* monitor nunca derruba */ } } return r; };
  const marcarFalha = () => { const agora = Date.now(); if (estado.avisado || agora - estado.ultimaFalha > 5 * 60_000) { estado.primeiraFalha = agora; estado.avisado = false; } estado.ultimaFalha = agora; };
  try { return ok(await original(...args)); }
  catch (e: any) {
    if (podeRepetir(e, sql)) {
      marcarFalha();
      await (g().esperar || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(1000);
      try { return ok(await original(...args)); } catch (e2: any) { if (podeRepetir(e2, sql) || caiuNoMeio(e2)) marcarFalha(); if (!ehErroEsperado(e2)) { try { g().aoErro?.(e2, sql); } catch { /* ignora */ } } throw e2; }
    }
    if (falhouAoConectar(e) || caiuNoMeio(e)) marcarFalha();
    if (!ehErroEsperado(e)) { try { g().aoErro?.(e, sql); } catch { /* ignora */ } }
    throw e;
  }
}
export const zerarEstadoDoBanco = () => { estado.primeiraFalha = 0; estado.ultimaFalha = 0; estado.avisado = true; };
