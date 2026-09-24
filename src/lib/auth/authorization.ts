import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentUser, type CurrentUserResult } from "@/lib/auth/current-user";
import type { CanonicalPfyUser } from "@/lib/identity/server";

export type AuthorizationContext = {
  pfyUserId: string;
  authSubjectId: string;
};

export type AuthorizationAction = "profile.read" | "profile.update";

export type ProfileResource = {
  type: "profile";
  ownerPfyUserId: string;
};

export type AuthorizationDenialReason =
  "missing-context" | "missing-resource" | "unknown-action" | "not-owner" | "policy-error";

export type AuthorizationDecision =
  { allowed: true } | { allowed: false; reason: AuthorizationDenialReason };

export function authorizationContextFromUser(user: CanonicalPfyUser): AuthorizationContext {
  return { pfyUserId: user.id, authSubjectId: user.authUserId };
}

export function authorize(
  context: AuthorizationContext | null | undefined,
  action: string,
  resource: ProfileResource | null | undefined,
  evaluateOwner: (context: AuthorizationContext, ownerPfyUserId: string) => boolean = (
    authorizationContext,
    ownerPfyUserId,
  ) => authorizationContext.pfyUserId === ownerPfyUserId,
): AuthorizationDecision {
  if (!context?.pfyUserId || !context.authSubjectId) {
    return { allowed: false, reason: "missing-context" };
  }
  if (!resource || resource.type !== "profile" || !resource.ownerPfyUserId) {
    return { allowed: false, reason: "missing-resource" };
  }
  if (action !== "profile.read" && action !== "profile.update") {
    return { allowed: false, reason: "unknown-action" };
  }
  try {
    return evaluateOwner(context, resource.ownerPfyUserId)
      ? { allowed: true }
      : { allowed: false, reason: "not-owner" };
  } catch {
    return { allowed: false, reason: "policy-error" };
  }
}

export type AuthorizedProfileResult =
  | { status: "unauthenticated" }
  | { status: "missing-domain-identity" }
  | { status: "inconsistent-identity" }
  | { status: "unauthorized"; reason: AuthorizationDenialReason }
  | { status: "resource-error" }
  | { status: "allowed"; profile: { first_name: string; last_name: string } };

function currentUserFailureStatus(
  result: CurrentUserResult,
): "unauthenticated" | "missing-domain-identity" | "inconsistent-identity" {
  if (result.status === "unauthenticated") return "unauthenticated";
  if (result.status === "missing-domain-identity") return "missing-domain-identity";
  return "inconsistent-identity";
}

export async function readOwnProfile(): Promise<AuthorizedProfileResult> {
  const currentUser = await resolveCurrentUser();
  if (currentUser.status !== "resolved") {
    return { status: currentUserFailureStatus(currentUser) };
  }

  const context = authorizationContextFromUser(currentUser.user);
  const resource = { type: "profile", ownerPfyUserId: currentUser.user.id } as const;
  const decision = authorize(context, "profile.read", resource);
  if (!decision.allowed) return { status: "unauthorized", reason: decision.reason };

  return readAuthorizedProfile(await createSupabaseServerClient(), context, resource);
}

export async function readAuthorizedProfile(
  supabase: SupabaseClient,
  context: AuthorizationContext,
  resource: ProfileResource,
): Promise<AuthorizedProfileResult> {
  const decision = authorize(context, "profile.read", resource);
  if (!decision.allowed) return { status: "unauthorized", reason: decision.reason };

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("user_id", resource.ownerPfyUserId)
    .maybeSingle();

  if (error || !data) return { status: "resource-error" };
  return { status: "allowed", profile: data };
}
