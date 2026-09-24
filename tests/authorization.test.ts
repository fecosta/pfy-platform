import { describe, expect, it } from "vitest";

import {
  authorize,
  authorizationContextFromUser,
  type AuthorizationContext,
} from "@/lib/auth/authorization";

const context: AuthorizationContext = {
  pfyUserId: "user-a",
  authSubjectId: "auth-a",
};
const ownProfile = { type: "profile" as const, ownerPfyUserId: "user-a" };

describe("authorization foundation", () => {
  it("constructs context from the canonical server identity", () => {
    expect(
      authorizationContextFromUser({
        id: "user-a",
        authUserId: "auth-a",
        profile: { first_name: "A", last_name: "User" },
      }),
    ).toEqual(context);
  });

  it("allows the authenticated user to read their own profile", () => {
    expect(authorize(context, "profile.read", ownProfile)).toEqual({ allowed: true });
  });

  it("denies unauthenticated, unresolved and incomplete contexts", () => {
    expect(authorize(null, "profile.read", ownProfile)).toEqual({
      allowed: false,
      reason: "missing-context",
    });
    expect(
      authorize({ pfyUserId: "", authSubjectId: "auth-a" }, "profile.read", ownProfile),
    ).toEqual({ allowed: false, reason: "missing-context" });
    expect(authorize(context, "profile.read", null)).toEqual({
      allowed: false,
      reason: "missing-resource",
    });
  });

  it("denies cross-user access and unknown actions", () => {
    expect(authorize(context, "profile.read", { ...ownProfile, ownerPfyUserId: "user-b" })).toEqual(
      {
        allowed: false,
        reason: "not-owner",
      },
    );
    expect(authorize(context, "admin.delete", ownProfile)).toEqual({
      allowed: false,
      reason: "unknown-action",
    });
  });

  it("denies when a policy evaluator fails", () => {
    expect(
      authorize(context, "profile.read", ownProfile, () => {
        throw new Error("policy lookup failed");
      }),
    ).toEqual({ allowed: false, reason: "policy-error" });
  });

  it("does not use browser-shaped role or identity claims", () => {
    const forged = {
      ...context,
      pfyUserId: "user-b",
      role: "admin",
      requestedUserId: "user-a",
    } as AuthorizationContext & { role: string; requestedUserId: string };

    expect(authorize(forged, "profile.read", ownProfile)).toEqual({
      allowed: false,
      reason: "not-owner",
    });
  });
});
