import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleContextType {
  role: AppRole | null;
  jurisdiction: string | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAdminOrManager: boolean;
  isGuard: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  jurisdiction: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  isAdminOrManager: false,
  isGuard: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [jurisdiction, setJurisdiction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setJurisdiction(null);
      setLoading(false);
      return;
    }

    // Try to read role from JWT claims first (instant, no DB query)
    const jwtRole = (session as any)?.access_token
      ? (() => {
          try {
            const payload = JSON.parse(atob(session!.access_token.split(".")[1]));
            return payload.user_role as string | undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;

    const jwtJurisdiction = (session as any)?.access_token
      ? (() => {
          try {
            const payload = JSON.parse(atob(session!.access_token.split(".")[1]));
            return payload.user_jurisdiction as string | undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;

    if (jwtRole && ["admin", "manager", "employee"].includes(jwtRole)) {
      setRole(jwtRole as AppRole);
      setJurisdiction(jwtJurisdiction ?? null);
      setLoading(false);
      return;
    }

    // Fallback: query the database
    const fetchRole = async () => {
      const [roleRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("jurisdiction")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setRole(roleRes.data?.role ?? "employee");
      setJurisdiction(profileRes.data?.jurisdiction ?? null);
      setLoading(false);
    };

    fetchRole();
  }, [user, session]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAdminOrManager = isAdmin || isManager;
  const isGuard = role === "employee";

  return (
    <RoleContext.Provider value={{ role, jurisdiction, loading, isAdmin, isManager, isAdminOrManager, isGuard }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
