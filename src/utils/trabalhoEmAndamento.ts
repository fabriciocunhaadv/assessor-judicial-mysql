// "O sistema está trabalhando?" Junta todas as fontes de trabalho em andamento, para a atualização de versão não interromper nada.
import { pedidosEmAndamento } from "./novaVersao";
import { gerenteGigantes } from "./gigantes/gerente";
import { gerenteMapas } from "./mapaEmSegundoPlano";
import { entradasExternas } from "./entradaExterna";
import { lerPendente, lerPendenteModulo } from "./analisePendente";
import { historicoTemPendencia } from "./historyDb";

const GIGANTE_ATIVO = ["ocr", "lendo", "fundindo", "redigindo", "preparando", "na_fila"];
const MAPA_ATIVO = ["planejando", "lendo", "consolidando"];
const ve = (f: () => boolean): boolean => { try { return !!f(); } catch { return false; } };

/** Lista (em português) do que está em andamento agora; vazia = pode atualizar. */
export function trabalhoEmAndamento(): string[] {
  const l: string[] = [];
  let n = 0; try { n = pedidosEmAndamento(); } catch { /* sem contador */ }
  if (n > 0) l.push("análise ou leitura em andamento");
  if (ve(() => gerenteGigantes.lista().some((j: any) => GIGANTE_ATIVO.includes(j.status)))) l.push("processo gigante");
  if (ve(() => gerenteMapas.lista().some((t: any) => MAPA_ATIVO.includes(t.status)))) l.push("mapa do processo");
  if (ve(() => !!lerPendente()) || ve(() => !!lerPendenteModulo("turbo")) || ve(() => !!lerPendenteModulo("lupa"))) l.push("análise aguardando resultado");
  if (ve(() => document.documentElement.dataset.assessorAuto === "1")) l.push("esteira automática");
  if (ve(() => entradasExternas.lista().some((e: any) => e.status !== "gravada"))) l.push("entrada do Agaia");
  if (ve(() => historicoTemPendencia() > 0)) l.push("gravação no Histórico");
  return l;
}
