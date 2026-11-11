import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Caribbean accent tones for summary cards. Each tone stays readable in light and dark mode. */
export type SummaryTone = "sea" | "lagoon" | "palm" | "mango" | "coral" | "hibiscus";

type ToneStyle = {
  surface: string;
  bar: string;
  chip: string;
  label: string;
  value: string;
  ring: string;
  chevron: string;
};

const TONES: Record<SummaryTone, ToneStyle> = {
  sea: {
    surface: "border-tone-sea/20 bg-gradient-to-br from-tone-sea/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-sea to-tone-lagoon",
    chip: "bg-tone-sea/20 text-tone-sea",
    label: "text-tone-sea",
    value: "text-tone-sea",
    ring: "ring-tone-sea",
    chevron: "text-tone-sea/60",
  },
  lagoon: {
    surface: "border-tone-lagoon/20 bg-gradient-to-br from-tone-lagoon/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-lagoon to-tone-sea",
    chip: "bg-tone-lagoon/20 text-tone-lagoon",
    label: "text-tone-lagoon",
    value: "text-tone-lagoon",
    ring: "ring-tone-lagoon",
    chevron: "text-tone-lagoon/60",
  },
  palm: {
    surface: "border-tone-palm/20 bg-gradient-to-br from-tone-palm/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-palm to-tone-lagoon",
    chip: "bg-tone-palm/20 text-tone-palm",
    label: "text-tone-palm",
    value: "text-tone-palm",
    ring: "ring-tone-palm",
    chevron: "text-tone-palm/60",
  },
  mango: {
    surface: "border-tone-mango/25 bg-gradient-to-br from-tone-mango/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-mango to-tone-coral",
    chip: "bg-tone-mango/20 text-tone-mango",
    label: "text-tone-mango",
    value: "text-tone-mango",
    ring: "ring-tone-mango",
    chevron: "text-tone-mango/60",
  },
  coral: {
    surface: "border-tone-coral/25 bg-gradient-to-br from-tone-coral/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-coral to-tone-hibiscus",
    chip: "bg-tone-coral/20 text-tone-coral",
    label: "text-tone-coral",
    value: "text-tone-coral",
    ring: "ring-tone-coral",
    chevron: "text-tone-coral/60",
  },
  hibiscus: {
    surface: "border-tone-hibiscus/25 bg-gradient-to-br from-tone-hibiscus/10 via-card to-card",
    bar: "bg-gradient-to-b from-tone-hibiscus to-tone-coral",
    chip: "bg-tone-hibiscus/20 text-tone-hibiscus",
    label: "text-tone-hibiscus",
    value: "text-tone-hibiscus",
    ring: "ring-tone-hibiscus",
    chevron: "text-tone-hibiscus/60",
  },
};

export function SummaryCard({
  label,
  value,
  icon: Icon,
  onClick,
  active,
  tone,
  className,
  valueClassName,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  /** Omit for cards that bring their own background (e.g. the dashboard gradient tiles). */
  tone?: SummaryTone;
  className?: string;
  valueClassName?: string;
}) {
  const t = tone ? TONES[tone] : null;
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-auto min-h-24 w-full justify-between whitespace-normal p-4 text-left shadow-card border-border/60 hover:shadow-md",
        t && "relative overflow-hidden border pl-5",
        t?.surface,
        active && (t ? `ring-2 ${t.ring} shadow-md` : "ring-2 ring-primary"),
        className
      )}
    >
      {t && <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", t.bar)} />}
      <span className={cn("card-label text-xs text-muted-foreground uppercase tracking-wide", t?.label)}>
        {label}
        <span className={cn("card-value block text-xl font-display font-bold mt-1", t?.value, valueClassName)}>
          {value}
        </span>
      </span>
      <span className={cn("card-chip flex items-center gap-1 text-muted-foreground", t?.chip, "rounded-lg p-1.5")}>
        {Icon && <Icon size={16} />}
        <ChevronRight size={14} className={t?.chevron} />
      </span>
    </Button>
  );
}
