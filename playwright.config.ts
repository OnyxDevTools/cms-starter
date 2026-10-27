// filename: playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    timezoneId: "America/Los_Angeles",
    baseURL: "http://127.0.0.1:3040",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command:
      "node --conditions=react-server --import tsx tests/fixture/preview.ts --production",
    url: "http://127.0.0.1:3040/api/health",
    reuseExistingServer: false,
    timeout: 180000,
  },
});
