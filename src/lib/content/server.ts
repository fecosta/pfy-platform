import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseActivityBlock,
  type Activity,
  type ActivitySummary,
  type Syllabus,
  type SyllabusSummary,
} from "@/lib/content/types";

const uuidSchema = z.string().uuid();

const activityColumns = "id,title,summary,cover_asset_url,level";

function toActivitySummary(row: {
  id: string;
  title: string;
  summary: string;
  cover_asset_url: string | null;
  level: string | null;
}): ActivitySummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    coverAssetUrl: row.cover_asset_url,
    level: row.level,
  };
}

export async function getPublishedActivities(): Promise<ActivitySummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("activities")
      .select(activityColumns)
      .eq("lifecycle", "published")
      .order("title");

    if (error || !data) return [];
    return data.map(toActivitySummary);
  } catch {
    return [];
  }
}

export async function getPublishedActivity(id: string): Promise<Activity | null> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const [activityResult, blocksResult] = await Promise.all([
      supabase
        .from("activities")
        .select(activityColumns)
        .eq("id", parsedId.data)
        .eq("lifecycle", "published")
        .maybeSingle(),
      supabase
        .from("activity_blocks")
        .select("id,position,block_type,content,exercise_id")
        .eq("activity_id", parsedId.data)
        .order("position"),
    ]);

    if (activityResult.error || !activityResult.data || blocksResult.error || !blocksResult.data)
      return null;
    return {
      ...toActivitySummary(activityResult.data),
      blocks: blocksResult.data.flatMap((block) => {
        const parsedBlock = parseActivityBlock(block);
        return parsedBlock ? [parsedBlock] : [];
      }),
    };
  } catch {
    return null;
  }
}

function toSyllabusSummary(row: {
  id: string;
  title: string;
  description: string;
  level: string | null;
  expected_workload: string | null;
}): SyllabusSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    expectedWorkload: row.expected_workload,
  };
}

export async function getPublishedSyllabi(): Promise<SyllabusSummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("syllabi")
      .select("id,title,description,level,expected_workload")
      .eq("lifecycle", "published")
      .order("title");

    if (error || !data) return [];
    return data.map(toSyllabusSummary);
  } catch {
    return [];
  }
}

export async function getPublishedSyllabus(id: string): Promise<Syllabus | null> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const syllabusResult = await supabase
      .from("syllabi")
      .select("id,title,description,level,expected_workload")
      .eq("id", parsedId.data)
      .eq("lifecycle", "published")
      .maybeSingle();
    if (syllabusResult.error || !syllabusResult.data) return null;

    const membershipsResult = await supabase
      .from("syllabus_activities")
      .select("activity_id,position,pedagogical_metadata")
      .eq("syllabus_id", parsedId.data)
      .order("position");
    if (membershipsResult.error || !membershipsResult.data) return null;

    const activityIds = membershipsResult.data.map((membership) => membership.activity_id);
    if (activityIds.length === 0)
      return { ...toSyllabusSummary(syllabusResult.data), activities: [] };

    const activitiesResult = await supabase
      .from("activities")
      .select(activityColumns)
      .in("id", activityIds)
      .eq("lifecycle", "published");
    if (activitiesResult.error || !activitiesResult.data) return null;
    const activitiesById = new Map(
      activitiesResult.data.map((activity) => [activity.id, toActivitySummary(activity)]),
    );

    return {
      ...toSyllabusSummary(syllabusResult.data),
      activities: membershipsResult.data.flatMap((membership) => {
        const activity = activitiesById.get(membership.activity_id);
        return activity
          ? [
              {
                position: membership.position,
                activity,
                pedagogicalMetadata: membership.pedagogical_metadata,
              },
            ]
          : [];
      }),
    };
  } catch {
    return null;
  }
}
