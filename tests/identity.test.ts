import { describe, expect, it } from "vitest";

import { normalizeEmail } from "@/lib/identity/email";

describe("PFY identity email normalization", () => {
  it("normalizes representational case and surrounding whitespace", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("does not apply provider-specific alias rules", () => {
    expect(normalizeEmail("user.name+tag@gmail.com")).toBe("user.name+tag@gmail.com");
    expect(normalizeEmail("username@gmail.com")).not.toBe(normalizeEmail("user.name@gmail.com"));
  });
});
