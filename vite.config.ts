import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

/* The sample data exists only for the parity build, which compares the app with the approved prototype.
   Every other build swaps both seed files for empty states, so no sample row can reach a real visitor. */
function noSampleData(enabled: boolean): Plugin {
  const swap: Record<string, string> = {
    [fileURLToPath(new URL("./src/apps/creator/data/seed.ts", import.meta.url))]: fileURLToPath(new URL("./src/apps/creator/data/empty.ts", import.meta.url)),
    [fileURLToPath(new URL("./src/apps/brand/seed.ts", import.meta.url))]: fileURLToPath(new URL("./src/apps/brand/empty.ts", import.meta.url)),
  };
  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
  const table = new Map(Object.entries(swap).map(([k, v]) => [norm(k), v]));
  return {
    name: "linkloom-no-sample-data",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!enabled || !/seed(\.ts)?$/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      const to = r && table.get(norm(r.id));
      return to ?? null;
    },
  };
}

/* The dashboards and the sign-in page call the API as soon as their script runs. Opening the connection while the
   script is still downloading takes the DNS and TLS setup off that first request. */
function apiPreconnect(origin: string): Plugin {
  return {
    name: "linkloom-api-preconnect",
    transformIndexHtml(_html, ctx) {
      if (!origin || /(^|\/)index\.html$/.test(ctx.filename.replace(/\\/g, "/"))) return;
      return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head" }]; // after the Google tag, which Google wants first in <head>
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const parity = !!(env.VITE_TEST_HOOKS || process.env.VITE_TEST_HOOKS);
  return {
    base: "./",
    plugins: [
      noSampleData(!parity),
      apiPreconnect(parity ? "" : (env.VITE_API_BASE_URL || "https://collab-api-ewju.onrender.com").replace(/\/+$/, "")),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: {
      target: "es2022",
      cssTarget: "chrome120",
      sourcemap: true,
      /* Two documents on purpose: the landing page and the dashboard define the same global classes differently. */
      rollupOptions: {
        input: {
          landing: fileURLToPath(new URL("./index.html", import.meta.url)),
          app: fileURLToPath(new URL("./app.html", import.meta.url)),
          brand: fileURLToPath(new URL("./brand.html", import.meta.url)),
          signin: fileURLToPath(new URL("./signin.html", import.meta.url)),
        },
      },
    },
  };
});
