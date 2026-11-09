# Continuidade — Studio "Assessor Judicial"
O documento completo (regras do usuário, pontes, pendências) está em `CONTINUIDADE.md` do repositório da extensão `fabriciocunhaadv/projudi` (branch `claude/determined-bardeen-xtc9lq`). Leia-o primeiro.

Resumo do lado Studio: React+Vite+TS, Express, MySQL (Hostinger), Gemini; deploy a partir da `main`. Pontes com a extensão em `src/App.tsx` (eventos `projudi:*`, `assessor:cadastrar-minuta`). Minutas externas (Agaia/ChatGPT/Gemini/Claude/Jusbrasil) entram no Histórico com selo `🤖 <origem>` (`src/utils/minutaExterna.ts`, `HistoryModal.tsx`). Saúde: `server/saudeSistema.ts`. Fontes pendentes: `server/fontesPendentes.ts`.
