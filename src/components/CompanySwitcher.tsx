import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { loadMyCompanies, switchCompany, type MyCompany } from "@/lib/multi-company";

export default function CompanySwitcher({ userId, onCount }: { userId?: string; onCount?: (n: number) => void }) {
  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCompanies([]);
    if (userId) loadMyCompanies().then(c => { if (!cancelled) { setCompanies(c); onCount?.(c.length); } }).catch(() => onCount?.(0));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  if (companies.length < 2) return null;
  const current = companies.find(c => c.is_current)?.id ?? "";
  return (
    <label className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2 h-10 max-w-[220px]" title="Switch company">
      <Building2 size={16} className="text-primary shrink-0" />
      <span className="sr-only">Company</span>
      <select
        aria-label="Switch company"
        disabled={busy}
        value={current}
        onChange={async e => { setBusy(true); try { await switchCompany(e.target.value); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not switch company"); setBusy(false); } }}
        className="bg-transparent text-sm font-medium text-foreground outline-none min-w-0 truncate cursor-pointer"
      >
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_home ? " (home)" : ""}</option>)}
      </select>
    </label>
  );
}
