import * as React from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const picker = type === "date" || type === "month" || type === "time" || type === "datetime-local";
    const input = (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
          picker && "pr-12 [&::-webkit-calendar-picker-indicator]:hidden",
        )}
        ref={element => { inputRef.current = element; if (typeof ref === "function") ref(element); else if (ref) ref.current = element; }}
        {...props}
      />
    );
    if (!picker) return input;
    return <div className="relative w-full min-w-0">{input}<Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-11 text-muted-foreground" disabled={props.disabled || props.readOnly} aria-label={`Choose ${props["aria-label"] || props.id?.replace(/[-_]/g, " ") || (type === "time" ? "time" : "date")}`} title={type === "time" ? "Choose time" : "Choose date"} onClick={() => { const element = inputRef.current; if (!element) return; element.focus(); try { element.showPicker?.(); } catch { /* Text entry remains available if the browser disallows its picker. */ } }}>{type === "time" ? <Clock /> : <CalendarDays />}</Button></div>;
  },
);
Input.displayName = "Input";

export { Input };
