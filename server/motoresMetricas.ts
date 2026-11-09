// MÉTRICAS POR MOTOR: para a calibragem do Super Admin, guarda por HORA e por motor quantos pedidos, quantos erros, quantos de cota/sobrecarga da IA,
// tempo (total e máximo) e tamanho do pedido (os autos). Só MEDE no fim de cada pedido (a resposta já foi enviada): não altera o pedido, o motor nem o tempo de resposta.
// Soma em memória e grava em lote a cada 5 minutos; se o banco falhar, descarta (nunca atrapalha). Limpa em 30 dias junto com a Saúde.
import express from "express";
import { consultaSaude, garantirSaude, aoLimparSaude } from "./saudeSistema";
import { motorDaRota, ehCota, ehErro, horaDe, type LinhaMetrica } from "../src/utils/calibragemRegras";

let acumulado = new Map<string, LinhaMetrica>(), esquema: Promise<void> | null = null, iniciado = false;
const garantir = () => (esquema ||= (async () => {
  await garantirSaude();
  await consultaSaude(`CREATE TABLE IF NOT EXISTS motor_metricas (
    hora BIGINT NOT NULL, motor VARCHAR(24) NOT NULL, n INT NOT NULL DEFAULT 0, erros INT NOT NULL DEFAULT 0, cota INT NOT NULL DEFAULT 0,
    ms_total BIGINT NOT NULL DEFAULT 0, ms_max INT NOT NULL DEFAULT 0, bytes_total BIGINT NOT NULL DEFAULT 0, bytes_max BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (hora, motor)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquema = null; throw e; }));

/** Soma um pedido terminado (síncrono, à prova de falhas). */
export function contarMotor(caminho: string, status: number, ms: number, bytes: number): void {
  try {
    const motor = motorDaRota(caminho); if (!motor) return;
    const hora = horaDe(Date.now()), k = `${hora}|${motor}`;
    const l = acumulado.get(k) || { hora, motor, n: 0, erros: 0, cota: 0, ms_total: 0, ms_max: 0, bytes_total: 0, bytes_max: 0 };
    l.n++; if (ehErro(status)) l.erros++; else if (ehCota(status)) l.cota++;
    const t = Math.max(0, Math.round(ms)), b = Math.max(0, Math.round(bytes) || 0);
    l.ms_total += t; l.ms_max = Math.max(l.ms_max, t); l.bytes_total += b; l.bytes_max = Math.max(l.bytes_max, b);
    acumulado.set(k, l);
  } catch { /* o monitor nunca derruba o sistema */ }
}

/** Middleware: mede cada pedido a um motor depois que ele termina. */
export const medirMotores: express.RequestHandler = (req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => { try { contarMotor(String(req.originalUrl || req.url || ""), res.statusCode, Date.now() - t0, Number(req.headers["content-length"]) || 0); } catch { /* ignora */ } });
  next();
};

export async function gravarMetricas(): Promise<void> {
  if (!acumulado.size) return;
  const lote = [...acumulado.values()]; acumulado = new Map();
  try {
    await garantir();
    for (const l of lote) await consultaSaude("INSERT INTO motor_metricas (hora, motor, n, erros, cota, ms_total, ms_max, bytes_total, bytes_max) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE n=n+VALUES(n), erros=erros+VALUES(erros), cota=cota+VALUES(cota), ms_total=ms_total+VALUES(ms_total), ms_max=GREATEST(ms_max,VALUES(ms_max)), bytes_total=bytes_total+VALUES(bytes_total), bytes_max=GREATEST(bytes_max,VALUES(bytes_max))", [l.hora, l.motor, l.n, l.erros, l.cota, l.ms_total, l.ms_max, l.bytes_total, l.bytes_max]);
  } catch { /* banco fora do ar: perde só estas contagens */ }
}
/** Lê as linhas do período (grava antes o que está em memória). */
export async function lerMetricas(desde: number): Promise<LinhaMetrica[]> {
  await gravarMetricas(); await garantir();
  const [rows]: any = await consultaSaude("SELECT hora, motor, n, erros, cota, ms_total, ms_max, bytes_total, bytes_max FROM motor_metricas WHERE hora >= ? ORDER BY hora", [desde]);
  return rows.map((r: any) => ({ hora: Number(r.hora), motor: r.motor, n: Number(r.n), erros: Number(r.erros), cota: Number(r.cota), ms_total: Number(r.ms_total), ms_max: Number(r.ms_max), bytes_total: Number(r.bytes_total), bytes_max: Number(r.bytes_max) }));
}

export function iniciarMetricasDosMotores(): void {
  if (iniciado) return; iniciado = true;
  aoLimparSaude(async (limite) => { await garantir(); const [r]: any = await consultaSaude("DELETE FROM motor_metricas WHERE hora < ?", [limite]); return r?.affectedRows || 0; });
  setInterval(() => { void gravarMetricas(); }, 5 * 60_000).unref?.();
  process.once("SIGTERM", () => { void gravarMetricas(); });
}
