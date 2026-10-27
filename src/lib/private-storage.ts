import { supabase } from "@/integrations/supabase/client";

export function storageObjectPath(bucket: string, stored: string): string {
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!stored.includes("://")) return stored;
  const url = new URL(stored);
  const configured = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (url.origin !== configured.origin || !url.pathname.startsWith(prefix)) throw new Error("Invalid stored file reference");
  return decodeURIComponent(url.pathname.slice(prefix.length));
}
export async function privateFileUrl(bucket: string, stored: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storageObjectPath(bucket, stored), 300);
  if (error || !data) throw error || new Error("File unavailable");
  return data.signedUrl;
}