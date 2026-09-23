import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Sert l'app sous /test/ pour un déploiement en GitHub Pages de projet
// (https://<user>.github.io/test/), et sous / pour le dev local / autres hébergeurs.
const base = process.env.DEPLOY_TARGET === "gh-pages" ? "/test/" : "/";

// https://vite.dev/config/
export default defineConfig({
  base,
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
        start_url: base,
        scope: base,
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
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: /\/questions\/.*\.json$/,
            handler: "CacheFirst",
            options: { cacheName: "cortex-questions" },
          },
          {
            urlPattern: /\/fiches\/.*\.json$/,
            handler: "CacheFirst",
            options: { cacheName: "cortex-fiches" },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
