import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, collection } from './docstore';
import { db } from './firebase';
import { auth, entrar, recarregarPerfil, chamarAuth, AppUser } from './sessao';
import { UserProfile, JudicialUnit, DEFAULT_UNITS } from '../types';
import { 
  subscribeToUnits, 
  saveUnitsToDb, 
  updateUserTours, 
  setGlobalTenantId, 
  fetchAllUnitsForSuperAdmin,
  fetchAllTenantsAndUnitsForSuperAdmin,
  SuperAdminTenantInfo,
  SuperAdminTenantUnit,
  isPrimaryCabinet
} from './firestoreUtils';
import { syncApiKeyWithUserProfile, setNativeKeyAccessState } from '../utils/apiKeyManager';
import { sincronizarIAComPerfil } from '../utils/provedorIA';
import { definirIdsAntigosHistorico } from './firestoreUtils';

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isJudge: boolean;
  isDeactivated: boolean;
  isUnauthorized: boolean;
  isTenantSuspended: boolean;
  tenantSuspensionReason: string | null;
  tenantName: string | null;
  authError: string | null;
  canUseNativeKey: boolean;
  loading: boolean;
  activeUnit: JudicialUnit;
  setActiveUnit: (unit: JudicialUnit) => void;
  allowedUnits: JudicialUnit[];
  activeTenantId: string;
  allTenants: SuperAdminTenantInfo[];
  allUnitsForSuperAdmin: SuperAdminTenantUnit[];
  setSuperAdminActiveTenant: (tenantId: string, unitId?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeTour: (tourId: string) => Promise<void>;
  resetTours: () => Promise<void>;
  clearAuthError: () => void;
  recheckInvite: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  isSuperAdmin: false,
  isJudge: false,
  isDeactivated: false,
  isUnauthorized: false,
  isTenantSuspended: false,
  tenantSuspensionReason: null,
  tenantName: null,
  authError: null,
  canUseNativeKey: false,
  loading: true,
  activeUnit: DEFAULT_UNITS[0],
  setActiveUnit: () => {},
  allowedUnits: [],
  activeTenantId: 'gabinete_default',
  allTenants: [],
  allUnitsForSuperAdmin: [],
  setSuperAdminActiveTenant: async () => {},
  signIn: async (_e: string, _s: string) => {},
  signOut: async () => {},
  completeTour: async () => {},
  resetTours: async () => {},
  clearAuthError: () => {},
  recheckInvite: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ACTIVE_UNIT_KEY = "agaia_active_unit_id";
const SUPERADMIN_TENANT_KEY = "agaia_superadmin_active_tenant";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Safety timeout: garante que a aplicação nunca fique travada na tela de carregamento se o Firebase demorar
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4500);
    return () => clearTimeout(safetyTimer);
  }, []);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dynamicUnits, setDynamicUnits] = useState<JudicialUnit[]>(DEFAULT_UNITS);
  const [isTenantSuspended, setIsTenantSuspended] = useState(false);
  const [tenantSuspensionReason, setTenantSuspensionReason] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  // Super Admin Multi-Tenant States
  const [superAdminTenantId, setSuperAdminTenantId] = useState<string | null>(() => {
    return localStorage.getItem(SUPERADMIN_TENANT_KEY);
  });
  const [allTenants, setAllTenants] = useState<SuperAdminTenantInfo[]>([]);
  const [allUnitsForSuperAdmin, setAllUnitsForSuperAdmin] = useState<SuperAdminTenantUnit[]>([]);

  const isSuperAdmin = Boolean((userProfile as any)?.superAdmin);
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isJudge = Boolean(userProfile?.isJudge);
  const isDeactivated = Boolean(userProfile && userProfile.isActive === false && !isSuperAdmin);
  const isUnauthorized = Boolean(
    user && 
    !isSuperAdmin && 
    (userProfile?.isUnauthorized || !userProfile?.tenantId || userProfile?.tenantId === 'unassigned' || userProfile?.tenantId === 'unauthorized')
  );
  const canUseNativeKey = Boolean(userProfile?.canUseNativeKey);

  useEffect(() => {
    if (user && userProfile) {
      setNativeKeyAccessState(canUseNativeKey, user?.uid);
    }
  }, [canUseNativeKey, user?.uid, userProfile]);

  const activeTenantId = useMemo(() => {
    if (isSuperAdmin && superAdminTenantId) {
      return superAdminTenantId;
    }
    return userProfile?.tenantId || 'gabinete_default';
  }, [isSuperAdmin, superAdminTenantId, userProfile?.tenantId]);

  const [activeUnit, setActiveUnitState] = useState<JudicialUnit>(() => {
    const saved = localStorage.getItem(ACTIVE_UNIT_KEY);
    if (saved) {
      const found = DEFAULT_UNITS.find(u => u.id === saved);
      if (found) return found;
    }
    return DEFAULT_UNITS[0];
  });

  const setActiveUnit = (unit: JudicialUnit) => {
    setActiveUnitState(unit);
    localStorage.setItem(ACTIVE_UNIT_KEY, unit.id);
    if (isSuperAdmin && unit.tenantId && unit.tenantId !== activeTenantId) {
      setSuperAdminTenantId(unit.tenantId);
      setGlobalTenantId(unit.tenantId);
      localStorage.setItem(SUPERADMIN_TENANT_KEY, unit.tenantId);
      window.dispatchEvent(new CustomEvent('tenant_changed', { detail: { tenantId: unit.tenantId, unitId: unit.id } }));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const setSuperAdminActiveTenant = async (tenantId: string, unitId?: string) => {
    if (!isSuperAdmin) return;
    const targetTenantId = tenantId || 'gabinete_default';
    setSuperAdminTenantId(targetTenantId);
    setGlobalTenantId(targetTenantId);
    localStorage.setItem(SUPERADMIN_TENANT_KEY, targetTenantId);

    const tenantObj = allTenants.find(t => t.id === targetTenantId);
    if (tenantObj) {
      setTenantName(tenantObj.name);
    }

    const isCurrentTenant = targetTenantId === activeTenantId;
    const matchingUnits = isCurrentTenant 
      ? dynamicUnits 
      : allUnitsForSuperAdmin.filter(u => u.tenantId === targetTenantId);
      
    let targetUnit: JudicialUnit;
    if (unitId) {
      targetUnit = matchingUnits.find(u => u.id === unitId) || allUnitsForSuperAdmin.find(u => u.id === unitId) || (matchingUnits[0] || DEFAULT_UNITS[0]);
    } else {
      targetUnit = matchingUnits.length > 0 ? matchingUnits[0] : (dynamicUnits[0] || DEFAULT_UNITS[0]);
    }

    setActiveUnitState(targetUnit);
    localStorage.setItem(ACTIVE_UNIT_KEY, targetUnit.id);
    window.dispatchEvent(new CustomEvent('tenant_changed', { detail: { tenantId: targetTenantId, unitId: targetUnit.id } }));
    window.dispatchEvent(new Event('storage'));
  };

  const clearAuthError = () => setAuthError(null);

  // Sync all tenants and units for Super Admin in realtime
  useEffect(() => {
    if (!isSuperAdmin || !user) return;

    const refreshSuperAdminData = async () => {
      try {
        const data = await fetchAllTenantsAndUnitsForSuperAdmin();
        setAllTenants(data.tenants);
        setAllUnitsForSuperAdmin(data.units);
      } catch (err) {
        console.warn("Could not load super admin multi-tenant data:", err);
      }
    };

    refreshSuperAdminData();

    // Subscribe to tenants collection
    const unsubscribeTenants = onSnapshot(collection(db, 'tenants'), async () => {
      refreshSuperAdminData();
    }, (error) => { console.warn('Snapshot error on tenants:', error); 
              if (error.code === 'resource-exhausted' || (error.message && error.message.includes('Quota limit'))) {
                setAuthError("Aviso: A quota gratuita diária do Firebase foi excedida. Você precisará habilitar o plano pago (Blaze) ou aguardar o reset diário para ler do banco. Tente novamente mais tarde.");
              }
 });

    return () => {
      unsubscribeTenants();
    };
  }, [isSuperAdmin, user]);

  useEffect(() => {
    // Login próprio: o perfil (papel, gabinete, unidades) vem do MySQL junto com a sessão; o resto é atualizado por consulta leve.
    let desfazer: Array<() => void> = [];
    const limpar = () => { desfazer.forEach((f) => { try { f(); } catch { /* já parado */ } }); desfazer = []; };
    const unsubscribeAuth = auth.onChange((u) => {
      limpar();
      setUser(u);
      setAuthError(null);
      const p = auth.perfil;
      if (u && p) {
        const savedSuperTenant = localStorage.getItem(SUPERADMIN_TENANT_KEY);
        const tenantAtual = p.superAdmin && savedSuperTenant ? savedSuperTenant : (p.tenantId || 'unassigned');
        setGlobalTenantId(tenantAtual);
        setUserProfile(p);
        syncApiKeyWithUserProfile(p, u.uid);
        sincronizarIAComPerfil(p);
        definirIdsAntigosHistorico((p as any)?.uidsAntigos);      // histórico do sistema antigo vinculado a este usuário
        if (tenantAtual !== 'unassigned') {
          desfazer.push(onSnapshot(doc(db, 'tenants', tenantAtual), (snap) => {
            if (snap.exists()) {
              const t: any = snap.data();
              setTenantName(t.name || null);
              setIsTenantSuspended(t.status === 'suspended' || t.status === 'maintenance');
              setTenantSuspensionReason(t.suspendedReason || (t.status === 'maintenance' ? 'Gabinete em manutenção técnica programada.' : 'Acesso ao Gabinete temporariamente suspenso pela administração.'));
            } else {
              setIsTenantSuspended(false);
              setTenantSuspensionReason(null);
              setTenantName(isPrimaryCabinet(tenantAtual) ? 'Gabinete Principal (Dr. Rafael Machado)' : null);
            }
          }, (e) => console.warn('Falha ao ler o gabinete:', e)));
          desfazer.push(subscribeToUnits((units) => {
            if (units && units.length > 0) {
              setDynamicUnits(units);
              setActiveUnitState(prev => units.find(x => x.id === prev.id) || (localStorage.setItem(ACTIVE_UNIT_KEY, units[0].id), units[0]));
            } else setDynamicUnits(DEFAULT_UNITS);
          }));
          // mudanças feitas pelo administrador no perfil (papel, unidades, ativação) chegam sem precisar sair e entrar de novo
          desfazer.push(onSnapshot(doc(db, 'users', u.uid), (snap) => {
            if (snap.exists()) setUserProfile((prev) => ({ ...(prev || {}), ...(snap.data() as any), tenantId: (snap.data() as any).tenantId && (snap.data() as any).tenantId !== 'unassigned' ? (snap.data() as any).tenantId : prev?.tenantId } as UserProfile));
          }, (e) => console.warn('Falha ao ler o perfil:', e)));
        }
      } else {
        setUserProfile(null);
        syncApiKeyWithUserProfile(null);
        setIsTenantSuspended(false);
        setTenantSuspensionReason(null);
      }
      setLoading(false);
    });
    return () => { limpar(); unsubscribeAuth(); };
  }, []);

  // When activeTenantId changes dynamically for Super Admin, re-bind units listener
  useEffect(() => {
    if (!isSuperAdmin || !user) return;
    setGlobalTenantId(activeTenantId);
    const unsub = subscribeToUnits((units) => {
      if (units && units.length > 0) {
        setDynamicUnits(units);
        setActiveUnitState(prev => {
          const matched = units.find(u => u.id === prev.id);
          if (matched) return matched;
          localStorage.setItem(ACTIVE_UNIT_KEY, units[0].id);
          return units[0];
        });
      } else if (isPrimaryCabinet(activeTenantId)) {
        setDynamicUnits(DEFAULT_UNITS);
      }
    });
    return () => {
      unsub();
    };
  }, [activeTenantId, isSuperAdmin, user]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try { await entrar(email, password); }
    catch (error: any) { setAuthError(error.message || "Erro ao entrar."); throw error; }
  };

  const completeTour = async (tourId: string) => {
    if (userProfile) {
      const current = userProfile.completedTours || [];
      if (!current.includes(tourId)) {
        const updated = [...current, tourId];
        await chamarAuth('PATCH', '/me', { completedTours: updated });
        setUserProfile({ ...userProfile, completedTours: updated });
      }
    }
  };

  const resetTours = async () => {
    if (userProfile) {
      await chamarAuth('PATCH', '/me', { completedTours: [] });
      setUserProfile({ ...userProfile, completedTours: [] });
    }
  };

  const signOut = async () => {
    try {
      syncApiKeyWithUserProfile(null);
      await auth.signOut();
      setUser(null);
      setUserProfile(null);
      setAuthError(null);
    } catch (error) {
      console.warn("Notice during sign out:", error);
    }
  };

  const recheckInvite = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const refreshedProfile = await recarregarPerfil();
      if (refreshedProfile) setUserProfile(refreshedProfile);
    } catch (err: any) {
      console.warn("Notice during recheck invite:", err);
    } finally {
      setLoading(false);
    }
  };

  const allowedUnits = useMemo(() => {
    const baseUnits = dynamicUnits && dynamicUnits.length > 0 ? dynamicUnits : DEFAULT_UNITS;
    if (isAdmin) {
      return baseUnits;
    }
    if (userProfile?.allowedUnits && userProfile.allowedUnits.length > 0) {
      const filtered = baseUnits.filter(u => userProfile.allowedUnits?.includes(u.id));
      if (filtered.length > 0) {
        return filtered;
      }
    }
    return baseUnits;
  }, [isAdmin, dynamicUnits, userProfile?.allowedUnits]);

  // Keep activeUnit valid within allowedUnits
  useEffect(() => {
    if (allowedUnits.length > 0) {
      setActiveUnitState(prev => {
        if (prev && allowedUnits.some(u => u.id === prev.id)) {
          return prev;
        }
        localStorage.setItem(ACTIVE_UNIT_KEY, allowedUnits[0].id);
        return allowedUnits[0];
      });
    }
  }, [allowedUnits]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      isAdmin, 
      isSuperAdmin, 
      isJudge, 
      isDeactivated,
      isUnauthorized,
      isTenantSuspended: isTenantSuspended && !isSuperAdmin,
      tenantSuspensionReason,
      tenantName,
      authError,
      canUseNativeKey, 
      loading, 
      activeUnit, 
      setActiveUnit, 
      allowedUnits, 
      activeTenantId,
      allTenants,
      allUnitsForSuperAdmin,
      setSuperAdminActiveTenant,
      signIn, 
      signOut, 
      completeTour, 
      resetTours,
      clearAuthError,
      recheckInvite
    }}>
      {children}
    </AuthContext.Provider>
  );
};
