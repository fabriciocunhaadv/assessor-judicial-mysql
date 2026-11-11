// Mídia do Mutirão em partes: remonta na ordem, confere tamanho, avisa parte faltando, escolhe o tipo certo, varre o que ficou abandonado.
import fs from "fs";
import { guardarParte, montarArquivo, limparMidia, mimeDaMidia, varrerMidiasAntigas, RAIZ_MIDIA } from "../server/mutiraoMidia";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const a = Buffer.from("AAAA"), b = Buffer.from("BBBBBB"), c = Buffer.from("CC");
guardarParte("u1", "m1", 1, b); guardarParte("u1", "m1", 0, a); guardarParte("u1", "m1", 2, c);
const m = montarArquivo("u1", "m1", 3, 12);
ok(fs.readFileSync(m.caminho).toString() === "AAAABBBBBBCC" && m.bytes === 12, "partes fora de ordem são juntadas na ordem certa");
try { montarArquivo("u1", "m1", 3, 99); ok(false, "tamanho errado deve falhar"); } catch (e: any) { ok(/incompleta/.test(e.message), "tamanho diferente do informado é recusado"); }
try { montarArquivo("u1", "m1", 4); ok(false, "parte faltando deve falhar"); } catch (e: any) { ok(/faltou a parte 4 de 4/.test(e.message), "parte faltando é avisada"); }
try { guardarParte("u1", "m2", -1, a); ok(false, "parte inválida"); } catch { ok(true, "número de parte inválido é recusado"); }
guardarParte("u2", "../../x", 0, a); ok(fs.existsSync(RAIZ_MIDIA) && !fs.existsSync("/tmp/x"), "id com ../ não escapa da pasta");
ok(mimeDaMidia("audiencia.MP4") === "video/mp4" && mimeDaMidia("a.webm") === "video/webm" && mimeDaMidia("a.mp3") === "audio/mpeg" && mimeDaMidia("sem_extensao", "video/x-algo") === "video/x-algo", "tipos mp4, webm, mp3 e informado");
ok(varrerMidiasAntigas(Date.now() + 4 * 3600_000) >= 1 && !fs.existsSync(m.caminho), "envio abandonado há mais de 3 h é apagado");
limparMidia("u1", "m1");
process.exit(falhas ? 1 : 0);
