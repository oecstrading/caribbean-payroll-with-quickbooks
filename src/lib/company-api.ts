import { supabase } from "@/integrations/supabase/client";
export async function companyAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("company-onboarding", { body });
  if (error) {
    let message = error.message;
    if ("context" in error && error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      message = detail?.error ?? message;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}