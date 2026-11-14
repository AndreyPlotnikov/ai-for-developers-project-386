import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      name: "API",
      command: "pnpm --dir ../backend test:e2e-server",
      wait: { stdout: /E2E API: (?<e2e_api_url>http:\/\/127\.0\.0\.1:\d+)/ },
    },
    {
      name: "Vite",
      command: "pnpm exec vite --host 127.0.0.1 --port 0 --strictPort",
      wait: { stdout: /Local:\s+(?<e2e_base_url>http:\/\/127\.0\.0\.1:\d+)/ },
    },
  ],
});
