import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SummaryCard({ label, value, icon: Icon, onClick, active, className, valueClassName }: {
  label: string; value: React.ReactNode; icon: LucideIcon; onClick: () => void;
  active?: boolean; className?: string; valueClassName?: string;
}) {
  return <Button variant="outline" onClick={onClick} aria-label={`View ${label} details`} aria-pressed={active}
    className={cn("h-auto min-h-24 w-full justify-between whitespace-normal p-4 text-left shadow-card border-border/60 hover:shadow-md", active && "ring-2 ring-primary", className)}>
    <span className="min-w-0"><span className="block text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("block text-xl font-display font-bold mt-1", valueClassName)}>{value}</span></span>
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground"><Icon /><ChevronRight /></span>
  </Button>;
}