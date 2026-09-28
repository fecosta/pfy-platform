import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { signRuntimeToken, verifyRuntimeToken } from "../src/token.js";

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
});
