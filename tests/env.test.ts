import { describe, expect, it } from "vitest";

import { getEnv, hasValidEnv } from "@/lib/env";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
};

describe("application configuration", () => {
  it("accepts the documented public Supabase configuration", () => {
    expect(getEnv(validEnv)).toEqual(validEnv);
    expect(hasValidEnv(validEnv)).toBe(true);
  });

  it("rejects missing or invalid configuration", () => {
    expect(hasValidEnv({})).toBe(false);
    expect(() => getEnv({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      "Invalid application configuration",
    );
  });
});
