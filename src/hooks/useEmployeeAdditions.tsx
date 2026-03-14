import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollAddition } from "@/lib/payroll-engine";

interface AdditionRow {
  amount: number;
  is_active: boolean;
  user_id: string;
  addition_type: string;
  description: string;
}

// Returns a map of employee user_id -> PayrollAddition[]
export function useAllEmployeeAdditions() {
  const [additionsMap, setAdditionsMap] = useState<Record<string, PayrollAddition[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("employee_additions")
      .select("amount, is_active, user_id, addition_type, description")
      .eq("is_active", true)
      .then(({ data }) => {
        const map: Record<string, PayrollAddition[]> = {};
        if (data) {
          for (const row of data as unknown as AdditionRow[]) {
            if (!map[row.user_id]) map[row.user_id] = [];
            map[row.user_id].push({
              type: row.addition_type,
              description: row.description || row.addition_type,
              amount: Number(row.amount),
            });
          }
        }
        setAdditionsMap(map);
        setLoading(false);
      });
  }, []);

  return { additionsMap, loading };
}
