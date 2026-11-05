import { AlarmClock, CalendarCheck, DollarSign, Mail, MessageCircle, Phone, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StaffSummary = {
  name: string; job_title: string | null; department: string | null;
  month_hours: number; days_worked: number; times_late: number; missing_punches: number;
  hourly_rate: number; estimated_earnings: number;
  company: string | null; company_phone: string | null; company_email: string | null;
};

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const digits = (p: string) => p.replace(/\D/g, "");

export default function StaffDashboard({ summary }: { summary: StaffSummary }) {
  const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const tiles = [
    { label: "Hours worked", value: summary.month_hours.toFixed(2), icon: Timer, tone: "bg-primary/10 text-primary" },
    { label: "Days worked", value: String(summary.days_worked), icon: CalendarCheck, tone: "bg-success/10 text-success" },
    { label: "Est. earned", value: money(summary.estimated_earnings), icon: DollarSign, tone: "bg-accent/15 text-accent-foreground" },
    { label: "Times late", value: String(summary.times_late), icon: AlarmClock, tone: summary.times_late ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground" },
    { label: "Missing punches", value: String(summary.missing_punches), icon: TriangleAlert, tone: summary.missing_punches ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground" },
  ];
  const msg = encodeURIComponent(`Hi, this is ${summary.name || "a staff member"}. I have a question about my hours/pay for ${month}.`);
  return (
    <div className="text-left space-y-4" aria-label="My work dashboard">
      <div>
        <p className="font-display text-lg font-bold">{summary.name ? `Hi, ${summary.name.split(" ")[0]}` : "My work"}</p>
        <p className="text-sm text-muted-foreground">{[summary.job_title, summary.department].filter(Boolean).join(" · ")} — {month} so far</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <div key={t.label} className={`rounded-lg p-3 ${t.tone} ${t.label === "Est. earned" ? "col-span-2" : ""}`}>
            <t.icon size={18} />
            <p className="text-2xl font-bold tabular-nums mt-1">{t.value}</p>
            <p className="text-xs font-medium">{t.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Earnings are an estimate before deductions{summary.hourly_rate ? ` (about ${money(summary.hourly_rate)}/hr)` : ""}. Your pay slip shows the final amount. Late = more than 5 minutes after shift start.
      </p>
      {(summary.company_phone || summary.company_email) && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">Contact {summary.company ?? "your manager"}</p>
          <div className="grid grid-cols-3 gap-2">
            {summary.company_phone && <Button asChild className="h-12 bg-success text-success-foreground hover:bg-success/90"><a href={`https://wa.me/${digits(summary.company_phone)}?text=${msg}`} target="_blank" rel="noreferrer"><MessageCircle size={18} />WhatsApp</a></Button>}
            {summary.company_phone && <Button asChild variant="outline" className="h-12"><a href={`tel:${summary.company_phone}`}><Phone size={18} />Call</a></Button>}
            {summary.company_email && <Button asChild variant="outline" className="h-12"><a href={`mailto:${summary.company_email}?subject=${encodeURIComponent(`Hours/pay question – ${month}`)}&body=${msg}`}><Mail size={18} />Email</a></Button>}
          </div>
        </div>
      )}
    </div>
  );
}
