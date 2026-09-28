import { defineConfig, devices } from "@playwright/test";
const production = process.env.SABENCA_E2E_PRODUCTION === "1";
const port = production ? 3100 : 3000;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: production
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : "npm run dev -- --hostname 127.0.0.1",
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI && !production,
    timeout: 120000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
