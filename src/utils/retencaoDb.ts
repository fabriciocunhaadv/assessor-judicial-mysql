// RETENÇÃO DO HISTÓRICO (parte que fala com o banco): lê e grava a configuração (settings/retencao_historico) e apaga os atos vencidos.
// A exclusão roda no navegador de quem abre o sistema: cada usuário apaga as próprias minutas vencidas e o super admin apaga todas (é o que as regras do banco permitem).
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where } from '../lib/docstore';
import toast from "react-hot-toast";
import { db, auth } from "../lib/firebase";
import { deleteHistoryFromDb, ehDonoDoAto, ehSuperAdminHistorico, garantirIndiceHistorico, indiceHistoricoPath } from "../lib/firestoreUtils";
import { listaDeGabinetes } from "./monitorErros";
import { medirLeitura } from "./medidorColeta";
import { ConfigRetencao, configRetencaoAtual, definirConfigRetencao, limiteDeCandidatos, normalizarConfigRetencao, referenciaAudiencia, resumirValidade, situacaoValidade } from "./retencaoRegras";

const refConfig = () => doc(db, "settings", "retencao_historico");

export async function carregarConfigRetencao(): Promise<ConfigRetencao> {
  try { const sn = await getDoc(refConfig()); const c = normalizarConfigRetencao(sn.exists() ? sn.data() : null); definirConfigRetencao(c); return c; }
  catch (e) { console.warn("[Retenção] não consegui ler a configuração:", e); return configRetencaoAtual(); }
}

/** Liga, desliga ou muda os dias (só o painel do super admin chama). Ao LIGAR pela primeira vez grava o dia de início: é dele que contam os 7 dias de carência das minutas antigas. */
export async function salvarConfigRetencao(nova: { ativa: boolean; dias: number }): Promise<ConfigRetencao> {
  const atual = configRetencaoAtual();
  const ligando = nova.ativa && !atual.ativa;
  const c = normalizarConfigRetencao({ ...atual, ativa: nova.ativa, dias: nova.dias, ativadaEm: ligando || !atual.ativadaEm ? Date.now() : atual.ativadaEm });
  await setDoc(refConfig(), { ...c, atualizadoPor: auth.currentUser?.email || "", atualizadoEm: Date.now() }, { merge: true });
  definirConfigRetencao(c);
  return c;
}

export interface ResultadoLimpeza { candidatos: number; apagados: number; falhas: number }
const chamarLimpeza = async (parte: "historico" | "lupa", simular?: boolean): Promise<any> => {
  const r = await fetch("/api/db/retencao/limpar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` }, body: JSON.stringify({ parte, simular: !!simular }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `erro ${r.status}`);
  return r.json();
};
/** A limpeza automática agora roda no SERVIDOR (a cada 6 horas). Aqui, o super admin pode rodar (ou só contar, com `simular`) na hora. */
export async function limparHistoricoVencido(opcoes: { simular?: boolean } = {}): Promise<ResultadoLimpeza> {
  const out: ResultadoLimpeza = { candidatos: 0, apagados: 0, falhas: 0 };
  if (!auth.currentUser || !ehSuperAdminHistorico()) return out;
  try { const r = await chamarLimpeza("historico", opcoes.simular); out.candidatos = r.historico.candidatos; out.apagados = r.historico.apagados; }
  catch (e) { out.falhas++; console.warn("[Retenção] limpeza falhou:", e); }
  return out;
}

/** Auditorias da Lupa e audiências da Mesa vencidas, de todos os gabinetes (rodada pelo servidor). */
export async function limparLupaEMesaVencidas(opcoes: { simular?: boolean } = {}): Promise<{ auditorias: number; audiencias: number }> {
  const out = { auditorias: 0, audiencias: 0 };
  if (!auth.currentUser || !ehSuperAdminHistorico()) return out;
  try { const r = await chamarLimpeza("lupa", opcoes.simular); out.auditorias = r.auditorias; out.audiencias = r.audiencias; }
  catch (e) { console.warn("[Retenção] limpeza da Lupa e da Mesa falhou:", e); }
  return out;
}

let _iniciada = false;
/** Chamar uma vez ao abrir o sistema com o usuário logado: lê a configuração, limpa o que venceu e repete a cada 6 horas. */
export function iniciarRetencao(): void {
  if (_iniciada || typeof window === "undefined") return;
  _iniciada = true;
  // só lê a regra (para os avisos de vencimento na tela); quem apaga é o servidor
  const rodar = async () => { await carregarConfigRetencao(); };
  setTimeout(() => { void rodar(); }, 15_000);
  setInterval(() => { void rodar(); }, 6 * 3_600_000);
}

/** Aviso (no máximo um por dia e por fase) das minutas do próprio usuário que estão perto de vencer. */
export function avisarVencimentos(lista: Array<{ date?: any; createdBy?: string }>, uid: string | undefined | null): void {
  try {
    const cfg = configRetencaoAtual(); if (!cfg.ativa || !uid) return;
    const minhas = lista.filter((a) => a.createdBy === uid);      // só as minutas do próprio usuário (o super admin não recebe aviso das dos outros)
    const r = resumirValidade(minhas, cfg);
    const hoje = new Date().toISOString().slice(0, 10);
    const jaAvisou = (fase: string) => { try { return localStorage.getItem(`retencao_aviso_${uid}_${hoje}_${fase}`) === "1"; } catch { return false; } };
    const marcar = (fase: string) => { try { localStorage.setItem(`retencao_aviso_${uid}_${hoje}_${fase}`, "1"); } catch { /* sem armazenamento */ } };
    if (r.ate1 > 0 && !jaAvisou("1")) { marcar("1"); toast.error(`${r.ate1} minuta(s) expiram em menos de 24 horas e serão apagadas do Histórico. Baixe (DOCX ou PDF) o que quiser guardar.`, { duration: 15000 }); }
    else if (r.ate3 > 0 && !jaAvisou("3")) { marcar("3"); toast(`${r.ate3} minuta(s) expiram em até 3 dias e serão apagadas do Histórico. Baixe o que quiser guardar.`, { duration: 12000, icon: "⏳" }); }
  } catch { /* o aviso nunca derruba o sistema */ }
}
