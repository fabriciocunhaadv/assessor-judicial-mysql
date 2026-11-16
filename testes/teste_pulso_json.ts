// A rota lenta mantém a conexão viva com espaços e entrega o JSON no fim; o navegador (response.text + JSON.parse(trim)) lê normalmente.
import http from "node:http";
import { iniciarPulsoJson } from "../server/pulsoJson";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const srv = http.createServer((req, resp) => { const res: any = resp; iniciarPulsoJson(res, 150); setTimeout(() => { if (req.url === "/erro") res.status(504).json({ error: "falha da IA" }); else res.status(200).json({ reply: "pronto", hasMinuteUpdate: true }); }, 700); }).listen(8978);
const t0 = Date.now(); const r = await fetch("http://127.0.0.1:8978/ok"); const txt = await r.text();
ok(r.status === 200 && Date.now() - t0 >= 650, "a resposta chega depois da espera, com status 200");
ok(txt.startsWith(" ") && txt.length > 20, `chegaram pulsos de espaço enquanto esperava (${txt.length - txt.trim().length} espaços)`);
ok(JSON.parse(txt.trim()).reply === "pronto", "o JSON final lê normalmente com trim()");
const e = JSON.parse((await (await fetch("http://127.0.0.1:8978/erro")).text()).trim());
ok(e.error === "falha da IA", "erro vai no corpo como { error }");
srv.close(); console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
