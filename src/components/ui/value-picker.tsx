import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type ValuePickerProps = {
  id: string; label: string; value: string; options: string[];
  onChange: (value: string) => void; disabled?: boolean; invalid?: boolean;
};

/** Existing values and custom HR entries retain their original string storage format. */
export function ValuePicker({ id, label, value, options, onChange, disabled, invalid }: ValuePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const choices = [...new Set([...options, value].map(item => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const custom = search.trim().slice(0, 100);
  const choose = (next: string) => { onChange(next); setOpen(false); setSearch(""); };
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} aria-invalid={invalid} disabled={disabled} className="h-11 w-full justify-between font-normal min-w-0 bg-background">
        <span className={`truncate text-left ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || "Not specified"}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 pointer-events-auto">
      <Command>
        <CommandInput aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onValueChange={setSearch} maxLength={100} />
        <CommandList>
          <CommandEmpty>No matching values</CommandEmpty>
          <CommandGroup>
            {!search && <CommandItem value="Not specified" onSelect={() => choose("")} className="min-h-11"><Check className={`mr-2 h-4 w-4 ${value ? "invisible" : ""}`} />Not specified</CommandItem>}
            {choices.map(choice => <CommandItem key={choice} value={choice} onSelect={() => choose(choice)} className="min-h-11"><Check className={`mr-2 h-4 w-4 shrink-0 ${value === choice ? "" : "invisible"}`} /><span className="break-words">{choice}</span></CommandItem>)}
          </CommandGroup>
        </CommandList>
        {custom && !choices.some(choice => choice.toLowerCase() === custom.toLowerCase()) && <div className="border-t border-border p-1"><Button type="button" variant="ghost" className="w-full h-auto min-h-11 justify-start text-left whitespace-normal" onClick={() => choose(custom)}><Plus className="shrink-0" /><span className="break-words min-w-0">Use “{custom}”</span></Button></div>}
      </Command>
    </PopoverContent>
  </Popover>;
}