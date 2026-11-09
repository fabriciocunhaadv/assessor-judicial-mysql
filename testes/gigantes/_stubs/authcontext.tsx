// AuthContext falso para testar componentes isolados (o real exige login no servidor).
import React from "react";
const perfil = { uid: "teste-uid", name: "Fabricio", email: "f@x.com", role: "admin", tenantId: "gabinete_default" };
export const useAuth = () => ({ user: { uid: "teste-uid", email: "f@x.com", displayName: "Fabricio" }, userProfile: perfil, allowedUnits: [], isAdmin: true, isJudge: false, isSuperAdmin: false, activeUnit: null, activeTenantId: "gabinete_default", tenantName: "Gabinete", loading: false });
export const AuthProvider = ({ children }: any) => <>{children}</>;
export default { useAuth, AuthProvider };
