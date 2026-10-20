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
