import { useEffect, useState } from "react";
import { CalendarDays, Plus, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];
type LeaveStatus = Database["public"]["Enums"]["leave_status"];

interface LeaveBalance {
  id: string;
  leave_type: LeaveType;
  total_days: number;
  used_days: number;
  year: number;
}

interface LeaveRequest {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  created_at: string;
}

const leaveLabels: Record<LeaveType, { label: string; color: string }> = {
  annual: { label: "Annual Leave", color: "bg-primary/10 text-primary" },
  sick: { label: "Sick Leave", color: "bg-warning/10 text-warning" },
  personal: { label: "Personal", color: "bg-accent/20 text-accent-foreground" },
  maternity: { label: "Maternity", color: "bg-success/10 text-success" },
  bereavement: { label: "Bereavement", color: "bg-muted text-muted-foreground" },
  study: { label: "Study Leave", color: "bg-primary/10 text-primary" },
};

const leaveTypes: LeaveType[] = ["annual", "sick", "personal", "maternity", "bereavement", "study"];

export default function PortalLeave() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type: "annual" as LeaveType,
    start_date: "",
    end_date: "",
    reason: "",
  });

  const fetchData = async () => {
    if (!user) return;
    const [balRes, reqRes] = await Promise.all([
      supabase.from("leave_balances").select("*").eq("user_id", user.id),
      supabase.from("leave_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setBalances(balRes.data || []);
    setRequests(reqRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    let days = 0;
    const current = new Date(s);
    while (current <= e) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleSubmit = async () => {
    if (!user || !form.start_date || !form.end_date) return;
    const days = calculateDays(form.start_date, form.end_date);
    if (days <= 0) {
      toast.error("End date must be after start date");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days,
        reason: form.reason || "",
      });
      if (error) throw error;
      toast.success("Leave request submitted!");
      setShowRequest(false);
      setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Card className="shadow-card border-border/60"><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Leave Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {leaveTypes.map((type) => {
          const balance = balances.find((b) => b.leave_type === type);
          const info = leaveLabels[type];
          const total = balance?.total_days ?? 0;
          const used = balance?.used_days ?? 0;
          const remaining = total - used;
          return (
            <Card key={type} className="shadow-card border-border/60">
              <CardContent className="p-4 text-center">
                <Badge variant="secondary" className={`${info.color} mb-2 text-[10px]`}>
                  {info.label}
                </Badge>
                <p className="text-2xl font-display font-bold text-foreground">{remaining}</p>
                <p className="text-[10px] text-muted-foreground">{used} used of {total} days</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Request Leave Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowRequest(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Request Leave
        </button>
      </div>

      {/* Leave Requests */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            Leave History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No leave requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const info = leaveLabels[req.leave_type];
                return (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className={`${info.color} text-[10px]`}>{info.label}</Badge>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(req.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(req.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">{req.days} day{req.days !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        req.status === "approved" ? "bg-success/10 text-success" :
                        req.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-warning/10 text-warning"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leave Type</label>
              <select
                value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value as LeaveType })}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {leaveTypes.map((t) => (
                  <option key={t} value={t}>{leaveLabels[t].label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            {form.start_date && form.end_date && (
              <p className="text-sm text-muted-foreground">
                {calculateDays(form.start_date, form.end_date)} business day(s)
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason (optional)</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Brief reason for leave..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.start_date || !form.end_date}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
