import { resumoLeve } from "../src/utils/historicoLeve";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
const ato = { id: "video-1", processNumber: "5428441-88.2026.8.09.0166", date: 1, result: { minute: { title: "SENTENÇA", processNumber: "5428441-88.2026.8.09.0166", judicialUnit: "Vara das Fazendas Públicas", parties: { author: "EZIO BORGES SANTOS", defendant: "INSS" }, relatorio: "x".repeat(2000), fundamentacao: "y", dispositivo: "z" }, origemVideo: { videos: ["v1.mp4", "v2.mp4"], em: 123, degravacaoChars: 99999 } } };
const r = resumoLeve(ato, "mysql");
ok(r.result.origemVideo?.videos?.length === 2 && r.result.origemVideo.em === 123, "o resumo da lista do Histórico guarda a marca da sentença com vídeo (a etiqueta aparece na lista)");
ok(!("degravacaoChars" in r.result.origemVideo) && JSON.stringify(r).length < 4000, "resumo continua leve");
process.exit(falhas ? 1 : 0);
