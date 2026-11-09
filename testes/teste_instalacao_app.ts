// Rodar: npx tsx testes/teste_instalacao_app.ts
import { detectarAparelho, instrucoesDeInstalacao, enderecoDoApp } from "../src/utils/instalacaoApp";
let falhas = 0; const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IOS_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1";
const AND_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const AND_SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
ok(detectarAparelho(IOS_SAFARI) === "ios" && detectarAparelho(AND_CHROME) === "android" && detectarAparelho(PC) === "computador", "detecta o aparelho");
ok(detectarAparelho(PC, "MacIntel", 5) === "ios", "iPad moderno (se apresenta como Mac)");
ok(detectarAparelho(PC, "MacIntel", 0) === "computador", "Mac de verdade é computador");
let i = instrucoesDeInstalacao(IOS_SAFARI, false); ok(i.aparelho === "ios" && !i.avisoNavegador && i.passos.length === 4 && /Tela de Início/.test(i.passos[1]), "iPhone no Safari: 4 passos sem aviso");
i = instrucoesDeInstalacao(IOS_CHROME, false); ok(/Safari/.test(i.avisoNavegador), "iPhone fora do Safari: avisa para usar o Safari");
i = instrucoesDeInstalacao(AND_CHROME, false); ok(i.aparelho === "android" && !i.avisoNavegador && /Instalar app/.test(i.passos[1]), "Android no Chrome");
i = instrucoesDeInstalacao(AND_SAMSUNG, false); ok(/Chrome/.test(i.avisoNavegador), "Android em outro navegador: sugere o Chrome");
i = instrucoesDeInstalacao(PC, false); ok(i.aparelho === "computador" && /QR/.test(i.passos[0]), "computador: manda usar o QR code");
i = instrucoesDeInstalacao(IOS_SAFARI, true); ok(i.instalado && i.passos.length === 1 && /Ligar avisos/.test(i.passos[0]), "já instalado: só falta ligar os avisos");
ok(enderecoDoApp("https://judicial-mysql.assessor.net.br/") === "https://judicial-mysql.assessor.net.br/?fila=1", "endereço do QR");
if (falhas) process.exit(1); console.log("TUDO OK");
