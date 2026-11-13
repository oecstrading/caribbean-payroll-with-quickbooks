import { clockDeviceId } from "@/lib/clock-device-id";
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

// PINs are never written to phone storage. They live only in memory for this open page;
// after a reload the employee re-enters code + PIN and the waiting punches send.
const pins = new Map<string, string>();
const pinKey = (org?: string, code?: string) => `${org ?? ""}|${(code ?? "").toLowerCase()}`;
export function rememberPin(org: string | undefined, code: string | undefined, pin: string) { if (org && code && pin) pins.set(pinKey(org, code), pin); }
export function needsPin(p: QueuedPunch) { return p.mode === "pin" && !pins.has(pinKey(p.org_id, p.employee_code)); }

export function queuedPunches(): QueuedPunch[] {
  try {
    const list: QueuedPunch[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (list.some((q) => q.pin)) { // clean up PINs left by older versions
      list.forEach((q) => { if (q.pin) rememberPin(q.org_id, q.employee_code, q.pin); delete q.pin; });
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
    }
    return list;
  } catch { return []; }
}
function save(list: QueuedPunch[]): boolean {
  let ok = true;
  try { localStorage.setItem(KEY, JSON.stringify(list.map(({ pin: _pin, ...q }) => q))); } catch { ok = false; }
  listeners.forEach((l) => l());
  return ok;
}
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function queuePunch(p: Omit<QueuedPunch, "id" | "captured_at">) {
  const item: QueuedPunch = { ...p, id: crypto.randomUUID(), captured_at: new Date().toISOString() };
  if (item.pin) rememberPin(item.org_id, item.employee_code, item.pin);
  delete item.pin;
  if (!save([...queuedPunches(), item])) throw new Error("Punch NOT saved — this phone's storage is full or blocked (private browsing?). Try again with internet, or tell your manager.");
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
      if (needsPin(p)) continue; // waits until the employee enters code + PIN again
      const body: Record<string, unknown> = { action: "punch", mode: p.mode, direction: p.direction, latitude: p.latitude, longitude: p.longitude, captured_at: p.captured_at, offline_id: p.id };
      if (p.mode === "pin") Object.assign(body, { org_id: p.org_id, employee_code: p.employee_code, pin: pins.get(pinKey(p.org_id, p.employee_code)), device_id: clockDeviceId() });
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
        save(queuedPunches().map((q) => q.id === p.id ? { ...q, error: e instanceof Error ? e.message : "Rejected" } : q));
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
