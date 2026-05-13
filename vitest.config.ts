import { defineConfig } from "vitest/config";

export default defineConfig({
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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
