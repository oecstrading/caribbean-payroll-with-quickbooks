import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SummaryCard } from "@/components/SummaryCard";
import { hourlyRate, earnedPay } from "@/lib/earned-pay";

/** Today's payroll earned in the active company, from clocked hours × each employee's hourly rate. */
export default function TodayPayrollEarned() {
  const navigate = useNavigate();
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const today = new Date().toLocaleDateString("en-CA");
      const [s, e] = await Promise.all([
        supabase.from("workforce_shifts").select("employee_id,clock_in,clock_out,approved_hours,break_minutes").eq("shift_date", today),
        supabase.from("payroll_employee_directory").select("user_id,monthly_salary,hr_details").is("deleted_at", null),
      ]);
      if (!active || s.error || e.error) return;
      const rates: Record<string, number> = {};
      (e.data ?? []).forEach(x => { if (x.user_id) rates[x.user_id] = hourlyRate(Number(x.monthly_salary), Number((x.hr_details as { weekly_hours?: unknown } | null)?.weekly_hours)); });
      setTotal((s.data ?? []).reduce((sum, sh) => sum + earnedPay(sh, rates[sh.employee_id] ?? 0), 0));
    };
    void load();
    const t = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(t); };
  }, []);
  return <SummaryCard label="Payroll earned today" value={total === null ? "—" : total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} icon={DollarSign} onClick={() => navigate("/attendance")} className="carib-tile border-0 shadow-lg hover:shadow-xl" />;
}
