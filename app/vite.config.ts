import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const themeModuleSources = [
  ["night-valley", "src/components/theme-modules/night-valley.ts"],
  ["editorial-paper", "src/components/EditorialPaperViews.tsx"],
  ["graphite-console", "src/components/GraphiteConsoleViews.tsx"],
  ["metro-pulse", "src/components/MetroPulseViews.tsx"],
  ["clutch-court", "src/components/ClutchCourtViews.tsx"],
  ["aurora-ocean", "src/components/AuroraOceanViews.tsx"],
  ["botanical-library", "src/components/BotanicalLibraryViews.tsx"],
] as const;

function themeModuleUrlsPlugin(): Plugin {
  return {
    name: "focused-moment-theme-module-urls",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname !== "/theme-module-urls.json") {
          next();
          return;
        }

        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify(Object.fromEntries(themeModuleSources.map(([themeId, source]) => [themeId, `/${source}`]))));
      });
    },
    generateBundle(_options, bundle) {
      const urls: Record<string, string> = {};
      for (const [themeId, source] of themeModuleSources) {
        const expectedFacade = resolve(projectRoot, source).replace(/\\/g, "/");
        const entry = Object.values(bundle).find((output) =>
          output.type === "chunk"
          && output.isDynamicEntry
          && output.facadeModuleId?.split("?")[0].replace(/\\/g, "/") === expectedFacade,
        );
        if (!entry || entry.type !== "chunk") {
          this.error(`Theme module output was not found for ${themeId}: ${source}`);
        }
        urls[themeId] = entry.fileName;
      }
      this.emitFile({
        type: "asset",
        fileName: "theme-module-urls.json",
        source: JSON.stringify(urls),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid(), themeModuleUrlsPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
