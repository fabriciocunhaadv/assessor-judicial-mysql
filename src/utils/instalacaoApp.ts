// Instalar o Studio no celular (app na tela inicial): detecta o aparelho e devolve o passo a passo certo. Regras PURAS (testáveis).
export type Aparelho = "ios" | "android" | "computador";
export interface Passo { texto: string }
export interface Instrucoes { aparelho: Aparelho; instalado: boolean; titulo: string; avisoNavegador: string; passos: string[] }

export function detectarAparelho(ua: string, plataforma = "", toquesMax = 0): Aparelho {
  const u = String(ua || "");
  if (/iPhone|iPad|iPod/i.test(u) || (plataforma === "MacIntel" && toquesMax > 1)) return "ios";      // iPad novo se apresenta como Mac
  if (/Android/i.test(u)) return "android";
  return "computador";
}
const ehSafari = (ua: string) => /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
const ehChrome = (ua: string) => /Chrome|CriOS/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua);

export function instrucoesDeInstalacao(ua: string, instalado: boolean, plataforma = "", toquesMax = 0): Instrucoes {
  const aparelho = detectarAparelho(ua, plataforma, toquesMax);
  if (instalado) return { aparelho, instalado: true, titulo: "App instalado neste aparelho", avisoNavegador: "", passos: ["Para receber os avisos, toque em “Ligar avisos neste aparelho” abaixo."] };
  if (aparelho === "ios") return {
    aparelho, instalado: false, titulo: "Instalar no iPhone / iPad",
    avisoNavegador: ehSafari(ua) ? "" : "Abra este endereço no Safari. Em outros navegadores o iPhone não oferece a instalação.",
    passos: ["Toque no botão de compartilhar (o quadrado com a seta para cima).", "Escolha “Adicionar à Tela de Início” e confirme.", "Feche o Safari e abra o app pelo ícone novo na tela inicial (obrigatório para os avisos funcionarem).", "Dentro do app, abra “Minha fila (celular)” e toque em “Ligar avisos neste aparelho”. O iPhone precisa estar com iOS 16.4 ou mais novo."],
  };
  if (aparelho === "android") return {
    aparelho, instalado: false, titulo: "Instalar no Android",
    avisoNavegador: ehChrome(ua) ? "" : "Use o Google Chrome para instalar: em outros navegadores o menu pode ser diferente.",
    passos: ["Toque nos três pontinhos (⋮) no canto superior do navegador.", "Escolha “Instalar app” ou “Adicionar à tela inicial” e confirme.", "Abra o app pelo ícone novo na tela inicial.", "Abra “Minha fila (celular)”, toque em “Ligar avisos neste aparelho” e em Permitir."],
  };
  return { aparelho, instalado: false, titulo: "Instalar no celular", avisoNavegador: "", passos: ["Aponte a câmera do celular para o QR code ao lado (ou digite o endereço no navegador do celular) e entre com a sua conta.", "No Android (Chrome): menu ⋮ → “Instalar app”. No iPhone (Safari): compartilhar → “Adicionar à Tela de Início”.", "Abra o app pelo ícone novo e, em “Minha fila (celular)”, toque em “Ligar avisos neste aparelho”."] };
}
export const enderecoDoApp = (origem: string) => `${String(origem || "").replace(/\/+$/, "")}/?fila=1`;
