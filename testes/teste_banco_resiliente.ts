// Rodar: npx tsx testes/teste_banco_resiliente.ts
import assert from "node:assert";
import { consultarComTentativa, zerarEstadoDoBanco, ehErroEsperado } from "../server/bancoResiliente";
const erro = (code: string, syscall?: string, message = code) => Object.assign(new Error(message), { code, syscall });
const rodar = async (sql: string, falhas: any[]) => {
  zerarEstadoDoBanco(); let chamadas = 0; const reg = { erros: [] as any[], recuperou: [] as number[], esperas: 0 };
  const original = async () => { chamadas++; const f = falhas.shift(); if (f) throw f; return [[{ ok: 1 }], []]; };
  let resultado: any, falhou: any;
  try { resultado = await consultarComTentativa(original, [sql, []], () => ({ aoErro: (e) => reg.erros.push(e.code), aoRecuperar: (ms) => reg.recuperou.push(ms), esperar: async () => { reg.esperas++; } })); } catch (e) { falhou = e; }
  return { chamadas, resultado, falhou, ...reg };
};
// 1) falha ao conectar (ETIMEDOUT em "connect"): repete uma vez, funciona; nada de erro no painel; avisa que o banco voltou
let r = await rodar("INSERT INTO docs VALUES (1)", [erro("ETIMEDOUT", "connect", "connect ETIMEDOUT")]);
assert.equal(r.chamadas, 2); assert.ok(r.resultado && !r.falhou); assert.deepEqual(r.erros, []); assert.equal(r.esperas, 1); assert.equal(r.recuperou.length, 1, "avisa 'MySQL voltou'");
// 2) GRAVAÇÃO que cai no meio da conexão NÃO é repetida (poderia duplicar) e vira erro de verdade
r = await rodar("INSERT INTO history VALUES (1)", [erro("ECONNRESET", "read")]);
assert.equal(r.chamadas, 1, "gravação não repete"); assert.ok(r.falhou); assert.deepEqual(r.erros, ["ECONNRESET"]);
r = await rodar("UPDATE docs SET data='x'", [erro("PROTOCOL_CONNECTION_LOST")]); assert.equal(r.chamadas, 1); assert.ok(r.falhou);
// 3) LEITURA que cai no meio é repetida
r = await rodar("SELECT data FROM docs", [erro("ECONNRESET", "read")]); assert.equal(r.chamadas, 2); assert.ok(r.resultado && !r.falhou); assert.deepEqual(r.erros, []);
r = await rodar("  select * from users", [erro("PROTOCOL_CONNECTION_LOST")]); assert.equal(r.chamadas, 2, "SELECT em minúsculas também");
// 4) queda que não passa: uma repetição só, depois o erro vai para o painel UMA vez
r = await rodar("SELECT 1", [erro("ETIMEDOUT", "connect"), erro("ETIMEDOUT", "connect"), erro("ETIMEDOUT", "connect")]);
assert.equal(r.chamadas, 2, "no máximo uma repetição"); assert.ok(r.falhou); assert.deepEqual(r.erros, ["ETIMEDOUT"], "um único aviso"); assert.equal(r.recuperou.length, 0);
// 5) erro que o sistema trata de propósito: não repete e NÃO vai para o painel
r = await rodar("ALTER TABLE users ADD COLUMN extras LONGTEXT NULL", [erro("ER_DUP_FIELDNAME", undefined, "Duplicate column name 'extras'")]);
assert.equal(r.chamadas, 1); assert.ok(r.falhou, "o erro continua chegando a quem chamou (que o ignora)"); assert.deepEqual(r.erros, []);
assert.ok(ehErroEsperado({ code: "ER_DUP_ENTRY" }) && !ehErroEsperado({ code: "ETIMEDOUT" }));
// 6) erro de SQL qualquer (sintaxe, tabela inexistente): sem repetição, vai para o painel
r = await rodar("SELECT * FROM nada", [erro("ER_NO_SUCH_TABLE")]); assert.equal(r.chamadas, 1); assert.deepEqual(r.erros, ["ER_NO_SUCH_TABLE"]);
// 7) sem falha nenhuma: nada de aviso nem repetição
r = await rodar("SELECT 1", []); assert.equal(r.chamadas, 1); assert.equal(r.recuperou.length, 0); assert.equal(r.esperas, 0);
console.log("OK banco resiliente");
