import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationEnabled = process.env.PFY_SUPABASE_INTEGRATION === "1";

describe.skipIf(!integrationEnabled)("SPEC-004 content foundation against local Supabase", () => {
  let admin: SupabaseClient;
  let anonymous: SupabaseClient;
  const activityIds: string[] = [];
  const syllabusIds: string[] = [];

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for integration tests`);
    return value;
  }

  async function createActivity(lifecycle: "draft" | "published" | "archived") {
    const result = await admin
      .from("activities")
      .insert({ title: `${lifecycle} activity ${Date.now()}-${Math.random()}`, lifecycle })
      .select("id")
      .single();
    if (result.error || !result.data) throw result.error ?? new Error("Activity was not created");
    activityIds.push(result.data.id);
    return result.data.id;
  }

  beforeAll(() => {
    const url = requireEnv("PFY_SUPABASE_URL");
    admin = createClient(url, requireEnv("PFY_SUPABASE_SERVICE_ROLE_KEY"));
    anonymous = createClient(url, requireEnv("PFY_SUPABASE_ANON_KEY"));
  });

  afterAll(async () => {
    if (syllabusIds.length > 0) await admin.from("syllabi").delete().in("id", syllabusIds);
    if (activityIds.length > 0) await admin.from("activities").delete().in("id", activityIds);
  });

  it("exposes only published Activities to ordinary reads", async () => {
    const publishedId = await createActivity("published");
    const draftId = await createActivity("draft");
    const archivedId = await createActivity("archived");

    const read = await anonymous
      .from("activities")
      .select("id,lifecycle")
      .in("id", [publishedId, draftId, archivedId]);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([{ id: publishedId, lifecycle: "published" }]);

    const directDraft = await anonymous.from("activities").select("*").eq("id", draftId).single();
    expect(directDraft.error).toBeTruthy();
    const directArchived = await anonymous
      .from("activities")
      .select("*")
      .eq("id", archivedId)
      .single();
    expect(directArchived.error).toBeTruthy();
  });

  it("keeps Exercise ownership and ordered composition referentially safe", async () => {
    const activityId = await createActivity("published");
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

    const read = await anonymous
      .from("activity_blocks")
      .select("position,block_type,exercise_id")
      .eq("activity_id", activityId)
      .order("position");
    expect(read.data).toEqual([
      { position: 1, block_type: "heading", exercise_id: null },
      { position: 2, block_type: "exercise", exercise_id: exercise.data.id },
    ]);
  });

  it("reuses one canonical Activity in independently ordered Percursos", async () => {
    const activityId = await createActivity("published");
    const secondActivityId = await createActivity("published");
    const syllabi = await admin
      .from("syllabi")
      .insert([
        { title: `Percurso A ${Date.now()}`, lifecycle: "published" },
        { title: `Percurso B ${Date.now()}`, lifecycle: "published" },
      ])
      .select("id");
    expect(syllabi.error).toBeNull();
    if (!syllabi.data) throw new Error("Percursos were not created");
    syllabusIds.push(...syllabi.data.map((syllabus) => syllabus.id));

    const memberships = await admin.from("syllabus_activities").insert([
      {
        syllabus_id: syllabusIds[0],
        activity_id: activityId,
        position: 2,
        pedagogical_metadata: { purpose: "practice" },
      },
      {
        syllabus_id: syllabusIds[0],
        activity_id: secondActivityId,
        position: 1,
        pedagogical_metadata: {},
      },
      {
        syllabus_id: syllabusIds[1],
        activity_id: activityId,
        position: 1,
        pedagogical_metadata: { purpose: "review" },
      },
    ]);
    expect(memberships.error).toBeNull();

    const read = await anonymous
      .from("syllabus_activities")
      .select("syllabus_id,activity_id,position,pedagogical_metadata")
      .in("syllabus_id", syllabusIds)
      .order("syllabus_id")
      .order("position");
    expect(read.data).toHaveLength(3);
    expect(read.data?.filter((membership) => membership.activity_id === activityId)).toHaveLength(
      2,
    );
    expect(
      read.data?.find((membership) => membership.syllabus_id === syllabusIds[0])?.position,
    ).toBe(1);
    expect(
      read.data?.find((membership) => membership.syllabus_id === syllabusIds[1])?.position,
    ).toBe(1);
  });

  it("does not expose non-published Percursos or their memberships", async () => {
    const activityId = await createActivity("published");
    const syllabus = await admin
      .from("syllabi")
      .insert({ title: `Draft Percurso ${Date.now()}`, lifecycle: "draft" })
      .select("id")
      .single();
    expect(syllabus.error).toBeNull();
    if (!syllabus.data) throw new Error("Percurso was not created");
    syllabusIds.push(syllabus.data.id);

    await admin.from("syllabus_activities").insert({
      syllabus_id: syllabus.data.id,
      activity_id: activityId,
      position: 1,
      pedagogical_metadata: {},
    });
    const read = await anonymous
      .from("syllabus_activities")
      .select("*")
      .eq("syllabus_id", syllabus.data.id);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
  });

  it("does not expose a draft Activity through a published Percurso", async () => {
    const draftActivityId = await createActivity("draft");
    const syllabus = await admin
      .from("syllabi")
      .insert({ title: `Published Percurso ${Date.now()}`, lifecycle: "published" })
      .select("id")
      .single();
    expect(syllabus.error).toBeNull();
    if (!syllabus.data) throw new Error("Percurso was not created");
    syllabusIds.push(syllabus.data.id);

    const membership = await admin.from("syllabus_activities").insert({
      syllabus_id: syllabus.data.id,
      activity_id: draftActivityId,
      position: 1,
      pedagogical_metadata: {},
    });
    expect(membership.error).toBeNull();

    const read = await anonymous
      .from("syllabus_activities")
      .select("activity_id")
      .eq("syllabus_id", syllabus.data.id);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
  });
});
