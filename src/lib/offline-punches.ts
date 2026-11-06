import { supabase } from "@/integrations/supabase/client";

// Punches captured without internet wait on the device and sync when the connection returns.
// The server marks them "offline" so a manager confirms the phone time before they count for pay.
export type Dir = "clock_in" | "clock_out" | "lunch_out" | "lunch_in";
export type QueuedPunch = {
  id: string;
  direction: Dir;
  captured_at: string;
  latitude: number;
  longitude: number;
  mode: string;
  org_id?: string;
  employee_code?: string;
  pin?: string;
  error?: string;
};

const KEY = "offline-clock-punches";
const listeners = new Set<() => void>();

export function queuedPunches(): QueuedPunch[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save(list: QueuedPunch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full */ }
  listeners.forEach((l) => l());
}
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function queuePunch(p: Omit<QueuedPunch, "id" | "captured_at">) {
  const item: QueuedPunch = { ...p, id: crypto.randomUUID(), captured_at: new Date().toISOString() };
  save([...queuedPunches(), item]);
  return item;
}
export function discardPunch(id: string) { save(queuedPunches().filter((p) => p.id !== id)); }

/** True when a request failed because the device could not reach the server. */
export function isNetworkFailure(e: unknown) {
  if (!navigator.onLine) return true;
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /Failed to fetch|NetworkError|FunctionsFetchError|Load failed|network/i.test(m);
}

let syncing = false;
export async function syncPunches(): Promise<{ sent: number; failed: number }> {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0 };
  syncing = true;
  let sent = 0, failed = 0;
  try {
    const list = [...queuedPunches()].sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    for (const p of list) {
      if (p.error) { failed++; continue; }
      const body: Record<string, unknown> = { action: "punch", mode: p.mode, direction: p.direction, latitude: p.latitude, longitude: p.longitude, captured_at: p.captured_at, offline_id: p.id };
      if (p.pin) Object.assign(body, { org_id: p.org_id, employee_code: p.employee_code, pin: p.pin });
      try {
        const { data, error } = await supabase.functions.invoke("workforce-clock", { body });
        if (error) {
          let message = error.message;
          if (error.context instanceof Response) { const d = await error.context.json().catch(() => null); message = d?.error ?? message; }
          else if (isNetworkFailure(error)) break; // still offline; try later
          throw new Error(message);
        }
        if (data?.error) throw new Error(data.error);
        discardPunch(p.id); sent++;
      } catch (e) {
        if (isNetworkFailure(e)) break;
        save(queuedPunches().map((q) => q.id === p.id ? { ...q, error: e instanceof Error ? e.message : "Rejected", pin: undefined } : q));
        failed++;
      }
    }
  } finally { syncing = false; }
  return { sent, failed };
}

let started = false;
export function startPunchSync(onResult?: (r: { sent: number; failed: number }) => void) {
  if (started) return;
  started = true;
  const run = () => void syncPunches().then((r) => r.sent || r.failed ? onResult?.(r) : undefined);
  window.addEventListener("online", run);
  setInterval(run, 60_000);
  run();
}
