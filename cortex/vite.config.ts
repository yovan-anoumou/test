import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "CORTEX — Entraînement cognitif ciblé",
        short_name: "CORTEX",
        description:
          "Entraînement ciblé pour le TAGE 2, l'anglais, la culture générale et le raisonnement.",
        theme_color: "#111318",
        background_color: "#111318",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /\/questions\/.*\.json$/,
            handler: "CacheFirst",
            options: { cacheName: "cortex-questions" },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
