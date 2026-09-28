import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

    const created = await admin.auth.admin.createUser({
      email: `h5p-sec-${Date.now()}@example.com`,
      password: "SPEC005-test-password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Auth fixture was not created");
    createdAuthUsers.push(created.data.user.id);

    const signIn = await authenticated.auth.signInWithPassword({
      email: `h5p-sec-${Date.now()}@example.com`,
      password: "SPEC005-test-password-123!",
    });
    if (signIn.error) throw signIn.error;

    const provision = await admin.rpc("pfy_provision_identity", {
      requested_email: `h5p-sec-${Date.now()}@example.com`,
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
