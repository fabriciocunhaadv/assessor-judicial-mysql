import React, { useEffect, useState } from "react";

const mmss = (seg: number) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

/** Barra de tempo que vai DIMINUINDO enquanto o sistema espera o Google liberar um modelo completo: dá a ideia de que a espera está andando (e de quanto falta). `ate` = instante (ms) em que a espera termina. */
export function BarraEspera({ ate, total, rotulo = "Esperando o Google liberar um modelo completo" }: { ate: number; total: number; rotulo?: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 250); return () => clearInterval(t); }, []);
  const resta = Math.max(0, ate - agora), pct = total > 0 ? Math.min(100, (resta / total) * 100) : 0, seg = Math.ceil(resta / 1000);
  return (
    <div className="w-full space-y-1" data-testid="barra-espera" role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={seg} aria-label={rotulo}>
      <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800">
        <span>{resta > 0 ? rotulo : "Tentando de novo agora…"}</span>
        <span className="font-mono" data-testid="barra-espera-tempo">{resta > 0 ? mmss(seg) : ""}</span>
      </div>
      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div className={`h-full bg-amber-500 ${resta > 0 ? "" : "animate-pulse"}`} style={{ width: resta > 0 ? `${pct}%` : "100%", transition: "width 0.3s linear" }} data-testid="barra-espera-nivel" />
      </div>
    </div>
  );
}

/** Barra que diminui em ciclos (sem prazo exato conhecido): na fila, lendo trecho, pausa de cota. Mostra que o sistema segue verificando/andando e quanto falta para a próxima verificação. */
export function BarraCiclo({ cicloSeg, rotulo }: { cicloSeg: number; rotulo: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 250); return () => clearInterval(t); }, []);
  const total = cicloSeg * 1000, resta = total - (agora % total), pct = (resta / total) * 100, seg = Math.ceil(resta / 1000);
  return (
    <div className="w-full space-y-1" data-testid="barra-ciclo" role="progressbar" aria-valuemin={0} aria-valuemax={cicloSeg} aria-valuenow={seg} aria-label={rotulo}>
      <div className="flex items-center justify-between text-[10px] font-semibold text-sky-800">
        <span>{rotulo}</span><span className="font-mono">{mmss(seg)}</span>
      </div>
      <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${pct}%`, transition: "width 0.3s linear" }} /></div>
    </div>
  );
}
