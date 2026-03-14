import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CreditorDeduction } from "@/lib/payroll-engine";

interface DeductionRow {
  amount: number;
  is_active: boolean;
  user_id: string;
  creditors: { name: string } | null;
}

// Returns a map of employee user_id -> CreditorDeduction[]
export function useAllEmployeeDeductions() {
  const [deductionsMap, setDeductionsMap] = useState<Record<string, CreditorDeduction[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("employee_deductions")
      .select("amount, is_active, user_id, creditors(name)")
      .eq("is_active", true)
      .then(({ data }) => {
        const map: Record<string, CreditorDeduction[]> = {};
        if (data) {
          for (const row of data as unknown as DeductionRow[]) {
            if (!map[row.user_id]) map[row.user_id] = [];
            map[row.user_id].push({
              creditorName: row.creditors?.name || "Unknown",
              amount: Number(row.amount),
            });
          }
        }
        setDeductionsMap(map);
        setLoading(false);
      });
  }, []);

  return { deductionsMap, loading };
}

// Returns deductions for a single employee by sample ID (not user_id)
// Since sample data uses fake IDs, this returns empty for now
// but will work once payroll uses real DB profiles
export function useSingleEmployeeDeductions(userId: string) {
  const [deductions, setDeductions] = useState<CreditorDeduction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    supabase
      .from("employee_deductions")
      .select("amount, is_active, creditors(name)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          setDeductions(
            (data as unknown as DeductionRow[]).map((r) => ({
              creditorName: r.creditors?.name || "Unknown",
              amount: Number(r.amount),
            }))
          );
        }
        setLoading(false);
      });
  }, [userId]);

  return { deductions, loading };
}
