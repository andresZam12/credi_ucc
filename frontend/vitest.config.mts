import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "..",
  cacheDir: "frontend/node_modules/.vite",
  test: {
    environment: "jsdom",
    include: ["frontend/src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["frontend/src/app/page.tsx"],
      reportsDirectory: "frontend/coverage",
    },
  },
});
