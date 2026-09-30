import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.PFY_SUPABASE_INTEGRATION === "1";

describe.skipIf(!enabled)("SPEC-006 attempt persistence against local Supabase", () => {
  let admin: SupabaseClient;
  let learnerA: SupabaseClient;
  let learnerB: SupabaseClient;
  const authIds: string[] = [];
  const pfyUserIds: string[] = [];
  const activityIds: string[] = [];

  const env = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for integration tests`);
    return value;
  };

  async function createLearner(label: string) {
    const email = `spec006-${label}-${Date.now()}-${Math.random()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password: "SPEC006-test-password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("auth fixture failed");
    authIds.push(created.data.user.id);
    const client = createClient(env("PFY_SUPABASE_URL"), env("PFY_SUPABASE_ANON_KEY"));
    const signedIn = await client.auth.signInWithPassword({
      email,
      password: "SPEC006-test-password-123!",
    });
    if (signedIn.error) throw signedIn.error;
    const provisioned = await admin.rpc("pfy_provision_identity", {
      requested_email: email,
      requested_first_name: "Spec",
      requested_last_name: "006",
      requested_auth_user_id: created.data.user.id,
    });
    if (provisioned.error || !provisioned.data)
      throw provisioned.error ?? new Error("provision failed");
    pfyUserIds.push(provisioned.data);
    return client;
  }

  async function fixture() {
    const activity = await admin
      .from("activities")
      .insert({ title: `SPEC-006 ${Date.now()}`, lifecycle: "published", access_policy: "free" })
      .select("id")
      .single();
    if (activity.error || !activity.data) throw activity.error ?? new Error("activity failed");
    activityIds.push(activity.data.id);
    const exercise = await admin
      .from("exercises")
      .insert({
        activity_id: activity.data.id,
        title: "Exercise",
        assessment_mode: "automatic",
        scoring_policy: "required",
      })
      .select("id")
      .single();
    if (exercise.error || !exercise.data) throw exercise.error ?? new Error("exercise failed");
    return { activityId: activity.data.id, exerciseId: exercise.data.id };
  }

  beforeAll(async () => {
    admin = createClient(env("PFY_SUPABASE_URL"), env("PFY_SUPABASE_SERVICE_ROLE_KEY"));
    learnerA = await createLearner("a");
    learnerB = await createLearner("b");
  });

  afterAll(async () => {
    if (activityIds.length) await admin.from("activities").delete().in("id", activityIds);
    if (pfyUserIds.length) await admin.from("users").delete().in("id", pfyUserIds);
    for (const id of authIds) await admin.auth.admin.deleteUser(id);
  });

  it("allocates monotonic numbers and preserves historical snapshots", async () => {
    const activity = await admin
      .from("activities")
      .insert({ title: `Snapshot ${Date.now()}`, lifecycle: "published", access_policy: "free" })
      .select("id")
      .single();
    if (activity.error || !activity.data) throw activity.error ?? new Error("activity failed");
    activityIds.push(activity.data.id);
    const exercise = await admin
      .from("exercises")
      .insert({
        activity_id: activity.data.id,
        title: "Snapshot",
        assessment_mode: "automatic",
        scoring_policy: "none",
      })
      .select("id")
      .single();
    if (exercise.error || !exercise.data) throw exercise.error ?? new Error("exercise failed");
    const { exerciseId } = { exerciseId: exercise.data.id };
    const first = await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId });
    expect(first.error).toBeNull();
    expect(first.data.attempt_number).toBe(1);
    const changed = await admin
      .from("exercises")
      .update({ assessment_mode: "automatic", scoring_policy: "required" })
      .eq("id", exerciseId);
    expect(changed.error).toBeNull();
    const rejected = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: first.data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: 1,
      p_score_max: 1,
      p_score_scaled: 1,
      p_is_passed: true,
      p_duration_seconds: 1,
    });
    expect(rejected.error).toBeTruthy();
    expect(
      (
        await admin
          .from("exercise_attempts")
          .select("status,score_scaled")
          .eq("id", first.data.id)
          .single()
      ).data,
    ).toMatchObject({ status: "started", score_scaled: null });
    const second = await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId });
    expect(second.error).toBeNull();
    expect(second.data.attempt_number).toBe(1);
    expect(first.data.assessment_mode_at_attempt).toBe("automatic");
    expect(second.data.scoring_policy_at_attempt).toBe("none");

    const nonScoring = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: second.data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: null,
      p_score_max: null,
      p_score_scaled: null,
      p_is_passed: null,
      p_duration_seconds: 1,
    });
    expect(nonScoring.error).toBeNull();
    const rejectedCurrentConfig = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: second.data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: 1,
      p_score_max: 1,
      p_score_scaled: 1,
      p_is_passed: true,
      p_duration_seconds: 1,
    });
    expect(rejectedCurrentConfig.error).toBeTruthy();

    const automatic = await admin
      .from("exercises")
      .insert({
        activity_id: first.data.activity_id,
        title: "Automatic",
        assessment_mode: "automatic",
        scoring_policy: "none",
      })
      .select("id")
      .single();
    if (automatic.error || !automatic.data) throw automatic.error ?? new Error("exercise failed");
    const automaticAttempt = await learnerA.rpc("pfy_start_exercise_attempt", {
      p_exercise_id: automatic.data.id,
    });
    expect(automaticAttempt.error).toBeNull();
    const accepted = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: automaticAttempt.data.id,
      p_exercise_id: automatic.data.id,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: null,
      p_score_max: null,
      p_score_scaled: null,
      p_is_passed: null,
      p_duration_seconds: 1,
    });
    expect(accepted.error).toBeNull();
  });

  it("rejects manual and non-scoring H5P outcomes without changing Attempts", async () => {
    for (const assessmentMode of ["manual", "none"] as const) {
      const activity = await admin
        .from("activities")
        .insert({
          title: `${assessmentMode} ${Date.now()}`,
          lifecycle: "published",
          access_policy: "free",
        })
        .select("id")
        .single();
      if (activity.error || !activity.data) throw activity.error ?? new Error("activity failed");
      activityIds.push(activity.data.id);
      const exercise = await admin
        .from("exercises")
        .insert({
          activity_id: activity.data.id,
          title: assessmentMode,
          assessment_mode: assessmentMode,
          scoring_policy: "none",
        })
        .select("id")
        .single();
      if (exercise.error || !exercise.data) throw exercise.error ?? new Error("exercise failed");
      const started =
        assessmentMode === "manual"
          ? await learnerA.rpc("pfy_submit_manual_exercise_attempt", {
              p_exercise_id: exercise.data.id,
              p_content: "submission",
            })
          : await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exercise.data.id });
      if (started.error || !started.data) throw started.error ?? new Error("attempt failed");
      const rejected = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
        p_attempt_id: started.data.id,
        p_exercise_id: exercise.data.id,
        p_user_id: pfyUserIds[0],
        p_is_completed: true,
        p_score_raw: null,
        p_score_max: null,
        p_score_scaled: null,
        p_is_passed: null,
        p_duration_seconds: 1,
      });
      expect(rejected.error).toBeTruthy();
      const unchanged = await admin
        .from("exercise_attempts")
        .select("status,completed_at")
        .eq("id", started.data.id)
        .single();
      expect(unchanged.data).toMatchObject(
        assessmentMode === "manual"
          ? { status: "completed" }
          : { status: "started", completed_at: null },
      );
    }
  });

  it("isolates learner reads and rejects direct mutation", async () => {
    const { exerciseId } = await fixture();
    const started = await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId });
    expect(started.error).toBeNull();
    const own = await learnerA.from("exercise_attempts").select("id").eq("exercise_id", exerciseId);
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    const other = await learnerB
      .from("exercise_attempts")
      .select("id")
      .eq("exercise_id", exerciseId);
    expect(other.error).toBeNull();
    expect(other.data).toHaveLength(0);
    const insert = await learnerA.from("exercise_attempts").insert({
      exercise_id: exerciseId,
      activity_id: started.data.activity_id,
      user_id: pfyUserIds[1],
      attempt_number: 99,
      assessment_mode_at_attempt: "automatic",
      scoring_policy_at_attempt: "required",
    });
    expect(insert.error).toBeTruthy();
  });

  it("keeps completed history immutable and allocates concurrent executions uniquely", async () => {
    const { exerciseId } = await fixture();
    const started = await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId });
    expect(started.error).toBeNull();
    const completed = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: started.data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: 1,
      p_score_max: 1,
      p_score_scaled: 1,
      p_is_passed: true,
      p_duration_seconds: 1,
    });
    expect(completed.error).toBeNull();
    const duplicate = await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: started.data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: 0,
      p_score_max: 1,
      p_score_scaled: 0,
      p_is_passed: false,
      p_duration_seconds: 99,
    });
    expect(duplicate.error).toBeNull();
    expect(duplicate.data.score_scaled).toBe(1);
    expect(
      (await admin.from("exercise_attempts").update({ score_scaled: 0 }).eq("id", started.data.id))
        .error,
    ).toBeTruthy();
    expect(
      (await admin.from("exercise_attempts").delete().eq("id", started.data.id)).error,
    ).toBeTruthy();

    const concurrent = await Promise.all(
      Array.from({ length: 4 }, () =>
        learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId }),
      ),
    );
    expect(concurrent.every((result) => result.error === null)).toBe(true);
    expect(new Set(concurrent.map((result) => result.data.attempt_number)).size).toBe(1);
    await admin.rpc("pfy_apply_h5p_attempt_outcome", {
      p_attempt_id: concurrent[0].data.id,
      p_exercise_id: exerciseId,
      p_user_id: pfyUserIds[0],
      p_is_completed: true,
      p_score_raw: null,
      p_score_max: null,
      p_score_scaled: null,
      p_is_passed: null,
      p_duration_seconds: null,
    });
    const next = await learnerA.rpc("pfy_start_exercise_attempt", { p_exercise_id: exerciseId });
    expect(next.error).toBeNull();
    expect(next.data.attempt_number).toBe(concurrent[0].data.attempt_number + 1);
  });

  it("rejects ordinary Evaluation persistence and preserves sanitized manual text", async () => {
    const activity = await admin
      .from("activities")
      .insert({ title: `Manual ${Date.now()}`, lifecycle: "published", access_policy: "free" })
      .select("id")
      .single();
    if (activity.error || !activity.data) throw activity.error ?? new Error("activity failed");
    activityIds.push(activity.data.id);
    const exercise = await admin
      .from("exercises")
      .insert({
        activity_id: activity.data.id,
        title: "Manual",
        assessment_mode: "manual",
        scoring_policy: "optional",
      })
      .select("id")
      .single();
    if (exercise.error || !exercise.data) throw exercise.error ?? new Error("exercise failed");
    const submitted = await learnerA.rpc("pfy_submit_manual_exercise_attempt", {
      p_exercise_id: exercise.data.id,
      p_content: "Olá\r\ntexto\u0007",
    });
    expect(submitted.error).toBeNull();
    expect(submitted.data.content).toBe("Olá\ntexto");
    const denied = await learnerA.rpc("pfy_write_exercise_evaluation", {
      p_attempt_id: submitted.data.id,
      p_evaluator_user_id: pfyUserIds[1],
      p_score: 0.8,
      p_feedback: "ok\u0000",
    });
    expect(denied.error).toBeTruthy();
    const persisted = await admin.rpc("pfy_write_exercise_evaluation", {
      p_attempt_id: submitted.data.id,
      p_evaluator_user_id: pfyUserIds[1],
      p_score: null,
      p_feedback: "Olá\r\nfeedback\u0007",
    });
    expect(persisted.error).toBeNull();
    expect(persisted.data.feedback).toBe("Olá\nfeedback");
    expect(
      (
        await admin
          .from("exercise_evaluations")
          .update({ feedback: "changed" })
          .eq("id", persisted.data.id)
      ).error,
    ).toBeNull();
    expect(
      (await learnerA.from("exercise_evaluations").delete().eq("id", persisted.data.id)).error,
    ).toBeTruthy();
  });
});
