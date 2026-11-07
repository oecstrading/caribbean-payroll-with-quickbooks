import { PUBLISHED_URL } from "@/lib/staff-clock-link";

export function activationCode(search: string, hash: string): string {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("code") ?? new URLSearchParams(search).get("code") ?? "";
  return value.trim().toUpperCase();
}

export function validActivationCode(code: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(code);
}

export const kioskActivationLink = (code: string) => `${PUBLISHED_URL}/kiosk#code=${encodeURIComponent(code)}`;
export const KIOSK_SETUP_KEY = "kiosk-setup-complete";