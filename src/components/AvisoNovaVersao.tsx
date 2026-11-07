import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { haVersaoNova, acompanharPedidos, acompanharAtividade, minutosParado } from "../utils/novaVersao";
import { trabalhoEmAndamento } from "../utils/trabalhoEmAndamento";

const MIN_PARADO_PARA_ATUALIZAR = 30;      // minutos sem mexer na tela

// Faixa "nova versão disponível": o usuário atualiza quando quiser; se a tela ficar parada por 30 minutos e nada estiver sendo processado, atualiza sozinha.
export function AvisoNovaVersao() {
  const [nova, setNova] = useState(false);
  const [dispensadaAte, setDispensadaAte] = useState(0);
  const [esperando, setEsperando] = useState(false);      // o usuário pediu para atualizar assim que o trabalho terminar
  const [aviso, setAviso] = useState<string[] | null>(null);      // pergunta "há trabalho em andamento"

  useEffect(() => {
    acompanharPedidos();
    const parar = acompanharAtividadeSegura();
    let ultimaChecagem = 0, vivo = true;
    const checar = async () => { if (!vivo || Date.now() - ultimaChecagem < 4 * 60_000) return; ultimaChecagem = Date.now(); const n = await haVersaoNova(); if (vivo && n) setNova(true); };
    const t1 = setTimeout(checar, 2 * 60_000);
    const t2 = setInterval(checar, 10 * 60_000);
    const aoVoltar = () => { if (!document.hidden) void checar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; clearTimeout(t1); clearInterval(t2); document.removeEventListener("visibilitychange", aoVoltar); parar(); };
  }, []);

  // atualização automática: com a tela parada 30 min e nada em andamento; ou, se o usuário pediu para esperar, assim que tudo terminar
  useEffect(() => {
    if (!nova) return;
    const t = setInterval(() => {
      if (trabalhoEmAndamento().length) return;
      if (esperando || minutosParado() >= MIN_PARADO_PARA_ATUALIZAR) window.location.reload();
    }, esperando ? 5_000 : 60_000);
    return () => clearInterval(t);
  }, [nova, esperando]);

  const atualizarAgora = () => { const w = trabalhoEmAndamento(); if (w.length) setAviso(w); else window.location.reload(); };

  if (!nova || (Date.now() < dispensadaAte && !aviso)) return null;
  if (esperando) return (
    <div role="status" data-testid="aviso-nova-versao-esperando" className="fixed top-0 inset-x-0 z-[100] px-3 py-2 bg-amber-100 border-b-2 border-amber-400 text-amber-950 text-xs sm:text-sm font-sans shadow-md flex flex-wrap items-center justify-center gap-2">
      <RefreshCw className="w-4 h-4 text-amber-700 shrink-0 animate-spin" />
      <span>Aguardando o trabalho terminar para atualizar sozinho…</span>
      <button type="button" data-testid="aviso-nova-versao-cancelar-espera" onClick={() => { setEsperando(false); setAviso(null); }} className="px-3 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 font-bold cursor-pointer">Cancelar</button>
    </div>
  );
  if (aviso) return (
    <div role="alertdialog" data-testid="aviso-nova-versao-trabalhando" className="fixed top-0 inset-x-0 z-[100] px-3 py-2 bg-amber-100 border-b-2 border-amber-400 text-amber-950 text-xs sm:text-sm font-sans shadow-md flex flex-wrap items-center justify-center gap-2">
      <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
      <span><strong>Há trabalho em andamento ({aviso.join(", ")}).</strong> Atualizar agora pode interromper. Deseja esperar terminar?</span>
      <button type="button" data-testid="aviso-nova-versao-esperar" onClick={() => { setEsperando(true); setAviso(null); }} className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer">Esperar e atualizar sozinho</button>
      <button type="button" data-testid="aviso-nova-versao-forcar" onClick={() => window.location.reload()} className="px-3 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 font-bold cursor-pointer">Atualizar mesmo assim</button>
      <button type="button" data-testid="aviso-nova-versao-voltar" onClick={() => setAviso(null)} className="px-3 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 font-bold cursor-pointer">Voltar</button>
    </div>
  );
  return (
    <div role="status" data-testid="aviso-nova-versao" className="fixed top-0 inset-x-0 z-[100] px-3 py-2 bg-amber-100 border-b-2 border-amber-400 text-amber-950 text-xs sm:text-sm font-sans shadow-md flex flex-wrap items-center justify-center gap-2">
      <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
      <span><strong>Há uma nova versão do sistema.</strong> Atualize para usar as melhorias e correções (seu trabalho em andamento é guardado).</span>
      <button type="button" data-testid="aviso-nova-versao-atualizar" onClick={atualizarAgora} className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer">Atualizar agora</button>
      <button type="button" data-testid="aviso-nova-versao-depois" onClick={() => setDispensadaAte(Date.now() + 30 * 60_000)} className="px-3 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 font-bold cursor-pointer">Depois</button>
    </div>
  );
}
const acompanharAtividadeSegura = () => { try { return acompanharAtividade(); } catch { return () => {}; } };
