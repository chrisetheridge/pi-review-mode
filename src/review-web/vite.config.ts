import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  root: "src/review-web",
  base: "./",
  build: {
    outDir: "../../dist/review-web",
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
