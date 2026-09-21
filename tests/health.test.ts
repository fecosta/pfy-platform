import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

describe("health endpoint", () => {
  it("does not expose configuration details when misconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "misconfigured", service: "pfy-web" });
  });
});
