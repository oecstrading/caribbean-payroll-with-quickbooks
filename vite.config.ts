import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        // Never answer file downloads (PDFs, docs, CSVs…) or training/marketing files with the app shell
        navigateFallbackDenylist: [/^\/~oauth/, /^\/(training|marketing|downloads)\//, /\.[a-z0-9]{2,5}$/i],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The page itself is never served from cache, so every visit after a publish loads the newest version.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: { cacheName: "app-pages", networkTimeoutSeconds: 4 },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      // The manifest is a static file linked from index.html everywhere except the staff clock,
      // so an iPhone "Add to Home Screen" on a clock link opens that clock instead of the login page.
      manifest: false,

    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
