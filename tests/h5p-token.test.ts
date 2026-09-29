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

  // SPEC-005 remediation regression: every case below is attacker-controlled
  // input that must fail closed (return null) and must never throw.
  describe("malformed-token security regression (Finding 2)", () => {
    const validPayload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        cid: "lumi-123",
        eid: "exercise-456",
        act: "activity-789",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const validHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "PFY-H5P-RT" })).toString(
      "base64url",
    );

    const cases: Array<[string, string]> = [
      ["empty string", ""],
      ["too-short signature", `${validHeader}.${validPayload}.aaaa`],
      ["too-long signature", `${validHeader}.${validPayload}.${"a".repeat(500)}`],
      ["malformed base64url signature", `${validHeader}.${validPayload}.!!!not-base64!!!`],
      ["missing segments", `${validHeader}.${validPayload}`],
      ["only dots", ".."],
      ["malformed base64url header", `!!!.${validPayload}.${"a".repeat(43)}`],
      [
        "malformed JSON payload",
        `${validHeader}.${Buffer.from("not-json{").toString("base64url")}.${"a".repeat(43)}`,
      ],
      [
        "invalid header shape",
        `${Buffer.from(JSON.stringify(["not", "an", "object"])).toString("base64url")}.${validPayload}.${"a".repeat(43)}`,
      ],
      [
        "wrong algorithm",
        `${Buffer.from(JSON.stringify({ alg: "none", typ: "PFY-H5P-RT" })).toString("base64url")}.${validPayload}.${"a".repeat(43)}`,
      ],
      [
        "invalid payload type (array)",
        `${validHeader}.${Buffer.from(JSON.stringify(["nope"])).toString("base64url")}.${"a".repeat(43)}`,
      ],
      [
        "missing required claims",
        `${validHeader}.${Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url")}.${"a".repeat(43)}`,
      ],
    ];

    for (const [name, token] of cases) {
      it(`does not throw and returns null for: ${name}`, () => {
        expect(() => verifyRuntimeToken(token, secret)).not.toThrow();
        expect(verifyRuntimeToken(token, secret)).toBeNull();
      });
    }

    it("rejects a tampered payload even with a syntactically valid signature length", () => {
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
      const [header, , signature] = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: "user-1",
          cid: "someone-elses-content",
          eid: "exercise-456",
          act: "activity-789",
          exp: Math.floor(Date.now() / 1000) + 300,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString("base64url");
      expect(verifyRuntimeToken(`${header}.${tamperedPayload}.${signature}`, secret)).toBeNull();
    });
  });
});
