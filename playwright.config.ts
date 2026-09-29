import { defineConfig, devices } from "@playwright/test";

// SPEC-005 remediation (Finding 5): the H5P runtime service is started
// alongside the Next.js app for tests/e2e/h5p-playback.spec.ts, which
// exercises real cross-origin playback. It is only booted when the required
// runtime secrets are present in the environment so the existing E2E suite
// keeps working without them.
const h5pRuntimeEnabled = Boolean(
  process.env.PFY_H5P_RUNTIME_SECRET && process.env.PFY_H5P_ADMIN_SECRET,
);

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
    ...(h5pRuntimeEnabled
      ? [
          {
            command: "npm run dev",
            cwd: "./services/h5p-runtime",
            url: "http://127.0.0.1:3001/health",
            reuseExistingServer: true,
            env: {
              PORT: "3001",
              PFY_H5P_RUNTIME_SECRET: process.env.PFY_H5P_RUNTIME_SECRET!,
              PFY_H5P_ADMIN_SECRET: process.env.PFY_H5P_ADMIN_SECRET!,
              PFY_H5P_STORAGE_PATH: process.env.PFY_H5P_STORAGE_PATH ?? "./storage",
            },
          },
        ]
      : []),
  ],
});
