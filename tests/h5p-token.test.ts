import { describe, expect, it } from "vitest";

import { signRuntimeToken, verifyRuntimeToken } from "@/lib/h5p/token";

describe("H5P runtime token", () => {
  const secret = "a-very-long-secret-that-is-at-least-32-characters";

  it("round-trips a signed token and extracts claims", () => {
    const token = signRuntimeToken(
      {
        sub: "user-1",
        cid: "lumi-123",
        eid: "exercise-456",
        act: "activity-789",
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      secret,
    );

    const claims = verifyRuntimeToken(token, secret);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("user-1");
    expect(claims?.cid).toBe("lumi-123");
    expect(claims?.eid).toBe("exercise-456");
    expect(claims?.act).toBe("activity-789");
    expect(claims?.iat).toBeGreaterThan(0);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signRuntimeToken(
      {
        sub: "user-1",
        cid: "lumi-123",
        eid: "exercise-456",
        act: "activity-789",
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      secret,
    );

    expect(verifyRuntimeToken(token, "different-secret-at-least-32-characters")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signRuntimeToken(
      {
        sub: "user-1",
        cid: "lumi-123",
        eid: "exercise-456",
        act: "activity-789",
        exp: Math.floor(Date.now() / 1000) - 1,
      },
      secret,
    );

    expect(verifyRuntimeToken(token, secret)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyRuntimeToken("not-a-token", secret)).toBeNull();
    expect(verifyRuntimeToken("a.b", secret)).toBeNull();
  });
});
