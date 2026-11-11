import "fake-indexeddb/auto";
import { guardarUploadPendente, lerUploadPendente, apagarUploadPendente } from "../src/utils/uploadsPendentes";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
(async () => {
  const f = new File([new Uint8Array(500).fill(1)], "autos.pdf", { type: "application/pdf" });
  await guardarUploadPendente("mutirao", "u1", [f], { hearingId: "h9" });
  const r = await lerUploadPendente("mutirao", "u1"), a = r?.arquivos;
  ok(r?.contexto?.hearingId === "h9", "guarda também a qual audiência o arquivo pertencia");
  ok(a?.length === 1 && a[0].name === "autos.pdf" && a[0].size === 500, "arquivo que estava sendo lido volta depois da recarga");
  ok((await lerUploadPendente("mesa", "u1")) === null && (await lerUploadPendente("mutirao", "u2")) === null, "cada módulo e cada usuário têm o seu");
  await lerUploadPendente("mutirao", "u1");
  ok((await lerUploadPendente("mutirao", "u1")) === null, "no máximo 2 tentativas (arquivo que derruba a página não entra em repetição)");
  await guardarUploadPendente("mesa", "u1", [f]); await apagarUploadPendente("mesa", "u1");
  ok((await lerUploadPendente("mesa", "u1")) === null, "terminou com sucesso: nada fica pendente");
  process.exit(falhas ? 1 : 0);
})();
