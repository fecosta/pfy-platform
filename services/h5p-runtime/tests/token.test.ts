import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { signRuntimeToken, verifyRuntimeToken, requireAdminSecret } from "../src/token.js";

describe("H5P runtime token", () => {
  const secret = "a-very-long-secret-that-is-at-least-32-characters";

  it("round-trips and verifies claims", () => {
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
    assert.ok(claims);
    assert.equal(claims.sub, "user-1");
    assert.equal(claims.cid, "lumi-123");
    assert.equal(claims.eid, "exercise-456");
    assert.equal(claims.act, "activity-789");
  });

  it("rejects tokens signed with a different secret", () => {
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

    assert.equal(verifyRuntimeToken(token, "different-secret-at-least-32-characters"), null);
  });

  it("rejects expired tokens", () => {
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

    assert.equal(verifyRuntimeToken(token, secret), null);
  });

  // SPEC-005 remediation regression: attacker-controlled malformed tokens
  // must fail closed (return null) and must never throw.
  it("never throws and returns null for malformed tokens (Finding 2)", () => {
    const validHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "PFY-H5P-RT" })).toString(
      "base64url",
    );
    const validPayload = Buffer.from(
      JSON.stringify({
        sub: "u",
        cid: "c",
        eid: "e",
        act: "a",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");

    const cases = [
      "",
      "not-a-token",
      "a.b",
      `${validHeader}.${validPayload}.aaaa`, // too-short signature
      `${validHeader}.${validPayload}.${"a".repeat(500)}`, // too-long signature
      `${validHeader}.${validPayload}.!!!not-base64!!!`, // malformed base64url
      `${validHeader}.${validPayload}`, // missing segments
      "..",
      `!!!.${validPayload}.${"a".repeat(43)}`, // malformed base64url header
      `${validHeader}.${Buffer.from("not-json{").toString("base64url")}.${"a".repeat(43)}`, // malformed JSON payload
      `${Buffer.from(JSON.stringify({ alg: "none", typ: "PFY-H5P-RT" })).toString("base64url")}.${validPayload}.${"a".repeat(43)}`, // wrong algorithm
      `${validHeader}.${Buffer.from(JSON.stringify(["nope"])).toString("base64url")}.${"a".repeat(43)}`, // invalid payload type
      `${validHeader}.${Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url")}.${"a".repeat(43)}`, // missing required claims
    ];

    for (const token of cases) {
      assert.doesNotThrow(() => verifyRuntimeToken(token, secret));
      assert.equal(verifyRuntimeToken(token, secret), null);
    }
  });

  it("compares admin secrets in constant time and rejects mismatched length", () => {
    const config = { PFY_H5P_ADMIN_SECRET: "a-32-char-minimum-admin-secret!!" };
    assert.equal(requireAdminSecret("wrong-length", config), false);
    assert.equal(requireAdminSecret(undefined, config), false);
    assert.equal(requireAdminSecret(config.PFY_H5P_ADMIN_SECRET, config), true);
  });
});
