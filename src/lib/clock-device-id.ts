// A random, permanent ID for this phone/browser. The server locks each employee's
// personal PIN clock to the first phone that uses it, so a PIN shared with a
// co-worker cannot be used from another phone (anti buddy-punching).
// The ID is kept in both localStorage and a long-lived cookie so that clearing one
// (or the installed home-screen app vs. the browser) does not make the phone look new.
const KEY = "staff-clock-device-id";
const VALID = /^[0-9a-f-]{36}$/;

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`));
    return m && VALID.test(m[1]) ? m[1] : null;
  } catch { return null; }
}
function writeCookie(id: string) {
  try { document.cookie = `${KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365 * 5}; SameSite=Lax; Secure`; } catch { /* ignore */ }
}

export function clockDeviceId(): string {
  let id: string | null = null;
  try { const v = localStorage.getItem(KEY); if (v && VALID.test(v)) id = v; } catch { /* ignore */ }
  if (!id) id = readCookie();
  if (!id) id = fromHomeScreenLink();
  if (!id) id = crypto.randomUUID();
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  writeCookie(id);
  return id;
}

/** WhatsApp/Facebook/Instagram open links in their own mini-browser, which looks like a different phone. */
export function isInAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|; wv\)/i.test(ua);
}

const isStandalone = () => {
  try { return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return false; }
};

/** iPhone home-screen apps get empty storage, so the saved link carries this phone's ID (#d=...). */
function fromHomeScreenLink(): string | null {
  try {
    if (!isStandalone()) return null;
    const m = window.location.hash.match(/(?:^#|&)d=([0-9a-f-]{36})/);
    return m && VALID.test(m[1]) ? m[1] : null;
  } catch { return null; }
}

/** Puts this phone's ID in the page link so "Add to Home Screen" on iPhone keeps the same clock identity. */
export function tagLinkWithDeviceId() {
  try {
    const id = clockDeviceId();
    const url = new URL(window.location.href);
    url.hash = `d=${id}`;
    window.history.replaceState(window.history.state, "", url.toString());
  } catch { /* ignore */ }
}
