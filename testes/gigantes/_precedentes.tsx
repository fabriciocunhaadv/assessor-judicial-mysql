import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { BindingPrecedentsModal } from "../../src/components/BindingPrecedentsModal";
const LEIS = [
  { id: "cf", nome: "Constituição Federal de 1988", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", baixadoEm: Date.parse("2026-10-31T12:00:00-03:00"), total: 280, revogados: 0, vetados: 0, erro: "o Planalto bloqueou o acesso do servidor (página de “Acesso Negado”)" },
  { id: "cpc", nome: "Código de Processo Civil (Lei 13.105/2015)", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm", baixadoEm: Date.parse("2026-10-27T12:00:00-03:00"), total: 1074, revogados: 0, vetados: 3 },
  { id: "cc", nome: "Código Civil (Lei 10.406/2002)", url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm", baixadoEm: Date.parse("2026-10-26T12:00:00-03:00"), total: 2082, revogados: 1, vetados: 0 },
  { id: "l1", nome: "Lei pendente de teste", url: "https://www.planalto.gov.br/x1.htm" },
];
const PEND = [{ id: "mun", chave: "m", tipo: "lei", esfera: "municipal", ente: "Montes Claros de Goiás", numero: "1234", ano: 2015, orgao: "", rotulo: "Lei Municipal 1234/2015 (Montes Claros de Goiás)", status: "pendente", ocorrencias: 3, motores: { normal: 2, turbo: 1 }, primeira: 1, ultima: Date.now(), tentativas: [] }, { id: "sum", chave: "s", tipo: "súmula", esfera: "federal", ente: "", numero: "999", ano: 0, orgao: "STJ", rotulo: "Súmula 999 do STJ", status: "pendente", ocorrencias: 1, motores: { lupa: 1 }, primeira: 1, ultima: Date.now(), tentativas: [] }];
const mk = (i: number) => ({ id: `custom-${i}`, tribunal: i % 3 ? "FONAJE" : "TJGO", type: "enunciado_fonaje", number: `Enunciado ${i} FONAJE (Fazenda Pública)`, title: "Nas comarcas onde não houver Juizado Especial da Fazenda Pública ou juizados adjuntos instalados", statement: "Nas comarcas onde não houver Juizado Especial da Fazenda Pública ou juizados adjuntos instalados, as ações serão propostas perante as Varas comuns que detêm competência para processar os feitos de interesse da Fazenda Pública ou perante aquelas designadas pelo Tribunal de Justiça, observando-se o procedimento previsto na Lei n. 12.153/09 (XXXII Encontro – Armação de Búzios/RJ). Texto adicional para forçar o recorte do enunciado em várias linhas e mostrar o botão de ver o texto completo na tela.", sourceUrl: "https://x", tags: ["fazenda", "pública", "perante", "procedimento", "competência", "instalados", "designadas", "observando"], area: "Fazenda Pública", origem: "anexo_pdf", sourceFile: "Enunciados da Fazenda Pública - Portal CNJ.pdf" });
const f = window.fetch.bind(window);
window.fetch = (async (i: any, o?: any) => {
  const u = String(i), j = (x: any) => new Response(JSON.stringify(x), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.includes("/api/custom-precedents")) return j({ success: true, count: 40, precedents: Array.from({ length: 40 }, (_, k) => mk(k + 1)), conferencias: { "custom-2": { por: "admin", em: Date.now(), nota: "" } } });
  if (u.includes("/api/fontes/leis") && (!o || !o.method || o.method === "GET")) return j({ leis: LEIS });
  if (u.includes("/api/fontes/pendentes")) return j({ itens: PEND, fontesBusca: [], hostsPermitidos: [] });
  return f(i, o);
}) as any;
document.documentElement.dataset.assessorExtensao = "1.0.90";
createRoot(document.getElementById("root")!).render(<BindingPrecedentsModal isOpen isSuperAdmin onClose={() => {}} />);
