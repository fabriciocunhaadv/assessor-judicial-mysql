// Legislação: o Novo Portal é a fonte principal e o Planalto a reserva. Servidores falsos nos dois endereços.
import http from "node:http";
import { spawnSync } from "node:child_process";
const corpo = (n) => `<html><body>${Array.from({ length: 120 }, (_, i) => `<p>Art. ${i + 1}º Texto do artigo ${i + 1} (${n}).</p>`).join("")}</body></html>`;
let portalModo = "ok", pedidos = { portal: 0, planalto: 0 };
const portal = http.createServer((q, r) => { pedidos.portal++; if (portalModo === "500") { r.statusCode = 500; return r.end("erro"); } if (portalModo === "404") { r.statusCode = 404; return r.end("nao"); } r.setHeader("content-type", "text/html; charset=utf-8"); r.end(corpo("PORTAL")); });
const plan = http.createServer((q, r) => { pedidos.planalto++; r.setHeader("content-type", "text/html; charset=utf-8"); r.end(corpo("PLANALTO")); });
await new Promise((ok) => portal.listen(0, ok)); await new Promise((ok) => plan.listen(0, ok));
process.env.PORTAL_LEGISLACAO_BASE = `http://127.0.0.1:${portal.address().port}/`; process.env.PLANALTO_BASE = `http://127.0.0.1:${plan.address().port}/`;
const { baixar } = await import("../../server/fontesOficiais.ts");
const { reiniciarPortalNovo, portalNovoDisponivel } = await import("../../src/utils/espelhoLegislacao.ts");
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? "ok: " : "FALHOU: ") + m); };
const URL = "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm";
let r = await baixar(URL); ok(r.buf.toString().includes("(PORTAL)") && pedidos.planalto === 0, "com o portal novo no ar, a lei vem dele e o Planalto nem é consultado");
portalModo = "404"; pedidos = { portal: 0, planalto: 0 }; r = await baixar(URL); ok(r.buf.toString().includes("(PLANALTO)") && pedidos.portal === 1 && portalNovoDisponivel(), "portal sem a lei (404): usa o Planalto e o portal não é posto de lado");
portalModo = "500"; reiniciarPortalNovo(); pedidos = { portal: 0, planalto: 0 };
for (let i = 0; i < 3; i++) { r = await baixar(URL); ok(r.buf.toString().includes("(PLANALTO)"), `portal com erro (${i + 1}ª vez): o Planalto responde`); }
ok(!portalNovoDisponivel(), "depois de 3 falhas seguidas o portal fica 10 min de lado");
pedidos = { portal: 0, planalto: 0 }; await baixar(URL); ok(pedidos.portal === 0 && pedidos.planalto === 1, "com o portal de lado, vai direto ao Planalto");
reiniciarPortalNovo(); portalModo = "ok";
const outro = await baixar("https://exemplo.gov.br/x.html").catch((e) => ({ erro: String(e) })); ok(!!outro.erro || outro.status !== undefined, "endereço que não é do Planalto não passa pelo portal");
portal.close(); plan.close(); console.log(falhas ? `FALHAS: ${falhas}` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
