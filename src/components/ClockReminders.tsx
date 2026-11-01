import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { dueReminder, REMINDER_TEXT, type ClockSchedule } from "@/lib/clock-reminders";

const PREF = "clock-reminders-enabled";
const SENT = "clock-reminders-sent";

function alarm() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach(t => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.25, ctx.currentTime + t); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { /* audio blocked */ }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

/** Device-side clock reminders. The employee's on/off choice is stored on this device only. */
export default function ClockReminders({ schedule, next }: { schedule: ClockSchedule | null; next: "clock_in" | "clock_out" }) {
  const [on, setOn] = useState(() => localStorage.getItem(PREF) !== "off");
  const nextRef = useRef(next); nextRef.current = next;

  const toggle = async (v: boolean) => {
    setOn(v); localStorage.setItem(PREF, v ? "on" : "off");
    if (v && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  };

  useEffect(() => {
    if (!on || !schedule) return;
    const check = () => {
      const due = dueReminder(schedule, new Date(), nextRef.current); if (!due) return;
      const sent: string[] = JSON.parse(localStorage.getItem(SENT) ?? "[]");
      if (sent.includes(due.key)) return;
      localStorage.setItem(SENT, JSON.stringify([...sent.slice(-20), due.key]));
      const text = REMINDER_TEXT[due.kind];
      alarm(); toast.warning(text, { duration: 15000 });
      if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker?.getRegistration().then(r => { if (r) return r.showNotification("Time clock", { body: text, tag: due.key }); new Notification("Time clock", { body: text }); }).catch(() => { new Notification("Time clock", { body: text }); });
      }
    };
    check(); const id = window.setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [on, schedule?.start, schedule?.end, schedule?.days?.join()]);

  return <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 min-h-11 cursor-pointer">
    <span className="flex items-center gap-2 text-sm">{on ? <BellRing size={18} className="text-primary" /> : <BellOff size={18} className="text-muted-foreground" />}
      <span><span className="font-medium">Clock reminders & alarm</span><span className="block text-xs text-muted-foreground">{schedule ? `5 min before ${schedule.start.slice(0, 5)} and ${schedule.end.slice(0, 5)}, plus missing punches` : "No shift schedule set yet"}</span></span></span>
    <Switch checked={on} onCheckedChange={v => void toggle(v)} aria-label="Clock reminders" />
  </label>;
}
