import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// After a new publish, old cached pages may reference files that no longer exist; reload once to get the new version.
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("reloaded-after-update")) {
    sessionStorage.setItem("reloaded-after-update", "1");
    window.location.reload();
  }
});

// Check for a newly published version on load, every 5 minutes and when the app regains focus; reload once it takes over.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let refreshing = !navigator.serviceWorker.controller; // skip reload on very first install
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;
    const check = () => reg.update().catch(() => undefined);
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
  });
}
