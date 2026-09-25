import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationEnabled = process.env.PFY_SUPABASE_INTEGRATION === "1";

describe.skipIf(!integrationEnabled)("SPEC-004 content access against local Supabase", () => {
  let admin: SupabaseClient;
  let anonymous: SupabaseClient;
  const activityIds: string[] = [];
  const syllabusIds: string[] = [];
  const createdAuthUsers: string[] = [];
  const createdPfyUsers: string[] = [];

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for integration tests`);
    return value;
  }

  async function createActivity(
    lifecycle: "draft" | "published" | "archived",
    accessPolicy: "free" | "entitlement_required" = "entitlement_required",
  ) {
    const result = await admin
      .from("activities")
      .insert({
        title: `${lifecycle} ${accessPolicy} activity ${Date.now()}-${Math.random()}`,
        lifecycle,
        access_policy: accessPolicy,
      })
      .select("id")
      .single();
    if (result.error || !result.data) throw result.error ?? new Error("Activity was not created");
    activityIds.push(result.data.id);
    return result.data.id;
  }

  async function addExerciseBlock(activityId: string, position = 1) {
    const exercise = await admin
      .from("exercises")
      .insert({
        activity_id: activityId,
        title: "Exercise",
        implementation_metadata: { private: true },
      })
      .select("id")
      .single();
    if (exercise.error || !exercise.data)
      throw exercise.error ?? new Error("Exercise was not created");

    const block = await admin.from("activity_blocks").insert({
      activity_id: activityId,
      position,
      block_type: "exercise",
      content: {},
      exercise_id: exercise.data.id,
    });
    if (block.error) throw block.error;
    return exercise.data.id;
  }

  async function createAuthenticatedFixture(email: string): Promise<SupabaseClient> {
    const created = await admin.auth.admin.createUser({
      email,
      password: "SPEC004-test-password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Auth fixture was not created");
    createdAuthUsers.push(created.data.user.id);

    const client = createClient(
      requireEnv("PFY_SUPABASE_URL"),
      requireEnv("PFY_SUPABASE_ANON_KEY"),
    );
    const signIn = await client.auth.signInWithPassword({
      email,
      password: "SPEC004-test-password-123!",
    });
    if (signIn.error) throw signIn.error;

    const provision = await admin.rpc("pfy_provision_identity", {
      requested_email: email,
      requested_first_name: "Content",
      requested_last_name: "Tester",
      requested_auth_user_id: created.data.user.id,
    });
    if (provision.error || !provision.data)
      throw provision.error ?? new Error("PFY fixture was not provisioned");
    createdPfyUsers.push(provision.data);
    return client;
  }

  beforeAll(() => {
    const url = requireEnv("PFY_SUPABASE_URL");
    admin = createClient(url, requireEnv("PFY_SUPABASE_SERVICE_ROLE_KEY"));
    anonymous = createClient(url, requireEnv("PFY_SUPABASE_ANON_KEY"));
  });

  afterAll(async () => {
    for (const id of createdAuthUsers) await admin.auth.admin.deleteUser(id);
    if (syllabusIds.length > 0) await admin.from("syllabi").delete().in("id", syllabusIds);
    if (activityIds.length > 0) await admin.from("activities").delete().in("id", activityIds);
    if (createdPfyUsers.length > 0)
      await admin
        .from("users")
        .delete()
        .in("id", [...new Set(createdPfyUsers)]);
  });

  it("exposes only safe published catalog metadata", async () => {
    const freeId = await createActivity("published", "free");
    const draftId = await createActivity("draft", "free");
    const archivedId = await createActivity("archived", "free");
    const privateMetadata = await admin
      .from("activities")
      .update({ discovery_metadata: { private_editorial_note: "do not expose" } })
      .eq("id", freeId);
    expect(privateMetadata.error).toBeNull();

    const read = await anonymous.from("published_activity_catalog").select("*");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([expect.objectContaining({ id: freeId, access_policy: "free" })]);
    expect(read.data?.[0]).not.toHaveProperty("discovery_metadata");
    expect(read.data?.some((row) => row.id === draftId || row.id === archivedId)).toBe(false);
  });

  it("denies anonymous complete Activity, ActivityBlock and Exercise reads", async () => {
    const activityId = await createActivity("published", "free");
    await addExerciseBlock(activityId);

    const activityRead = await anonymous.from("activities").select("id,title").eq("id", activityId);
    const blockRead = await anonymous
      .from("activity_blocks")
      .select("*")
      .eq("activity_id", activityId);
    const exerciseRead = await anonymous
      .from("exercises")
      .select("id,title")
      .eq("activity_id", activityId);
    expect(activityRead.error).toBeTruthy();
    expect(blockRead.error).toBeTruthy();
    expect(exerciseRead.error).toBeTruthy();
    const projectionRead = await anonymous
      .from("free_activity_block_consumption")
      .select("*")
      .eq("activity_id", activityId);
    expect(projectionRead.error).toBeTruthy();
  });

  it("allows an authenticated canonical user to consume explicitly free content", async () => {
    const activityId = await createActivity("published", "free");
    const passiveBlocks = await admin.from("activity_blocks").insert([
      {
        activity_id: activityId,
        position: 1,
        block_type: "editorial",
        content: { text: "Visible text", private_editorial_note: "must not reach consumer" },
      },
      { activity_id: activityId, position: 2, block_type: "heading", content: { text: "Heading" } },
      {
        activity_id: activityId,
        position: 3,
        block_type: "reflection",
        content: { prompt: "Prompt" },
      },
      {
        activity_id: activityId,
        position: 4,
        block_type: "image",
        content: { src: "https://example.com/image.png", alt: "Image", private: "omit" },
      },
      {
        activity_id: activityId,
        position: 5,
        block_type: "video",
        content: { src: "https://example.com/video.mp4", title: "Video", private: "omit" },
      },
      {
        activity_id: activityId,
        position: 6,
        block_type: "infographic",
        content: { src: "https://example.com/info.png", alt: "Infographic", private: "omit" },
      },
      {
        activity_id: activityId,
        position: 7,
        block_type: "embed",
        content: { url: "https://example.com/embed", title: "Embed", private: "omit" },
      },
    ]);
    expect(passiveBlocks.error).toBeNull();
    const exerciseId = await addExerciseBlock(activityId, 8);
    const authenticated = await createAuthenticatedFixture(`free-${Date.now()}@example.com`);

    const activityRead = await authenticated
      .from("activities")
      .select("id,title")
      .eq("id", activityId);
    const blockRead = await authenticated
      .from("free_activity_block_consumption")
      .select("position,block_type,content,exercise_id")
      .eq("activity_id", activityId);
    const rawBlockRead = await authenticated
      .from("activity_blocks")
      .select("*")
      .eq("activity_id", activityId);
    const exerciseRead = await authenticated
      .from("exercises")
      .select("id,activity_id,title")
      .eq("id", exerciseId);
    expect(activityRead.error).toBeNull();
    expect(activityRead.data).toHaveLength(1);
    expect(blockRead.error).toBeNull();
    expect(blockRead.data).toHaveLength(8);
    expect(rawBlockRead.error).toBeTruthy();
    expect(blockRead.data?.map((block) => block.block_type)).toEqual([
      "editorial",
      "heading",
      "reflection",
      "image",
      "video",
      "infographic",
      "embed",
      "exercise",
    ]);
    expect(blockRead.data?.[0].content).toEqual({ text: "Visible text" });
    expect(blockRead.data?.[0].content).not.toHaveProperty("private_editorial_note");
    expect(exerciseRead.error).toBeNull();
    expect(exerciseRead.data).toEqual([
      { id: exerciseId, activity_id: activityId, title: "Exercise" },
    ]);
  });

  it("fails closed for entitlement-required content before SPEC-009", async () => {
    const activityId = await createActivity("published", "entitlement_required");
    await addExerciseBlock(activityId);
    const implicitPolicy = await admin
      .from("activities")
      .insert({ title: `Implicit policy ${Date.now()}`, lifecycle: "published" })
      .select("id,access_policy")
      .single();
    expect(implicitPolicy.error).toBeNull();
    if (!implicitPolicy.data) throw new Error("Implicit policy fixture was not created");
    activityIds.push(implicitPolicy.data.id);
    expect(implicitPolicy.data.access_policy).toBe("entitlement_required");
    const authenticated = await createAuthenticatedFixture(`locked-${Date.now()}@example.com`);

    const catalog = await authenticated
      .from("published_activity_catalog")
      .select("id,access_policy")
      .eq("id", activityId);
    const activityRead = await authenticated.from("activities").select("id").eq("id", activityId);
    const blockRead = await authenticated
      .from("activity_blocks")
      .select("id")
      .eq("activity_id", activityId);
    expect(catalog.data).toEqual([{ id: activityId, access_policy: "entitlement_required" }]);
    expect(activityRead.error).toBeNull();
    expect(activityRead.data).toEqual([]);
    expect(blockRead.error).toBeTruthy();
  });

  it("keeps Percurso catalog discovery separate from Activity consumption", async () => {
    const hiddenId = await createActivity("draft", "free");
    const freeId = await createActivity("published", "free");
    const lockedId = await createActivity("published", "entitlement_required");
    const syllabus = await admin
      .from("syllabi")
      .insert({ title: `Percurso ${Date.now()}`, lifecycle: "published" })
      .select("id")
      .single();
    expect(syllabus.error).toBeNull();
    if (!syllabus.data) throw new Error("Percurso was not created");
    syllabusIds.push(syllabus.data.id);

    const memberships = await admin.from("syllabus_activities").insert([
      {
        syllabus_id: syllabus.data.id,
        activity_id: hiddenId,
        position: 1,
        pedagogical_metadata: { private: "omit" },
      },
      {
        syllabus_id: syllabus.data.id,
        activity_id: freeId,
        position: 2,
        pedagogical_metadata: { private: "omit" },
      },
      {
        syllabus_id: syllabus.data.id,
        activity_id: lockedId,
        position: 4,
        pedagogical_metadata: { private: "omit" },
      },
    ]);
    expect(memberships.error).toBeNull();

    const catalog = await anonymous
      .from("published_syllabus_catalog")
      .select("*")
      .eq("syllabus_id", syllabus.data.id)
      .order("position");
    expect(catalog.error).toBeNull();
    expect(catalog.data?.map((row) => [row.activity_id, row.access_policy])).toEqual([
      [freeId, "free"],
      [lockedId, "entitlement_required"],
    ]);
    expect(catalog.data?.map((row) => row.position)).toEqual([2, 4]);
    expect(catalog.data?.[0]).not.toHaveProperty("pedagogical_metadata");

    const anonymousContent = await anonymous
      .from("activity_blocks")
      .select("*")
      .eq("activity_id", freeId);
    expect(anonymousContent.error).toBeTruthy();
  });

  it("keeps published Percursos discoverable with zero visible Activities", async () => {
    const hiddenActivityId = await createActivity("draft", "free");
    const archivedActivityId = await createActivity("archived", "free");
    const emptySyllabus = await admin
      .from("syllabi")
      .insert({ title: `Empty Percurso ${Date.now()}`, lifecycle: "published" })
      .select("id")
      .single();
    const hiddenSyllabus = await admin
      .from("syllabi")
      .insert({ title: `Hidden Percurso ${Date.now()}`, lifecycle: "published" })
      .select("id")
      .single();
    const archivedSyllabus = await admin
      .from("syllabi")
      .insert({ title: `Archived content Percurso ${Date.now()}`, lifecycle: "published" })
      .select("id")
      .single();
    const draftSyllabus = await admin
      .from("syllabi")
      .insert({ title: `Draft Percurso ${Date.now()}`, lifecycle: "draft" })
      .select("id")
      .single();
    expect(emptySyllabus.error).toBeNull();
    expect(hiddenSyllabus.error).toBeNull();
    expect(archivedSyllabus.error).toBeNull();
    expect(draftSyllabus.error).toBeNull();
    if (
      !emptySyllabus.data ||
      !hiddenSyllabus.data ||
      !archivedSyllabus.data ||
      !draftSyllabus.data
    )
      throw new Error("Percurso fixtures were not created");
    syllabusIds.push(
      emptySyllabus.data.id,
      hiddenSyllabus.data.id,
      archivedSyllabus.data.id,
      draftSyllabus.data.id,
    );

    const membership = await admin.from("syllabus_activities").insert([
      {
        syllabus_id: hiddenSyllabus.data.id,
        activity_id: hiddenActivityId,
        position: 1,
        pedagogical_metadata: { private: "omit" },
      },
      {
        syllabus_id: hiddenSyllabus.data.id,
        activity_id: archivedActivityId,
        position: 3,
        pedagogical_metadata: { private: "omit" },
      },
      {
        syllabus_id: archivedSyllabus.data.id,
        activity_id: archivedActivityId,
        position: 7,
        pedagogical_metadata: { private: "omit" },
      },
      {
        syllabus_id: draftSyllabus.data.id,
        activity_id: hiddenActivityId,
        position: 1,
        pedagogical_metadata: { private: "omit" },
      },
    ]);
    expect(membership.error).toBeNull();

    const visibleCatalog = await anonymous
      .from("published_syllabus_catalog")
      .select("syllabus_id,activity_id,position")
      .in("syllabus_id", [
        emptySyllabus.data.id,
        hiddenSyllabus.data.id,
        archivedSyllabus.data.id,
        draftSyllabus.data.id,
      ])
      .order("syllabus_id")
      .order("position");
    expect(visibleCatalog.error).toBeNull();
    expect(visibleCatalog.data).toHaveLength(3);
    expect(visibleCatalog.data).toEqual(
      expect.arrayContaining([
        { syllabus_id: emptySyllabus.data.id, activity_id: null, position: null },
        { syllabus_id: hiddenSyllabus.data.id, activity_id: null, position: null },
        { syllabus_id: archivedSyllabus.data.id, activity_id: null, position: null },
      ]),
    );
  });

  it("preserves ownership and deterministic ordering constraints", async () => {
    const activityId = await createActivity("published", "free");
    const exercise = await admin
      .from("exercises")
      .insert({ activity_id: activityId, title: "Exercise" })
      .select("id")
      .single();
    expect(exercise.error).toBeNull();
    if (!exercise.data) throw new Error("Exercise was not created");

    const blocks = await admin.from("activity_blocks").insert([
      { activity_id: activityId, position: 1, block_type: "heading", content: { text: "Intro" } },
      {
        activity_id: activityId,
        position: 2,
        block_type: "exercise",
        content: {},
        exercise_id: exercise.data.id,
      },
    ]);
    expect(blocks.error).toBeNull();

    const duplicatePosition = await admin.from("activity_blocks").insert({
      activity_id: activityId,
      position: 2,
      block_type: "editorial",
      content: { text: "No" },
    });
    expect(duplicatePosition.error).toBeTruthy();

    const foreignExercise = await admin
      .from("exercises")
      .insert({ activity_id: "00000000-0000-0000-0000-000000000001" });
    expect(foreignExercise.error).toBeTruthy();

    const read = await admin
      .from("activity_blocks")
      .select("position,block_type,exercise_id")
      .eq("activity_id", activityId)
      .order("position");
    expect(read.data).toEqual([
      { position: 1, block_type: "heading", exercise_id: null },
      { position: 2, block_type: "exercise", exercise_id: exercise.data.id },
    ]);
  });
});
