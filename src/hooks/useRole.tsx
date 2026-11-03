import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";
import { canOpenPath, roleModules } from "@/lib/workspace-access";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleContextType {
  role: AppRole | null;
  jurisdiction: string | null;
  loading: boolean;
  accessError: boolean;
  isAdmin: boolean;
  isCompanySuperAdmin: boolean;
  isPlatformAdmin: boolean;
  isManager: boolean;
  isAdminOrManager: boolean;
  isGuard: boolean;
  modules: string[];
  demoMode: boolean;
  canAccess: (path: string) => boolean;
  refreshAccess: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  jurisdiction: null,
  loading: true,
  accessError: false,
  isAdmin: false,
  isCompanySuperAdmin: false,
  isPlatformAdmin: false,
  isManager: false,
  isAdminOrManager: false,
  isGuard: false,
  modules: [],
  demoMode: false,
  canAccess: () => false,
  refreshAccess: async () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [jurisdiction, setJurisdiction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [clockEnabled, setClockEnabled] = useState(false);
  const [authority, setAuthority] = useState({ company_super_admin: false, platform_super_admin: false });
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const verifiedFor = useRef<string | null>(null);
  const refreshAccess = useCallback(async () => {
    if (!user) { setAccessError(false); setRole(null); setModules([]); setAuthority({ company_super_admin: false, platform_super_admin: false }); setJurisdiction(null); setLoadedUserId(null); setLoading(false); return; }
    setAccessError(false);
    try {
      // Fail to a retryable error after 12s instead of an endless loading screen.
      const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Access check timed out")), 12000));
      // Roles come from the server so they stay valid after switching to another company.
      const [accessRes, companyRes, authorityRes, clockRes] = await Promise.race([Promise.all([
        supabase.rpc("my_workspace_access"),
        supabase.rpc("company_configuration"),
        supabase.rpc("administrator_authority", { _user: user.id }),
        supabase.rpc("has_employee_clock_access", { _employee: user.id }),
      ]), timeout]);
      if (accessRes.error || companyRes.error || clockRes.error) throw new Error("Access verification unavailable");
      setClockEnabled(clockRes.data === true);
      const trusted = authorityRes.data as { company_super_admin?: boolean; platform_super_admin?: boolean } | null;
      setAuthority({ company_super_admin: !authorityRes.error && trusted?.company_super_admin === true, platform_super_admin: !authorityRes.error && trusted?.platform_super_admin === true });
      const access = accessRes.data as { roles?: string[]; modules?: string[] | null; jurisdiction?: string | null } | null;
      const roles = access?.roles ?? [];
      const configuration = companyRes.data as { modules?: string[]; demo_mode?: boolean } | null;
      const enabled = configuration?.modules ?? [];
      setCompanyModules(enabled); setDemoMode(configuration?.demo_mode === true);
      const nextRole = roles.includes("admin") ? "admin" : roles.includes("manager") ? "manager" : roles.includes("employee") ? "employee" : null;
      setRole(nextRole); setModules(nextRole ? (nextRole === "admin" ? roleModules(nextRole) : access?.modules ?? roleModules(nextRole)).filter(m => enabled.includes(m)) : []);
      setJurisdiction(access?.jurisdiction ?? null);
      verifiedFor.current = user.id;
    } catch {
      // A background re-check that fails keeps the already-verified workspace open.
      if (verifiedFor.current === user.id) return;
      setAccessError(true); setRole(null); setModules([]); setClockEnabled(false); setCompanyModules([]); setAuthority({ company_super_admin: false, platform_super_admin: false }); }
    setLoadedUserId(user.id); setLoading(false);
  }, [user?.id]);
  useEffect(() => {
    setLoading(true); void refreshAccess();
    const refresh = () => { void refreshAccess(); };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(interval); };
  }, [refreshAccess]);
  const ready = !loading && loadedUserId === (user?.id ?? null);
  const canAccess = useCallback((path: string) => ready && canOpenPath(role, modules, path, companyModules, clockEnabled), [ready, role, modules, companyModules, clockEnabled]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAdminOrManager = isAdmin || isManager;
  const isGuard = role === "employee";

  return (
    <RoleContext.Provider value={{ role: ready ? role : null, jurisdiction, loading: !ready, accessError, isAdmin: ready && isAdmin, isCompanySuperAdmin: ready && authority.company_super_admin, isPlatformAdmin: ready && authority.platform_super_admin, isManager: ready && isManager, isAdminOrManager: ready && isAdminOrManager, isGuard: ready && isGuard, modules: ready ? modules : [], demoMode: ready && demoMode, canAccess, refreshAccess }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
