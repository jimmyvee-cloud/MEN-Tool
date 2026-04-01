import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo-root GOOGLE_OAUTH_CLIENT_ID from .env* (same merge order as Vite: later files override). */
function readGoogleOAuthClientIdFromDir(dir: string, mode: string): string {
  const names = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  let value = "";
  for (const name of names) {
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (!t.startsWith("GOOGLE_OAUTH_CLIENT_ID")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) value = v;
    }
  }
  return value;
}

/**
 * In development, never call the browser at localhost:8818 directly — use same-origin /v1 + Vite proxy.
 * Stale .env, Docker, or cached bundles often bake that URL and break login from 127.0.0.1/LAN.
 */
function effectiveViteApiBaseUrl(mode: string, feEnv: Record<string, string>): string {
  const raw = (feEnv.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "";
  const base = raw.replace(/\/v1\/?$/i, "").replace(/\/+$/, "");
  if (
    mode === "development" &&
    /^https?:\/\/(localhost|127\.0\.0\.1):8818$/i.test(base)
  ) {
    return "";
  }
  return raw;
}

export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "..");
  const feEnv = loadEnv(mode, __dirname, "VITE");
  const rootGoogle = loadEnv(mode, repoRoot, "GOOGLE_OAUTH");
  const googleClientId = (
    feEnv.VITE_GOOGLE_CLIENT_ID ||
    rootGoogle.GOOGLE_OAUTH_CLIENT_ID ||
    readGoogleOAuthClientIdFromDir(repoRoot, mode) ||
    ""
  ).trim();
  const viteApiBaseUrl = effectiveViteApiBaseUrl(mode, feEnv);

  return {
    define: {
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(googleClientId),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(viteApiBaseUrl),
    },
    plugins: [
      react(),
      VitePWA({
        devOptions: { enabled: false },
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
          // Do not route API through the service worker — breaks auth and confuses offline handling.
        },
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      proxy: {
        "/v1": {
          target:
            process.env.VITE_PROXY_API_TARGET || "http://127.0.0.1:8818",
          changeOrigin: true,
        },
      },
    },
  };
});
