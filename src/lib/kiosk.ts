import { supabase } from "@/integrations/supabase/client";
import { isNetworkFailure } from "@/lib/offline-punches";

// Shared company tablet clock: token, cached staff list and an offline punch queue live on the tablet.
export type KioskPerson = { id: string; name: string; first: string; department: string | null };
export type KioskRoster = { device: { name: string; department: string | null }; company: string; selfie_policy: "optional" | "always"; employees: KioskPerson[] };
export type KioskDir = "auto" | "clock_in" | "clock_out" | "lunch_out" | "lunch_in";
export type KioskQueued = { id: string; captured_at: string; direction: KioskDir; latitude: number; longitude: number; employee_id?: string; pin?: string; transcript?: string; photo?: string; name: string; error?: string };

const TOKEN = "kiosk-token", ROSTER = "kiosk-roster", QUEUE = "kiosk-queue";
export const kioskToken = () => localStorage.getItem(TOKEN);
export const setKioskToken = (t: string | null) => (t ? localStorage.setItem(TOKEN, t) : (localStorage.removeItem(TOKEN), localStorage.removeItem(ROSTER)));
export const cachedRoster = (): KioskRoster | null => { try { return JSON.parse(localStorage.getItem(ROSTER) ?? "null"); } catch { return null; } };
export const cacheRoster = (r: KioskRoster) => localStorage.setItem(ROSTER, JSON.stringify(r));

export class KioskError extends Error { constructor(msg: string, public offline = false, public deactivated = false) { super(msg); } }

export async function kioskCall<T = any>(body: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke("clock-device", { body });
    if (error) {
      if (error.context instanceof Response) {
        const d = await error.context.json().catch(() => null);
        throw new KioskError(d?.error ?? error.message, false, !!d?.deactivated);
      }
      if (isNetworkFailure(error)) throw new KioskError("No internet", true);
      throw new KioskError(error.message);
    }
    return data as T;
  } catch (e) {
    if (e instanceof KioskError) throw e;
    if (isNetworkFailure(e)) throw new KioskError("No internet", true);
    throw new KioskError(e instanceof Error ? e.message : "Clock request failed");
  }
}

export const kioskQueue = (): KioskQueued[] => { try { return JSON.parse(localStorage.getItem(QUEUE) ?? "[]"); } catch { return []; } };
const saveQueue = (q: KioskQueued[]) => { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch { /* full */ } };
export function queueKioskPunch(p: Omit<KioskQueued, "id" | "captured_at">) {
  saveQueue([...kioskQueue(), { ...p, id: crypto.randomUUID(), captured_at: new Date().toISOString() }]);
}

let syncing = false;
/** Sends waiting punches oldest first. The server marks them offline so a manager always reviews them. */
export async function syncKiosk(): Promise<{ sent: number; failed: number }> {
  const token = kioskToken();
  if (syncing || !token || !navigator.onLine) return { sent: 0, failed: 0 };
  syncing = true; let sent = 0, failed = 0;
  try {
    for (const p of [...kioskQueue()].sort((a, b) => a.captured_at.localeCompare(b.captured_at))) {
      if (p.error) { failed++; continue; }
      try {
        await kioskCall({ action: "punch", token, employee_id: p.employee_id, pin: p.pin, transcript: p.transcript, direction: p.direction, latitude: p.latitude, longitude: p.longitude, photo: p.photo, captured_at: p.captured_at, offline_id: p.id });
        saveQueue(kioskQueue().filter((q) => q.id !== p.id)); sent++;
      } catch (e) {
        if (e instanceof KioskError && e.offline) break;
        saveQueue(kioskQueue().map((q) => q.id === p.id ? { ...q, error: e instanceof Error ? e.message : "Rejected", pin: undefined, photo: undefined } : q));
        failed++;
      }
    }
  } finally { syncing = false; }
  return { sent, failed };
}

/** Words staff may say after their name. */
export function spokenDirection(text: string): KioskDir {
  const t = text.toLowerCase();
  if (/back from lunch|lunch in|return/.test(t)) return "lunch_in";
  if (/lunch|break/.test(t)) return "lunch_out";
  if (/clock(ing)? out|sign(ing)? out|going home|\bout\b/.test(t)) return "clock_out";
  if (/clock(ing)? in|sign(ing)? in|\bin\b/.test(t)) return "clock_in";
  return "auto";
}

export const DIR_LABEL: Record<Exclude<KioskDir, "auto">, string> = { clock_in: "Clock in", lunch_out: "Out for lunch", lunch_in: "Back from lunch", clock_out: "Clock out" };
