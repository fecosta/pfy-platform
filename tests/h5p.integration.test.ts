import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authorizeExercisePlayback } from "@/lib/h5p/adapter";
import { verifyRuntimeToken } from "@/lib/h5p/token";

const integrationEnabled = process.env.PFY_SUPABASE_INTEGRATION === "1";

describe.skipIf(!integrationEnabled)("SPEC-005 H5P mapping security against local Supabase", () => {
  let admin: SupabaseClient;
  let anonymous: SupabaseClient;
  let authenticated: SupabaseClient;
  const activityIds: string[] = [];
  const createdAuthUsers: string[] = [];
  const createdPfyUsers: string[] = [];

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for integration tests`);
    return value;
  }

  beforeAll(async () => {
    const url = requireEnv("PFY_SUPABASE_URL");
    admin = createClient(url, requireEnv("PFY_SUPABASE_SERVICE_ROLE_KEY"));
    anonymous = createClient(url, requireEnv("PFY_SUPABASE_ANON_KEY"));
    authenticated = createClient(url, requireEnv("PFY_SUPABASE_ANON_KEY"));

    // SPEC-005 remediation: the previous implementation called `Date.now()`
    // three separate times to build the fixture email — once for createUser,
    // once for signInWithPassword and once for pfy_provision_identity — so
    // the sign-in email never matched the created auth user and this
    // integration test could never pass against a real Supabase instance.
    // This is exactly the class of gap the independent review flagged
    // ("Supabase integration was not run").
    const fixtureEmail = `h5p-sec-${Date.now()}@example.com`;

    const created = await admin.auth.admin.createUser({
      email: fixtureEmail,
      password: "SPEC005-test-password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Auth fixture was not created");
    createdAuthUsers.push(created.data.user.id);

    const signIn = await authenticated.auth.signInWithPassword({
      email: fixtureEmail,
      password: "SPEC005-test-password-123!",
    });
    if (signIn.error) throw signIn.error;

    const provision = await admin.rpc("pfy_provision_identity", {
      requested_email: fixtureEmail,
      requested_first_name: "H5P",
      requested_last_name: "Security",
      requested_auth_user_id: created.data.user.id,
    });
    if (provision.error || !provision.data)
      throw provision.error ?? new Error("PFY fixture was not provisioned");
    createdPfyUsers.push(provision.data);
  });

  afterAll(async () => {
    for (const id of createdAuthUsers) await admin.auth.admin.deleteUser(id);
    if (activityIds.length > 0) await admin.from("activities").delete().in("id", activityIds);
    if (createdPfyUsers.length > 0)
      await admin
        .from("users")
        .delete()
        .in("id", [...new Set(createdPfyUsers)]);
  });

  // SPEC-005 remediation (Finding 5 - PFY authorization). Exercises the real
  // authorizeExercisePlayback adapter end-to-end against local Supabase, not
  // just direct table-level RLS. Requires NEXT_PUBLIC_SUPABASE_URL,
  // PFY_H5P_RUNTIME_SECRET and PFY_H5P_RUNTIME_URL in addition to the
  // PFY_SUPABASE_* variables already required above.
  describe("authorizeExercisePlayback adapter", () => {
    it("fails closed for an Exercise that does not belong to the requested Activity", async () => {
      const activityA = await admin
        .from("activities")
        .insert({ title: `Adapter A ${Date.now()}`, lifecycle: "published", access_policy: "free" })
        .select("id")
        .single();
      const activityB = await admin
        .from("activities")
        .insert({ title: `Adapter B ${Date.now()}`, lifecycle: "published", access_policy: "free" })
        .select("id")
        .single();
      if (!activityA.data || !activityB.data) throw new Error("Fixtures were not created");
      activityIds.push(activityA.data.id, activityB.data.id);

      const exerciseInB = await admin
        .from("exercises")
        .insert({ activity_id: activityB.data.id, title: "Exercise in B" })
        .select("id")
        .single();
      if (!exerciseInB.data) throw new Error("Exercise fixture was not created");

      // Request Activity A but pass an Exercise that actually belongs to B —
      // this is exactly the "cannot substitute another content id" class of
      // attack the SPEC requires to fail closed.
      const result = await authorizeExercisePlayback(
        "some-user-id",
        activityA.data.id,
        exerciseInB.data.id,
      );
      expect(result.authorized).toBe(false);
      if (!result.authorized) expect(result.reason).toBe("exercise-not-in-activity");
    });

    it("fails closed for entitlement_required content until SPEC-009 defines entitlement resolution", async () => {
      const activity = await admin
        .from("activities")
        .insert({
          title: `Adapter entitlement ${Date.now()}`,
          lifecycle: "published",
          access_policy: "entitlement_required",
        })
        .select("id")
        .single();
      if (!activity.data) throw new Error("Activity fixture was not created");
      activityIds.push(activity.data.id);

      const exercise = await admin
        .from("exercises")
        .insert({ activity_id: activity.data.id, title: "Entitlement Exercise" })
        .select("id")
        .single();
      if (!exercise.data) throw new Error("Exercise fixture was not created");

      const result = await authorizeExercisePlayback(
        "some-user-id",
        activity.data.id,
        exercise.data.id,
      );
      expect(result.authorized).toBe(false);
      if (!result.authorized) expect(result.reason).toBe("entitlement-required");
    });

    it("fails closed for an unpublished Activity", async () => {
      const activity = await admin
        .from("activities")
        .insert({ title: `Adapter draft ${Date.now()}`, lifecycle: "draft", access_policy: "free" })
        .select("id")
        .single();
      if (!activity.data) throw new Error("Activity fixture was not created");
      activityIds.push(activity.data.id);

      const exercise = await admin
        .from("exercises")
        .insert({ activity_id: activity.data.id, title: "Draft Exercise" })
        .select("id")
        .single();
      if (!exercise.data) throw new Error("Exercise fixture was not created");

      const result = await authorizeExercisePlayback(
        "some-user-id",
        activity.data.id,
        exercise.data.id,
      );
      expect(result.authorized).toBe(false);
      if (!result.authorized) expect(result.reason).toBe("activity-not-found-or-unpublished");
    });

    it("fails closed for an Exercise with no H5P mapping", async () => {
      const activity = await admin
        .from("activities")
        .insert({
          title: `Adapter unmapped ${Date.now()}`,
          lifecycle: "published",
          access_policy: "free",
        })
        .select("id")
        .single();
      if (!activity.data) throw new Error("Activity fixture was not created");
      activityIds.push(activity.data.id);

      const exercise = await admin
        .from("exercises")
        .insert({ activity_id: activity.data.id, title: "Unmapped Exercise" })
        .select("id")
        .single();
      if (!exercise.data) throw new Error("Exercise fixture was not created");

      const result = await authorizeExercisePlayback(
        "some-user-id",
        activity.data.id,
        exercise.data.id,
      );
      expect(result.authorized).toBe(false);
      if (!result.authorized) expect(result.reason).toBe("exercise-not-mapped");
    });

    it("issues a valid, correctly-scoped runtime token for an authorized Exercise", async () => {
      const activity = await admin
        .from("activities")
        .insert({
          title: `Adapter happy path ${Date.now()}`,
          lifecycle: "published",
          access_policy: "free",
        })
        .select("id")
        .single();
      if (!activity.data) throw new Error("Activity fixture was not created");
      activityIds.push(activity.data.id);

      const exercise = await admin
        .from("exercises")
        .insert({ activity_id: activity.data.id, title: "Mapped Exercise" })
        .select("id")
        .single();
      if (!exercise.data) throw new Error("Exercise fixture was not created");

      const lumiContentId = `lumi-happy-${Date.now()}`;
      const mapping = await admin
        .from("exercise_h5p_mappings")
        .insert({ exercise_id: exercise.data.id, lumi_content_id: lumiContentId });
      expect(mapping.error).toBeNull();

      const result = await authorizeExercisePlayback("user-42", activity.data.id, exercise.data.id);
      expect(result.authorized).toBe(true);
      if (!result.authorized) return;

      expect(result.lumiContentId).toBe(lumiContentId);
      // The Lumi content id must never be exposed as a bare query parameter
      // separate from the signed token; the runtime URL's authorization must
      // come entirely from the token, not from client-suppliable claims.
      const url = new URL(result.runtimeUrl);
      const token = url.searchParams.get("token");
      expect(token).toBeTruthy();
      const claims = verifyRuntimeToken(token!, requireEnv("PFY_H5P_RUNTIME_SECRET"));
      expect(claims).not.toBeNull();
      expect(claims?.cid).toBe(lumiContentId);
      expect(claims?.eid).toBe(exercise.data.id);
      expect(claims?.act).toBe(activity.data.id);
      expect(claims?.sub).toBe("user-42");
    });
  });

  it("keeps exercise-to-Lumi mappings inaccessible to ordinary users", async () => {
    const activity = await admin
      .from("activities")
      .insert({ title: `H5P mapping ${Date.now()}`, lifecycle: "published", access_policy: "free" })
      .select("id")
      .single();
    expect(activity.error).toBeNull();
    if (!activity.data) throw new Error("Activity was not created");
    activityIds.push(activity.data.id);

    const exercise = await admin
      .from("exercises")
      .insert({ activity_id: activity.data.id, title: "H5P Exercise" })
      .select("id")
      .single();
    expect(exercise.error).toBeNull();
    if (!exercise.data) throw new Error("Exercise was not created");

    const mapping = await admin.from("exercise_h5p_mappings").insert({
      exercise_id: exercise.data.id,
      lumi_content_id: `lumi-${Date.now()}`,
    });
    expect(mapping.error).toBeNull();

    const anonymousRead = await anonymous
      .from("exercise_h5p_mappings")
      .select("*")
      .eq("exercise_id", exercise.data.id);
    expect(anonymousRead.error).toBeTruthy();

    const authenticatedRead = await authenticated
      .from("exercise_h5p_mappings")
      .select("*")
      .eq("exercise_id", exercise.data.id);
    expect(authenticatedRead.error).toBeTruthy();

    const serviceRoleRead = await admin
      .from("exercise_h5p_mappings")
      .select("lumi_content_id")
      .eq("exercise_id", exercise.data.id)
      .maybeSingle();
    expect(serviceRoleRead.error).toBeNull();
    expect(serviceRoleRead.data?.lumi_content_id).toContain("lumi-");
  });
});
