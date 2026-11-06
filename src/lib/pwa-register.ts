// The only place the offline app worker is registered. Never in dev, preview or inside an iframe.
function refused() {
  const h = window.location.hostname.toLowerCase();
  const first = h.split(".")[0];
  const lovable = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(h);
  return (
    !import.meta.env.PROD ||
    window.self !== window.top ||
    (lovable && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(first)) ||
    (lovable && /^project--.+-dev$/.test(first)) ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(h) ||
    /(^|\.)beta\.lovable\.dev$/.test(h) ||
    new URLSearchParams(window.location.search).get("sw") === "off"
  );
}

export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (refused()) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).forEach((r) => r.unregister()),
    ).catch(() => undefined);
    return;
  }
  let refreshing = !navigator.serviceWorker.controller; // skip reload on very first install
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
    const check = () => reg.update().catch(() => undefined);
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
  }).catch(() => undefined);
}

/** Staff who installed the app from their clock link land back on that clock when they open it. */
export function openLastClockOnLaunch() {
  try {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    const last = localStorage.getItem("last-clock-page");
    if (standalone && window.location.pathname === "/" && last?.startsWith("/time-clock/")) window.history.replaceState(null, "", last);
  } catch { /* ignore */ }
}
