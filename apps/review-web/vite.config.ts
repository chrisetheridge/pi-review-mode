import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss(), classicScriptForGlimpse()],
  root: ".",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "../../dist/review-web",
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: false,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        inlineDynamicImports: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});

function classicScriptForGlimpse() {
  return {
    name: "classic-script-for-glimpse",
    transformIndexHtml(html: string) {
      return html.replace(
        /<script type="module" crossorigin src="(\.\/assets\/index\.js)"><\/script>/,
        '<script defer src="$1"></script>'
      );
    }
  };
}
