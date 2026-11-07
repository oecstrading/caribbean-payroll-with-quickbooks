import { supabase } from "@/integrations/supabase/client";

/**
 * Marks the home company as already applied for a user inside this browser tab,
 * so a manual company switch is never undone by a later render or reload.
 */
const APPLIED_KEY = "oecs-home-company-applied";

type CompanyRow = { id: string; is_home: boolean };

/** The company recorded as this user's home, or null when none is assigned. */
export async function homeCompanyId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_companies");
  if (error) throw new Error(error.message);
  const companies = (data ?? []) as CompanyRow[];
  return companies.find(company => company.is_home)?.id ?? null;
}

/**
 * On a fresh sign-in, open the user's home company instead of whichever company
 * was last switched to. Returns true when a switch was issued — the page
 * reloads, so the caller should keep showing its loading state.
 */
export async function applyHomeCompany(userId: string): Promise<boolean> {
  try {
    if (sessionStorage.getItem(APPLIED_KEY) === userId) return false;
    const home = await homeCompanyId();
    if (!home) return false;
    const { data: current, error } = await supabase.rpc("current_org_id");
    if (error || !current || current === home) return false;
    const { error: switchError } = await supabase.rpc("switch_company", { _org: home });
    if (switchError) return false;
    // Set before reloading: the next start must not switch again in this tab.
    sessionStorage.setItem(APPLIED_KEY, userId);
    window.location.assign("/");
    return true;
  } catch {
    // A Cloud hiccup must not keep the app on the loading screen.
    return false;
  }
}

/** Forget the applied home so the next sign-in starts on the home company again. */
export function clearHomeCompanyFlag(): void {
  sessionStorage.removeItem(APPLIED_KEY);
}
