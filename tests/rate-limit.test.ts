import { describe, expect, it } from "vitest";

import { createAuthRequestLimiter } from "@/lib/auth/rate-limit";

function request(ip: string): Request {
  return new Request("http://localhost/api/auth/request-link", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("Magic Link request abuse protection", () => {
  it("allows normal traffic and limits repeated requests for one email", () => {
    const limiter = createAuthRequestLimiter(() => 1_000);
    const attempts = Array.from({ length: 6 }, () =>
      limiter(request("192.0.2.1"), "known@example.com"),
    );

    expect(attempts.slice(0, 5).every((result) => result.allowed)).toBe(true);
    expect(attempts[5]).toEqual({ allowed: false });
  });

  it("protects unknown emails with the same generic limit", () => {
    const limiter = createAuthRequestLimiter(() => 1_000);
    const known = Array.from({ length: 6 }, () =>
      limiter(request("192.0.2.2"), "known@example.com"),
    );
    const unknown = Array.from({ length: 6 }, () =>
      limiter(request("192.0.2.3"), "unknown@example.com"),
    );

    expect(known[5]).toEqual({ allowed: false });
    expect(unknown[5]).toEqual({ allowed: false });
    expect(known[5]).toEqual(unknown[5]);
  });

  it("expires buckets without retaining raw identifiers", () => {
    let now = 1_000;
    const limiter = createAuthRequestLimiter(() => now);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter(request("192.0.2.4"), "email@example.com").allowed).toBe(true);
    }
    expect(limiter(request("192.0.2.4"), "email@example.com").allowed).toBe(false);
    now += 10 * 60 * 1000;
    expect(limiter(request("192.0.2.4"), "email@example.com").allowed).toBe(true);
  });
});
