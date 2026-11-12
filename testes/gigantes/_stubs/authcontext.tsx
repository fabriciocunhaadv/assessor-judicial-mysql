// AuthContext falso para testar componentes isolados (o real exige login no servidor).
import React from "react";
const perfil = { uid: "teste-uid", name: "Fabricio", email: "f@x.com", role: "admin", tenantId: "gabinete_default" };
export const useAuth = () => ({ user: { uid: "teste-uid", email: "f@x.com", displayName: "Fabricio" }, userProfile: perfil, allowedUnits: (globalThis as any).__unidades || [], isAdmin: true, isJudge: !!(globalThis as any).__juiz, isSuperAdmin: !!(globalThis as any).__su, activeUnit: (globalThis as any).__unidades?.[0] || null, activeTenantId: "gabinete_default", allTenants: (globalThis as any).__tenants || [], allUnitsForSuperAdmin: (globalThis as any).__unidadesTodas || [], tenantName: "Gabinete", loading: false });
export const AuthProvider = ({ children }: any) => <>{children}</>;
export default { useAuth, AuthProvider };
