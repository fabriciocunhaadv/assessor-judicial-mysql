// Preço da IA em reais. Fica separado do navegador para o servidor usar a mesma conta.
// Gemini Flash: entrada US$ 0,15/1M (~R$ 0,8625/1M), saída US$ 0,60/1M (~R$ 3,45/1M), dólar a R$ 5,75
export const PRICE_PER_MILLION_INPUT_37_BRL = 0.8625;
export const PRICE_PER_MILLION_OUTPUT_37_BRL = 3.45;

export const calculateCostBrl = (promptTokens: number = 0, outputTokens: number = 0, model: string = "gemini-3.8-flash"): number => {
  const isLite = model.toLowerCase().includes("lite");
  const inputRate = isLite ? 0.43125 : PRICE_PER_MILLION_INPUT_37_BRL;
  const outputRate = isLite ? 1.725 : PRICE_PER_MILLION_OUTPUT_37_BRL;
  const cost = (promptTokens * inputRate / 1_000_000) + (outputTokens * outputRate / 1_000_000);
  return Math.max(0.0001, Number(cost.toFixed(6)));
};
