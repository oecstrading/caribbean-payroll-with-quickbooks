import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Users, CalendarDays, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type LeaveStatus = Database["public"]["Enums"]["leave_status"];
type LeaveType = Database["public"]["Enums"]["leave_type"];

interface LeaveRequestWithProfile {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
    department: string | null;
    job_title: string | null;
  };
}

const leaveLabels: Record<LeaveType, { label: string; color: string }> = {
  annual: { label: "Annual", color: "bg-primary/10 text-primary" },
  sick: { label: "Sick", color: "bg-warning/10 text-warning" },
  personal: { label: "Personal", color: "bg-accent/20 text-accent-foreground" },
  maternity: { label: "Maternity", color: "bg-success/10 text-success" },
  bereavement: { label: "Bereavement", color: "bg-muted text-muted-foreground" },
  study: { label: "Study", color: "bg-primary/10 text-primary" },
};

const statusConfig: Record<LeaveStatus, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: "bg-warning/10 text-warning" },
  approved: { icon: CheckCircle, color: "bg-success/10 text-success" },
  rejected: { icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [requests, setRequests] = useState<LeaveRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | "all">("all");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user || !isAdminOrManager) return;
    
    const { data: leaveData, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load leave requests");
      setLoading(false);
      return;
    }

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set((leaveData || []).map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, department, job_title")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    const enriched: LeaveRequestWithProfile[] = (leaveData || []).map((r) => ({
      ...r,
      profile: profileMap.get(r.user_id),
    }));

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [user, isAdminOrManager]);

  const handleAction = async (requestId: string, action: "approved" | "rejected") => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: action })
        .eq("id", requestId);

      if (error) throw error;

      // Update used_days on approval
      if (action === "approved") {
        const request = requests.find((r) => r.id === requestId);
        if (request) {
          const { data: balance } = await supabase
            .from("leave_balances")
            .select("*")
            .eq("user_id", request.user_id)
            .eq("leave_type", request.leave_type)
            .maybeSingle();

          if (balance) {
            await supabase
              .from("leave_balances")
              .update({ used_days: balance.used_days + request.days })
              .eq("id", balance.id);
          }
        }
      }

      toast.success(`Leave request ${action}`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  if (!isAdminOrManager) {
    return (
      <div className="p-6">
        <Card className="shadow-card border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            You don't have permission to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage team leave requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending", count: pendingCount, color: "text-warning", bg: "bg-warning/10" },
          { label: "Approved", count: approvedCount, color: "text-success", bg: "bg-success/10" },
          { label: "Rejected", count: rejectedCount, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <span className={`text-lg font-bold ${stat.color}`}>{stat.count}</span>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CalendarDays size={16} className="text-primary" />
            Leave Requests ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No leave requests found.</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map((req) => {
                  const info = leaveLabels[req.leave_type];
                  const stConfig = statusConfig[req.status];
                  const StatusIcon = stConfig.icon;
                  const name = req.profile
                    ? `${req.profile.first_name} ${req.profile.last_name}`
                    : "Unknown Employee";

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {req.profile ? `${req.profile.first_name[0]}${req.profile.last_name[0]}` : "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.profile?.department || "No dept"} · {req.profile?.job_title || "No title"}
                          </p>
                        </div>
                        <Badge variant="secondary" className={`${info.color} text-[10px] flex-shrink-0`}>
                          {info.label}
                        </Badge>
                        <div className="text-sm text-foreground flex-shrink-0">
                          <span>
                            {new Date(req.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" — "}
                            {new Date(req.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">({req.days}d)</span>
                        </div>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] flex-shrink" title={req.reason}>
                            "{req.reason}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {req.status === "pending" ? (
                          <>
                            <button
                              onClick={() => handleAction(req.id, "approved")}
                              disabled={processing === req.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle size={14} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(req.id, "rejected")}
                              disabled={processing === req.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </>
                        ) : (
                          <Badge variant="secondary" className={`${stConfig.color} text-[10px]`}>
                            <StatusIcon size={12} className="mr-1" />
                            {req.status}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
