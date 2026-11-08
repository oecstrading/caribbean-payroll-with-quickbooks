export type ClockType = "shared" | "personal";
export type ClockStatus =
  | "online"
  | "offline"
  | "activation_pending"
  | "switched_off"
  | "not_configured"
  | "locked"
  | "sync_review"
  | "on_lunch"
  | "clocked_in"
  | "ready";

export type MonitoredClock = {
  id: string;
  type: ClockType;
  name: string;
  department: string | null;
  site_id: string | null;
  site_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ClockStatus;
  last_seen_at: string | null;
  last_activity_at: string | null;
  current_activity: string | null;
  punches_today: number;
  activated_at?: string | null;
  bound_at?: string | null;
};

export type ClockIncident = {
  id: string;
  clock_type: ClockType;
  clock_id: string;
  kind: "shared_offline" | "offline_sync_review";
  severity: "high" | "medium";
  title: string;
  detail: string;
  status: "open" | "acknowledged";
  first_detected_at: string;
  last_detected_at: string;
};

export type ClockMonitoringData = {
  generated_at: string;
  clocks: MonitoredClock[];
  incidents: ClockIncident[];
};

export type ClockFilter = "all" | "attention" | "working" | "shared" | "personal";

export const CLOCK_STATUS_LABELS: Record<ClockStatus, string> = {
  online: "Online",
  offline: "Offline",
  activation_pending: "Activation pending",
  switched_off: "Switched off",
  not_configured: "Login not configured",
  locked: "Temporarily locked",
  sync_review: "Sync review needed",
  on_lunch: "On lunch",
  clocked_in: "Clocked in",
  ready: "Ready",
};

export function clockNeedsAttention(clock: MonitoredClock): boolean {
  return ["offline", "locked", "sync_review"].includes(clock.status);
}

export function clockIsWorking(clock: MonitoredClock): boolean {
  return clock.status === "clocked_in" || clock.status === "on_lunch";
}

export function filterMonitoredClocks(clocks: MonitoredClock[], filter: ClockFilter): MonitoredClock[] {
  if (filter === "attention") return clocks.filter(clockNeedsAttention);
  if (filter === "working") return clocks.filter(clockIsWorking);
  if (filter === "shared" || filter === "personal") return clocks.filter((clock) => clock.type === filter);
  return clocks;
}

export function clockStatusTone(clock: MonitoredClock): "success" | "warning" | "destructive" | "muted" {
  if (clock.status === "offline" || clock.status === "locked") return "destructive";
  if (clock.status === "sync_review" || clock.status === "activation_pending" || clock.status === "not_configured") return "warning";
  if (clock.status === "online" || clockIsWorking(clock) || clock.status === "ready") return "success";
  return "muted";
}

export type ClockFixAction = "switch_off_tablet" | "reset_phone" | "review_punches" | "open_tablets";
export type ClockExplanation = { why: string; fix: string; actions: ClockFixAction[] };

/** Plain-language AI Paymaster explanation of why a clock needs attention and how to resolve it. */
export function explainClock(clock: MonitoredClock, sinceLabel: string): ClockExplanation | null {
  if (clock.status === "offline") {
    return {
      why: `“${clock.name}” is an activated shared tablet, but it has not contacted the platform since ${sinceLabel}. Staff cannot reliably clock in on it, and any punches it holds are not syncing.`,
      fix: "If the tablet is in use, open the clock on it and check its power and internet — it turns green automatically once it reconnects. If it was only a test or is no longer used, switch it off so it stops raising alerts.",
      actions: ["switch_off_tablet", "open_tablets"],
    };
  }
  if (clock.status === "locked") {
    return {
      why: `${clock.name}'s personal clock is locked to one phone, and a different phone or browser tried to punch.`,
      fix: "If the employee changed phones or browsers, reset the phone lock. Their next punch will register the new phone.",
      actions: ["reset_phone"],
    };
  }
  if (clock.status === "sync_review") {
    return {
      why: `${clock.name} has punches recorded while offline. They are kept out of payroll until a manager confirms them.`,
      fix: "Review the offline punches and approve or correct them.",
      actions: ["review_punches"],
    };
  }
  return null;
}

export function clockLocationLabel(clock: MonitoredClock): string {
  if (clock.site_name) return clock.site_name;
  return clock.latitude != null && clock.longitude != null ? "Last punch location" : "No location reported";
}
