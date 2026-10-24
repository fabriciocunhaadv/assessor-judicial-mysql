// Sem Firebase: o login é próprio (./sessao) e os dados ficam no MySQL (./docstore e historyApi).
// `db` continua exportado só para os módulos que ainda passam um "db" às funções de ./docstore (que o ignoram).
export { auth } from './sessao';
export const db: any = null;
