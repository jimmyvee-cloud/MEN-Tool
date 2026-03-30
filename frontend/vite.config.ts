import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mentool-logo.png", "favicon.svg"],
      manifest: {
        name: "MEN-Tool",
        short_name: "MEN-Tool",
        description: "Men's personal performance tracking",
        theme_color: "#c9a227",
        background_color: "#121212",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "mentool-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          { src: "mentool-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/v1/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-read",
              expiration: { maxEntries: 60, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    proxy: {
      "/v1": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
