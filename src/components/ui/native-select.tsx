import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native selection semantics preserve IDs, empty values, forms and device pickers. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => <div className={cn("relative min-w-0", className?.includes("w-full") && "w-full", className?.includes("flex-1") && "flex-1")}>
    <select ref={ref} {...props} className={cn("flex h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70", className, "pr-9")}>
      {children}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  </div>,
);
NativeSelect.displayName = "NativeSelect";