import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/* The sample data exists only for the parity build, which compares the app with the approved prototype.
   Every other build swaps both seed files for empty states, so no sample row can reach a real visitor. */
function noSampleData(enabled) {
  const swap = {
    [fileURLToPath(new URL("./src/apps/creator/data/seed.js", import.meta.url))]: fileURLToPath(new URL("./src/apps/creator/data/empty.js", import.meta.url)),
    [fileURLToPath(new URL("./src/apps/brand/seed.js", import.meta.url))]: fileURLToPath(new URL("./src/apps/brand/empty.js", import.meta.url)),
  };
  const norm = (p) => p.replace(/\\/g, "/").toLowerCase();
  const table = new Map(Object.entries(swap).map(([k, v]) => [norm(k), v]));
  return {
    name: "linkloom-no-sample-data",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!enabled || !/seed(\.js)?$/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      const to = r && table.get(norm(r.id));
      return to ?? null;
    },
  };
}

/* The dashboards and the sign-in page call the API as soon as their script runs. Opening the connection while the
   script is still downloading takes the DNS and TLS setup off that first request. */
function apiPreconnect(origin) {
  return {
    name: "linkloom-api-preconnect",
    transformIndexHtml(_html, ctx) {
      if (!origin || /(^|\/)index\.html$/.test(ctx.filename.replace(/\\/g, "/"))) return;
      return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head" }];
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const parity = !!(env.VITE_TEST_HOOKS || process.env.VITE_TEST_HOOKS);
  const apiOrigin = (env.VITE_API_BASE_URL || "https://collab-api-ewju.onrender.com").replace(/\/+$/, "");
  const isDev = command === "serve";
  return {
    base: "./",
    plugins: [
      react(),
      noSampleData(!parity),
      /* In dev the proxy handles the connection, so no preconnect needed. */
      apiPreconnect(isDev || parity ? "" : apiOrigin),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    /* Proxy /v1/ to the backend in dev so the browser sees same-origin requests — no CORS. */
    server: {
      proxy: {
        "/v1": { target: apiOrigin, changeOrigin: true },
      },
    },
    build: {
      target: "es2022",
      cssTarget: "chrome120",
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: {
          landing: fileURLToPath(new URL("./index.html", import.meta.url)),
          app: fileURLToPath(new URL("./app.html", import.meta.url)),
          brand: fileURLToPath(new URL("./brand.html", import.meta.url)),
          signin: fileURLToPath(new URL("./signin.html", import.meta.url)),
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler") || id.includes("react-is")) return "react";
            if (id.includes("/gsap/")) return "gsap";
            return "vendor";
          },
        },
      },
    },
  };
});
