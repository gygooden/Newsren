import { defineConfig, devices } from "@playwright/test";

// Run `npm run build:e2e` first (or `npm run test:e2e`, which does both).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4173/newsren/", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npx tsx scripts/serve.ts",
    url: "http://localhost:4173/newsren/",
    reuseExistingServer: true,
    env: { NEXT_PUBLIC_BASE_PATH: "/newsren" },
  },
});
