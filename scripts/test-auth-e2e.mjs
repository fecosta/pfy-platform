import { spawnSync } from "node:child_process";

const required = [
  "PFY_SUPABASE_URL",
  "PFY_SUPABASE_ANON_KEY",
  "PFY_SUPABASE_SERVICE_ROLE_KEY",
  "PFY_SUPABASE_INBUCKET_URL",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Phase 2 auth E2E requires: ${missing.join(", ")}`);
  process.exit(1);
}

const result = spawnSync("npx", ["playwright", "test", "tests/e2e/auth.spec.ts"], {
  env: { ...process.env, PFY_AUTH_E2E: "1" },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
