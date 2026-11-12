# Continuidade — Studio "Assessor Judicial"
O documento completo (regras do usuário, pontes, pendências) está em `CONTINUIDADE.md` do repositório da extensão `fabriciocunhaadv/projudi` (branch `claude/determined-bardeen-xtc9lq`). Leia-o primeiro.

Resumo do lado Studio: React+Vite+TS, Express, MySQL (Hostinger), Gemini; deploy a partir da `main`. Pontes com a extensão em `src/App.tsx` (eventos `projudi:*`, `assessor:cadastrar-minuta`). Minutas externas (Agaia/ChatGPT/Gemini/Claude/Jusbrasil) entram no Histórico com selo `🤖 <origem>` (`src/utils/minutaExterna.ts`, `HistoryModal.tsx`). Saúde: `server/saudeSistema.ts`. Fontes pendentes: `server/fontesPendentes.ts`.

## Assistente do dia v2 (conversa)
- `AssistenteBoasVindas.tsx` refeito como conversa curta no canto inferior direito: saudação + poucas escolhas grandes (assessor: fila, processo avulso, histórico, audiências, outras funções), submenus, Voltar/Início. Resposta da extensão (instalar / versão antiga / onde clicar) aparece dentro da conversa, sem toast. Pílula "O que fazer hoje?" reabre do começo.
- Abrir painel/pauta com 1 clique exige extensão 2.0.6 (web_accessible_resources + id); na 2.0.5 o assistente orienta: ícone da extensão → "Abrir painel completo".
- Fase 3 (copiloto do assistente): campo "Ou escreva o que você precisa…" sempre visível abaixo das opções. Palavras-chave locais respondem na hora; senão `POST /api/assistente-sugerir` (IA só ESCOLHE entre as opções permitidas ao perfil; servidor e tela filtram, assessor nunca recebe Lupa). Não executa nada: abre a resposta e o botão.
