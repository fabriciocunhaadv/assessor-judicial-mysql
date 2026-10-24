import React, { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { chamarAuth } from "../lib/sessao";

/** Faixa que diz de onde vêm e para onde vão os dados da tela (banco MySQL da Hostinger). O super admin vê também o nome do banco e quantas linhas há na tabela. */
export const BancoOrigem: React.FC<{ tabela: string; descricao: string }> = ({ tabela, descricao }) => {
  const [info, setInfo] = useState<{ banco?: string; servidor?: string; tabelas?: { nome: string; linhas: number }[] } | null>(null);
  useEffect(() => { let vivo = true; chamarAuth("GET", "/banco").then((r) => { if (vivo) setInfo(r); }).catch(() => { /* sem detalhes: fica a frase geral */ }); return () => { vivo = false; }; }, []);
  const linhas = info?.tabelas?.find((t) => t.nome === tabela)?.linhas;
  return (
    <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-[#f5f1ff] border border-[#c9b8ff] text-[11px] text-[#2f1c6a] leading-snug flex items-start gap-2" data-testid="banco-origem">
      <Database className="w-4 h-4 text-[#673de6] shrink-0 mt-0.5" />
      <p>
        <strong>Origem dos dados: MySQL na Hostinger.</strong> {descricao}
        {info?.banco && <> Banco <code className="bg-white px-1 rounded">{info.banco}</code> ({info.servidor}), tabela <code className="bg-white px-1 rounded">{tabela}</code>{typeof linhas === "number" ? ` com ${linhas} registro(s)` : ""}.</>}
        {!info?.banco && <> Tabela <code className="bg-white px-1 rounded">{tabela}</code>.</>}
      </p>
    </div>
  );
};
