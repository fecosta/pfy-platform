import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import { signRuntimeToken } from "./token";

export type ExercisePlaybackAuthorization =
  | { authorized: false; reason: string }
  | { authorized: true; lumiContentId: string; runtimeUrl: string };

function createServiceRoleClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, PFY_SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, PFY_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function authorizeExercisePlayback(
  pfyUserId: string,
  activityId: string,
  exerciseId: string,
): Promise<ExercisePlaybackAuthorization> {
  const supabase = createServiceRoleClient();

  // Verify the Activity exists, is published and is free (entitlement_required
  // remains fail-closed until SPEC-009).
  const activityResult = await supabase
    .from("activities")
    .select("id, access_policy, lifecycle")
    .eq("id", activityId)
    .eq("lifecycle", "published")
    .maybeSingle();

  if (activityResult.error || !activityResult.data) {
    return { authorized: false, reason: "activity-not-found-or-unpublished" };
  }
  if (activityResult.data.access_policy !== "free") {
    return { authorized: false, reason: "entitlement-required" };
  }

  // Verify the Exercise belongs to the Activity.
  const exerciseResult = await supabase
    .from("exercises")
    .select("id, activity_id")
    .eq("id", exerciseId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (exerciseResult.error || !exerciseResult.data) {
    return { authorized: false, reason: "exercise-not-in-activity" };
  }

  // Resolve the PFY Exercise UUID to the internal Lumi content identity.
  const mappingResult = await supabase
    .from("exercise_h5p_mappings")
    .select("lumi_content_id")
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  if (mappingResult.error || !mappingResult.data) {
    return { authorized: false, reason: "exercise-not-mapped" };
  }

  const { PFY_H5P_RUNTIME_SECRET, PFY_H5P_RUNTIME_URL } = getServerEnv();
  const lumiContentId = mappingResult.data.lumi_content_id;
  // SPEC-005 remediation: token exposure review. The token travels as a
  // query-string parameter (browser history, referrer headers to
  // same-origin content-file requests, access/monitoring logs on the
  // runtime service). Considered alternatives:
  //   - HTTP-only cookie scoped to the runtime origin: would require the
  //     runtime to run session/cookie infrastructure and CORS credential
  //     handling across the cross-origin PFY <-> runtime boundary ADR-001
  //     requires, which is a materially larger surface than SPEC-005 scope.
  //   - postMessage-based session handoff: H5P's iframe is a full page
  //     navigation (not a same-document embed we control script-side before
  //     load), so there is no point to intercept the initial request before
  //     the browser sends it.
  // Given the architecture (isolated runtime, no shared session state), a
  // short-lived, single-content-scoped, signed token is the narrowest
  // mechanism that still works with a plain <iframe src>. The 1-hour TTL
  // bounds how long a leaked URL remains useful; `Referrer-Policy:
  // strict-origin-when-cross-origin` (set on both the play and content-file
  // responses) prevents the token from being forwarded via Referer to a
  // third-party origin. A safer transport is not practical within SPEC-005's
  // "reuse existing content-access rules, don't build new auth
  // infrastructure" boundary; noted here rather than left silently unreviewed.
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

  const token = signRuntimeToken(
    { sub: pfyUserId, cid: lumiContentId, eid: exerciseId, act: activityId, exp },
    PFY_H5P_RUNTIME_SECRET,
  );

  const runtimeUrl = `${PFY_H5P_RUNTIME_URL}/h5p/play/${encodeURIComponent(lumiContentId)}?token=${encodeURIComponent(token)}`;

  return { authorized: true, lumiContentId, runtimeUrl };
}

export function buildRuntimeUrl(lumiContentId: string, token: string): string {
  const { PFY_H5P_RUNTIME_URL } = getServerEnv();
  return `${PFY_H5P_RUNTIME_URL}/h5p/play/${encodeURIComponent(lumiContentId)}?token=${encodeURIComponent(token)}`;
}
