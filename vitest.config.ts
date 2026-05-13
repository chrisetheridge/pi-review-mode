import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/review-web/src")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "test/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "apps/review-web/**/*.test.ts",
      "apps/review-web/**/*.test.tsx"
    ],
    restoreMocks: true,
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
