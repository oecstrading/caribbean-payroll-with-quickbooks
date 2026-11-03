import { supabase } from "@/integrations/supabase/client";

export type MyCompany = { id: string; name: string; is_home: boolean; is_current: boolean };

export async function loadMyCompanies(): Promise<MyCompany[]> {
  const { data, error } = await supabase.rpc("my_companies");
  if (error) throw error;
  return (data ?? []) as MyCompany[];
}

/** Switch the active company, then fully reload so no previous company's data stays on screen. */
export async function switchCompany(id: string, to = "/") {
  const { error } = await supabase.rpc("switch_company", { _org: id });
  if (error) throw error;
  window.location.assign(to);
}
