// IA do Chat e do Copiloto: Gemini (padrão) ou Claude (Anthropic), com a chave de API de cada usuário.
// A escolha e a chave ficam neste navegador e também no cadastro do usuário no MySQL (só ele, o administrador do gabinete e o super admin leem a chave).
import { auth } from "../lib/sessao";
import { doc, updateDoc } from "../lib/docstore";

export type ProvedorChat = "gemini" | "claude";
export const MODELOS_CLAUDE: { id: string; nome: string }[] = [
  { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5 — equilíbrio entre qualidade e custo (recomendado)" },
  { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5 — mais rápido e econômico" },
  { id: "claude-opus-5-5", nome: "Claude Opus 5.5 — máxima qualidade (mais caro)" },
];

const uid = () => auth.currentUser?.uid || "anon";
const ler = (k: string) => { try { return localStorage.getItem(`${k}_${uid()}`) || ""; } catch { return ""; } };
const gravar = (k: string, v: string) => { try { v ? localStorage.setItem(`${k}_${uid()}`, v) : localStorage.removeItem(`${k}_${uid()}`); } catch { /* sem armazenamento */ } };

export const getChaveClaude = () => ler("assessor_claude_key");
export const getModeloClaude = () => ler("assessor_claude_modelo") || MODELOS_CLAUDE[0].id;
/** Só vale "claude" se houver chave cadastrada. */
export const getProvedorChat = (): ProvedorChat => (ler("assessor_provedor_chat") === "claude" && getChaveClaude().length > 20 ? "claude" : "gemini");
export const usaClaude = () => getProvedorChat() === "claude";

/** Grava a escolha neste navegador e no cadastro do usuário (para acompanhar a pessoa em outros aparelhos). */
export async function salvarPreferenciaIA(p: { provedor: ProvedorChat; chave: string; modelo: string }): Promise<void> {
  gravar("assessor_claude_key", p.chave.trim()); gravar("assessor_claude_modelo", p.modelo); gravar("assessor_provedor_chat", p.provedor);
  const u = auth.currentUser; if (!u) return;
  await updateDoc(doc(null, "users", u.uid), { claudeApiKey: p.chave.trim(), modeloClaude: p.modelo, provedorChat: p.provedor });
}
/** Ao entrar: traz do cadastro a chave e a escolha feitas em outro aparelho. */
export function sincronizarIAComPerfil(perfil: any): void {
  if (!perfil) return;
  if (typeof perfil.claudeApiKey === "string" && perfil.claudeApiKey) gravar("assessor_claude_key", perfil.claudeApiKey);
  if (typeof perfil.modeloClaude === "string" && perfil.modeloClaude) gravar("assessor_claude_modelo", perfil.modeloClaude);
  if (typeof perfil.provedorChat === "string" && perfil.provedorChat) gravar("assessor_provedor_chat", perfil.provedorChat);
}
/** Cabeçalhos extras das chamadas do Chat e do Copiloto quando a Claude está escolhida. */
export function cabecalhosProvedor(): Record<string, string> {
  return usaClaude() ? { "x-ai-provider": "claude", "x-claude-api-key": getChaveClaude(), "x-claude-model": getModeloClaude() } : {};
}
