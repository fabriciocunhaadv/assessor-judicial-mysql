// Rodar: npx tsx testes/teste_chamado_regras.ts
import * as r from "../src/utils/chamadoRegras";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]), pdf = new TextEncoder().encode("%PDF-1.4 x"), exe = new TextEncoder().encode("MZ\x90\x00 programa"), webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
ok(r.tipoPelosBytes(png) === "image/png" && r.tipoPelosBytes(jpg) === "image/jpeg" && r.tipoPelosBytes(pdf) === "application/pdf" && r.tipoPelosBytes(webp) === "image/webp" && r.tipoPelosBytes(exe) === "", "tipo pelos bytes");
ok(r.validarAnexo({ tipoDeclarado: "image/png", tamanho: 1000, bytes: png }).ok, "print PNG aceito");
ok(r.validarAnexo({ tipoDeclarado: "image/jpg", tamanho: 1000, bytes: jpg }).ok, "jpg declarado como image/jpg aceito");
ok(r.validarAnexo({ tipoDeclarado: "application/pdf", tamanho: 1000, bytes: pdf }).ok, "PDF aceito");
ok(r.validarAnexo({ tipoDeclarado: "", tamanho: 1000, bytes: png }).ok, "sem tipo declarado: vale o conteúdo");
let v: any = r.validarAnexo({ tipoDeclarado: "image/png", tamanho: 1000, bytes: exe }); ok(!v.ok && /PNG, JPEG ou WebP|print/.test(v.erro), "programa disfarçado de imagem recusado");
v = r.validarAnexo({ tipoDeclarado: "application/pdf", tamanho: 1000, bytes: png }); ok(!v.ok && /não confere/.test(v.erro), "tipo declarado diferente do real recusado");
v = r.validarAnexo({ tipoDeclarado: "image/png", tamanho: r.TAMANHO_MAX + 1, bytes: png }); ok(!v.ok && /até 4 MB/.test(v.erro), "arquivo grande demais recusado");
ok(!r.validarAnexo({ tipoDeclarado: "audio/webm", tamanho: 1000, bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]) }).ok, "áudio não é aceito");
ok(r.nomeSeguro("../../etc/passwd\n.png") === ".._.._etc_passwd_.png" || !/[\\/\n]/.test(r.nomeSeguro("../../etc/passwd\n.png")), "nome sem barras nem quebras de linha");
const t = r.textoDeContexto({ versaoApp: "abc123", aparelho: "Android", fila: { total: 10, concluidos: 6, erros: 1, aguardando: 2, analisando: 1, pausados: 0, modo: "ia", ia: "Jusbrasil", ultimoErro: "x", versao: "1.0.96" }, computadorOnline: false });
ok(/6 de 10 concluídos/.test(t) && /IA externa Jusbrasil/.test(t) && /v1\.0\.96/.test(t) && /sem sinal/.test(t) && /Último erro/.test(t), "contexto completo");
ok(r.textoDeContexto({}) === "", "sem dados, sem bloco");
if (falhas) process.exit(1); console.log("TUDO OK");
