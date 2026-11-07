import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { FontesOficiaisPanel } from "../../src/components/FontesOficiaisPanel";
const BLOQ = "o Planalto bloqueou o acesso do servidor (página de “Acesso Negado”); salve a página no seu navegador e envie o arquivo";
const LEIS = [
  { id: "cf", nome: "Constituição Federal de 1988", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", baixadoEm: Date.parse("2026-10-31T12:00:00-03:00"), total: 280, revogados: 0, vetados: 0, erro: BLOQ },
  { id: "cpc", nome: "Código de Processo Civil (Lei 13.105/2015)", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm", baixadoEm: Date.parse("2026-10-27T12:00:00-03:00"), total: 1074, revogados: 0, vetados: 3 },
  { id: "l1", nome: "Lei pendente bloqueada", url: "https://www.planalto.gov.br/x1.htm", erro: BLOQ },
  { id: "l2", nome: "Lei com outro erro", url: "https://www.planalto.gov.br/x2.htm", erro: "a página não tem artigos reconhecíveis" },
];
const f = window.fetch.bind(window);
window.fetch = (async (i: any, o?: any) => String(i).includes("/api/fontes/leis") && (!o || !o.method || o.method === "GET") ? new Response(JSON.stringify({ leis: LEIS }), { status: 200, headers: { "Content-Type": "application/json" } }) : f(i, o)) as any;
createRoot(document.getElementById("root")!).render(<FontesOficiaisPanel />);
