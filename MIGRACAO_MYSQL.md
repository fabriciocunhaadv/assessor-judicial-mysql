# Migração Firestore → MySQL (Hostinger)

Este repositório é uma cópia do `assessor-judicial` (Firebase/Firestore). Domínio: judicial-mysql.assessor.net.br.
O repositório original continua em produção e NÃO deve ser alterado a partir daqui.

## Princípio do usuário
Tudo leve, sem peso no banco: listas só com resumos (40 por vez, "Ver mais"), minuta completa só ao clicar,
retenção 7/3/1 dia (Histórico, Lupa, Mesa).

## Estado inicial
O app fala direto com o Firestore pelo navegador (`src/lib/firestoreUtils.ts`, `src/utils/historyDb.ts`,
`retencaoDb.ts`, `hearingsDb.ts`, medidor). Regras em `firestore.rules`. Login: Firebase Auth.
Papéis: isAdmin, isJudge, isSuperAdmin (super admin = fabriciocunha.adv@gmail.com).

## Plano em etapas (o app nunca fica parado)
1. Publicar a cópia como está na Hostinger (Node.js, deploy do GitHub) no domínio novo; autorizar o domínio no Firebase Auth.
2. API no `server.ts` (Express) + MySQL (usar `localhost` na Hostinger; credenciais só em variáveis de ambiente, nunca no código).
3. Esquema: tabelas history (completo, JSON) e history_index (resumo leve, colunas indexadas: gabinete, criador, data, numeroLimpo),
   audits, hearings, users, tenants, settings (retenção), medição.
4. Autorização no servidor (replicar `firestore.rules`: dono apaga o seu, super admin apaga todos, adm/juiz veem o gabinete).
5. Trocar a camada de dados por trás das MESMAS funções (getHistory, assinarHistorico, buscarAtosDosProcessos, etc.), começando pelo Histórico.
   Tempo real → consulta periódica leve ou SSE.
6. Retenção 7/3/1 e varreduras no servidor (tarefa agendada) em vez do navegador.
7. Script de migração dos dados do Firestore (só se o usuário pedir) e decisão sobre login (Firebase Auth ou próprio).
8. Extensão: nova versão com host_permissions do domínio novo (loja).

## Regras de trabalho
- Nada de segredos no repositório. Testes: `testes/gigantes/` (Playwright com stubs).
- Explicar tudo ao usuário em português simples.
