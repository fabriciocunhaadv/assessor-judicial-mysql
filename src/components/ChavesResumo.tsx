import React from "react";

/** Resumo das chaves de IA de um usuário (nunca mostra a chave): Gemini (quantas, pagas/gratuitas) e Claude (sim/não e modelo). Só o super admin recebe esses campos do servidor. */
export const resumoChaves = (u: any) => {
  const lista: any[] = Array.isArray(u?.customApiKeys) && u.customApiKeys.length ? u.customApiKeys : (typeof u?.customApiKey === "string" && u.customApiKey.trim().length > 10 ? [{ keyType: undefined }] : []);
  const pagas = lista.filter((k) => k.keyType === "paid").length, gratis = lista.filter((k) => k.keyType === "free").length;
  const claude = typeof u?.claudeApiKey === "string" && u.claudeApiKey.trim().length > 10;
  return { gemini: lista.length, pagas, gratis, semTipo: lista.length - pagas - gratis, claude, modelo: String(u?.modeloClaude || "") };
};

export const ChavesResumo: React.FC<{ user: any }> = ({ user }) => {
  const r = resumoChaves(user);
  const chip = "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap";
  const tipos = [r.pagas && `${r.pagas} paga${r.pagas > 1 ? "s" : ""}`, r.gratis && `${r.gratis} gratuita${r.gratis > 1 ? "s" : ""}`, r.semTipo && `${r.semTipo} sem tipo`].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-1 items-start" data-testid="chaves-resumo">
      <span className={`${chip} ${r.gemini ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}`} title="Chaves do Google Gemini cadastradas por este usuário">
        Gemini: {r.gemini ? `${r.gemini} chave${r.gemini > 1 ? "s" : ""} (${tipos})` : "nenhuma"}
      </span>
      <span className={`${chip} ${r.claude ? "bg-orange-500/15 text-orange-300 border-orange-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}`} title="Chave do Claude (Anthropic) cadastrada por este usuário">
        Claude: {r.claude ? `1 chave${r.modelo ? ` (${r.modelo})` : ""}` : "nenhuma"}
      </span>
    </div>
  );
};
