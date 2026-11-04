import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Company-managed dropdown lists. A saved list replaces the built-in defaults for that field. */
export function cleanListItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().slice(0, 100);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
  }
  return out.slice(0, 300);
}

export function useCompanyLists() {
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const load = useCallback(async () => {
    const { data } = await supabase.from("company_picklists").select("list_key, items");
    setLists(Object.fromEntries((data || []).map(row => [row.list_key, row.items || []])));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = useCallback(async (key: string, items: string[]) => {
    const clean = cleanListItems(items);
    const { error } = await supabase.from("company_picklists").upsert({ list_key: key, items: clean, updated_at: new Date().toISOString() }, { onConflict: "org_id,list_key" });
    if (error) throw new Error(error.message);
    setLists(current => ({ ...current, [key]: clean }));
  }, []);
  const get = useCallback((key: string, defaults: string[]) => lists[key] ?? defaults, [lists]);
  return { get, save, has: (key: string) => key in lists };
}
