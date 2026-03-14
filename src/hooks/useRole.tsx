import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleContextType {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAdminOrManager: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  isAdminOrManager: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setRole(data?.role ?? "employee");
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAdminOrManager = isAdmin || isManager;

  return (
    <RoleContext.Provider value={{ role, loading, isAdmin, isManager, isAdminOrManager }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
