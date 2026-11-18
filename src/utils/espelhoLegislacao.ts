// Fonte PRINCIPAL da legislação federal: o Novo Portal da Legislação da Presidência (mesmos caminhos "ccivil_03/…" do Planalto). O Planalto continua como reserva.
// Sem Firebase/navegador de propósito: só endereços e um "disjuntor" (se o portal novo falhar várias vezes seguidas, fica 10 min de lado e o Planalto responde direto).
export const PLANALTO_BASE_PADRAO = "https://www.planalto.gov.br/";
export const PORTAL_NOVO_PADRAO = "https://portaldalegislacao.presidencia.gov.br/";

const env = (k: string): string => { try { return (typeof process !== "undefined" && process.env?.[k]) || ""; } catch { return ""; } };
/** Base do portal novo. "off"/vazio desliga. Quando PLANALTO_BASE é trocado (testes com servidor falso), o portal novo só vale se PORTAL_LEGISLACAO_BASE também for informado. */
export const basePortalNovo = (): string => {
  const e = env("PORTAL_LEGISLACAO_BASE").trim();
  if (e) return /^(off|0|nao|não)$/i.test(e) ? "" : (e.endsWith("/") ? e : e + "/");
  return env("PLANALTO_BASE") ? "" : PORTAL_NOVO_PADRAO;
};

let falhasSeguidas = 0, desligadoAte = 0;
export const portalNovoDisponivel = (): boolean => !!basePortalNovo() && Date.now() >= desligadoAte;
/** Registra o resultado de uma tentativa no portal novo. 404 (a lei não está lá) não conta como falha do portal; erro de rede, tempo esgotado e 5xx contam. */
export const registrarPortalNovo = (resultado: "ok" | "naoachou" | "falha") => {
  if (resultado === "falha") { if (++falhasSeguidas >= 3) { desligadoAte = Date.now() + 10 * 60_000; falhasSeguidas = 0; } }
  else falhasSeguidas = 0;
};
export const reiniciarPortalNovo = () => { falhasSeguidas = 0; desligadoAte = 0; };

/** Endereços para tentar, em ordem: o do portal novo (se for página do Planalto e o portal estiver disponível) e depois o original. */
export const enderecosDaLei = (url: string): string[] => {
  const planalto = env("PLANALTO_BASE") || PLANALTO_BASE_PADRAO;
  if (!url.startsWith(PLANALTO_BASE_PADRAO) || !portalNovoDisponivel()) return [url.replace(PLANALTO_BASE_PADRAO, planalto)];
  const resto = url.slice(PLANALTO_BASE_PADRAO.length);
  return [basePortalNovo() + resto, planalto + resto];
};
export const ehPortalNovo = (u: string): boolean => { const b = basePortalNovo(); return !!b && u.startsWith(b); };
