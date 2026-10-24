// Segunda IA do sistema: Claude (Anthropic), por chave de API de cada usuário. Hoje atende o Chat da minuta e o Copiloto de Gabinete.
// Conversa direta com a API de mensagens da Anthropic (sem biblioteca extra). A chave vem no cabeçalho da requisição, como as do Gemini, e nunca é gravada no servidor.
import type express from "express";

export const MODELOS_CLAUDE: Record<string, string> = {
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (equilíbrio entre qualidade e custo)",
  "claude-haiku-5-5": "Claude Haiku 5.5 (mais rápido e econômico)",
  "claude-opus-5-5": "Claude Opus 5.5 (máxima qualidade)",
};
export const MODELO_CLAUDE_PADRAO = "claude-sonnet-5-5";

/** Se o pedido escolheu a Claude, devolve a chave e o modelo; senão null (segue o Gemini). */
export function pedidoClaude(req: express.Request): { chave: string; modelo: string } | null {
  if (String(req.headers["x-ai-provider"] || "").toLowerCase() !== "claude") return null;
  const chave = String(req.headers["x-claude-api-key"] || "").trim();
  const pedido = String(req.headers["x-claude-model"] || "").trim();
  return { chave, modelo: MODELOS_CLAUDE[pedido] ? pedido : MODELO_CLAUDE_PADRAO };
}

/** Mesmo formato de retorno que o Gemini usa nas rotas (text, usageMetadata, modelVersion), para o resto da rota não mudar. */
// `temperature` é aceito na chamada mas NÃO é enviado: os modelos Claude atuais recusam o parâmetro ("`temperature` is deprecated for this model").
export async function gerarComClaude(o: { chave: string; modelo: string; system?: string; prompt: string; maxTokens: number; temperature?: number; timeoutMs?: number }): Promise<{ text: string; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }; modelVersion: string }> {
  if (!o.chave || o.chave.length < 20) throw Object.assign(new Error("Chave da Claude ausente. Cadastre a sua em Chave API › Claude (Anthropic)."), { status: 401, claude: true });
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeoutMs || 120000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": o.chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: o.modelo, max_tokens: o.maxTokens, ...(o.system ? { system: o.system } : {}), messages: [{ role: "user", content: o.prompt }] }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const motivo = String(j?.error?.message || `erro ${r.status}`);
      const msg = r.status === 401 ? "A Claude recusou a chave de API (inválida ou revogada)." : r.status === 429 ? "A Claude limitou o uso desta chave (muitas chamadas ou saldo esgotado): " + motivo : r.status === 400 && /credit|billing|balance/i.test(motivo) ? "A conta da Claude está sem saldo (créditos de API): " + motivo : "Erro da Claude: " + motivo;
      throw Object.assign(new Error(msg), { status: r.status === 401 ? 401 : r.status === 429 ? 429 : 502, claude: true });
    }
    const text = Array.isArray(j.content) ? j.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("") : "";
    const entrada = Number(j.usage?.input_tokens) || 0, saida = Number(j.usage?.output_tokens) || 0;
    return { text, usageMetadata: { promptTokenCount: entrada, candidatesTokenCount: saida, totalTokenCount: entrada + saida }, modelVersion: String(j.model || o.modelo) };
  } catch (e: any) {
    if (e?.name === "AbortError") throw Object.assign(new Error("A Claude demorou demais para responder. Tente de novo."), { status: 504, claude: true });
    throw e;
  } finally { clearTimeout(t); }
}
