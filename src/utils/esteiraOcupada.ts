// Quando a ESTEIRA da extensão manda um processo ao Studio e a pessoa está usando a tela, a análise vai para o SEGUNDO PLANO (não apaga nem mistura a tela dela).
// "Usando a tela" = (1) o chat da minuta / a janela de paradigma está em uso (sinal data-assessor-ocupado) ou (2) há na tela um resultado que NÃO é da esteira
// (minuta carregada do Histórico ou análise manual): o resultado da própria esteira pode ser trocado pelo processo seguinte, como sempre foi.
export function esteiraDeveIrParaSegundoPlano(o: { esteira: boolean; sinalOcupado: boolean; temResultadoNaTela: boolean; telaEhDaEsteira: boolean }): boolean {
  if (!o.esteira) return false;
  return o.sinalOcupado || (o.temResultadoNaTela && !o.telaEhDaEsteira);
}
