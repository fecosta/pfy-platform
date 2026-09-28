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
