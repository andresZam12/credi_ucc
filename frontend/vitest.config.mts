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
      include: ["frontend/src/app/page.tsx", "frontend/src/lib/**/*.ts"],
      exclude: ["frontend/src/**/*.test.{ts,tsx}"],
      reportsDirectory: "frontend/coverage",
    },
  },
});
