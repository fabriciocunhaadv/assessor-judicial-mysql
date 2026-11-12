# Continuidade — Studio "Assessor Judicial"
O documento completo (regras do usuário, pontes, pendências) está em `CONTINUIDADE.md` do repositório da extensão `fabriciocunhaadv/projudi` (branch `claude/determined-bardeen-xtc9lq`). Leia-o primeiro.

Resumo do lado Studio: React+Vite+TS, Express, MySQL (Hostinger), Gemini; deploy a partir da `main`. Pontes com a extensão em `src/App.tsx` (eventos `projudi:*`, `assessor:cadastrar-minuta`). Minutas externas (Agaia/ChatGPT/Gemini/Claude/Jusbrasil) entram no Histórico com selo `🤖 <origem>` (`src/utils/minutaExterna.ts`, `HistoryModal.tsx`). Saúde: `server/saudeSistema.ts`. Fontes pendentes: `server/fontesPendentes.ts`.

## Assistente do dia v2 (conversa)
- `AssistenteBoasVindas.tsx` refeito como conversa curta no canto inferior direito: saudação + poucas escolhas grandes (assessor: fila, processo avulso, histórico, audiências, outras funções), submenus, Voltar/Início. Resposta da extensão (instalar / versão antiga / onde clicar) aparece dentro da conversa, sem toast. Pílula "O que fazer hoje?" reabre do começo.
- Abrir painel/pauta com 1 clique exige extensão 2.0.6 (web_accessible_resources + id); na 2.0.5 o assistente orienta: ícone da extensão → "Abrir painel completo".
- Fase 3 (copiloto do assistente): campo "Ou escreva o que você precisa…" sempre visível abaixo das opções. Palavras-chave locais respondem na hora; senão `POST /api/assistente-sugerir` (IA só ESCOLHE entre as opções permitidas ao perfil; servidor e tela filtram, assessor nunca recebe Lupa). Não executa nada: abre a resposta e o botão.
- Assistente v2.1: conversa em ordem cronológica (digitado e clicado não se misturam); "o que você faz?" é respondido como pergunta; dúvida feita dentro de uma opção é respondida pela IA com o contexto da opção (sem trocar de tela); botões só aparecem enquanto a pessoa está naquela opção; botão "Limpar conversa" (barra e rodapé).

## Modelos do Projudi no Studio + "Conferir modelos do Projudi" (12/11)
- Extensão 2.0.7 captura também citação, intimação, ofício, certidão, mandado… (antes só decisão/despacho/sentença) e envia ao Studio (ponte `window.postMessage {__projudi:"modelos"}` → `App.tsx` → `src/utils/modelosProjudi.ts`, coleção `gabinetes/<tenant>/modelosProjudi`, só regrava o que mudou pelo hash). A base de conhecimento (PDF por serventia) continua SÓ com decisão/despacho/sentença.
- Na minuta pronta: botão "Conferir modelos do Projudi" (`ConferirModelosModal.tsx`): acha os modelos parecidos (nome × texto da minuta, sem IA), `POST /api/conferir-modelos` compara e devolve divergências com sugestão (acrescentar/trocar); o usuário aplica uma a uma e salva como nova versão. Troca só vale se o trecho existe uma vez na seção.
- Testes: `testes/teste_modelos_projudi.ts`, `testes/servidor/rodar_conferir_modelos.mjs`.
- Caderno de Teses & Modelos → nova aba "📑 Modelos do Projudi" (`ModelosProjudiPanel.tsx`): lista por tipo, filtro, ver texto, copiar, apagar (com confirmação). Sem teste de tela (só tsc/build).
