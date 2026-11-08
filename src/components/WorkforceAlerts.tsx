import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, MonitorOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function WorkforceAlerts() {
  const [missingCount, setMissingCount] = useState(0);
  const [clockCount, setClockCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [missing, clocks] = await Promise.all([
        supabase.from("workforce_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null),
        supabase.from("clock_incidents").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      if (!alive) return;
      if (!missing.error) setMissingCount(missing.count ?? 0);
      if (!clocks.error) setClockCount(clocks.count ?? 0);
    };
    void load();
    const channel = supabase.channel(`attendance-alerts-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "workforce_alerts" }, () => {
        toast.warning("A staff punch is missing. Review company attendance.");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clock_incidents" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const title = (payload.new as { title?: string }).title;
          toast.error(title || "A company clock needs attention.", { description: "Open the Attendance Monitoring Center." });
        }
        void load();
      })
      .subscribe();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", focus);
    };
  }, []);

  if (!missingCount && !clockCount) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {missingCount > 0 && <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => navigate("/attendance?filter=missing")}><BellRing size={16} />{missingCount} missing-punch alert{missingCount === 1 ? "" : "s"}</Button>}
      {clockCount > 0 && <Button variant="outline" className="border-warning/50 bg-warning/10 text-warning" onClick={() => navigate("/attendance?clock_view=attention")}><MonitorOff size={16} />{clockCount} clock alert{clockCount === 1 ? "" : "s"}</Button>}
    </div>
  );
}
