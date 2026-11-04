// Respostas das chamadas /api que NÃO são falha do sistema e por isso não entram no Monitor de Erros:
//  - a gravação do próprio monitor (o 404 de "atualizar" um registro que ainda não existe, antes de criá-lo);
//  - o aviso de autos grandes (a leitura segue em lotes, em segundo plano: fluxo normal, a tela já trata);
//  - recusa de formulário incompleto na tela de leis estaduais/municipais (400 "informe ...").
const CODIGOS_AUTOS_GRANDES = /AUTOS_GRANDES_SEGUNDO_PLANO|ENTRADA_GRANDE_GRATUITA|AUTOS_ESSENCIAIS_ACIMA_DO_LIMITE|Autos grandes para a chave gratuita|a leitura segue em segundo plano/i;
export function ehErroEsperado(caminho: string, status: number, texto: string): boolean {
  const t = String(texto || "");
  if (caminho === "/api/db/docs/escrever" && /error_events/.test(t)) return true;
  if (CODIGOS_AUTOS_GRANDES.test(t)) return true;
  if (caminho.startsWith("/api/fontes/outras") && status === 400 && /informe (a esfera|o estado|o munic[íi]pio)|arquivo vazio ou pequeno demais/i.test(t)) return true;
  return false;
}
