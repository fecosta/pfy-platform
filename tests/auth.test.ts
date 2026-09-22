import { describe, expect, it } from "vitest";

import { callbackUrl, safeRedirectPath } from "@/lib/auth/redirects";

describe("authentication redirect policy", () => {
  it("accepts an internal path and preserves its query", () => {
    expect(safeRedirectPath("/protected?view=identity")).toBe("/protected?view=identity");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/protected");
    expect(safeRedirectPath("//evil.example")).toBe("/protected");
  });

  it("rejects malformed control-character values", () => {
    expect(safeRedirectPath("/protected\nSet-Cookie: attack=true")).toBe("/protected");
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });

  it("constructs a callback URL with a bounded next path", () => {
    expect(callbackUrl("http://127.0.0.1:3000", "https://evil.example")).toBe(
      "http://127.0.0.1:3000/auth/callback?next=%2Fprotected",
    );
  });
});
