// "auth" falso já logado, para testar componentes isolados (o real depende do login no servidor).
export const auth: any = { currentUser: { uid: "teste-uid", email: "f@x.com", displayName: "Fabricio", getIdToken: async () => "token-falso" } };
export const db: any = null;
