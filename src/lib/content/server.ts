import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentUser } from "@/lib/auth/current-user";
import {
  parseActivityBlock,
  type ActivityAccessPolicy,
  type Activity,
  type ActivitySummary,
  type Syllabus,
  type SyllabusSummary,
} from "@/lib/content/types";

const uuidSchema = z.string().uuid();

const activityColumns = "id,title,summary,cover_asset_url,level";

export type PublishedActivityResult =
  | { status: "not-found" }
  | { status: "authentication-required" }
  | { status: "entitlement-required" }
  | { status: "allowed"; activity: Activity };

function toActivitySummary(row: {
  id: string;
  title: string;
  summary: string;
  cover_asset_url: string | null;
  level: string | null;
  access_policy: ActivityAccessPolicy;
}): ActivitySummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    coverAssetUrl: row.cover_asset_url,
    level: row.level,
    accessPolicy: row.access_policy,
  };
}

export async function getPublishedActivities(): Promise<ActivitySummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("published_activity_catalog")
      .select("id,title,summary,cover_asset_url,level,access_policy")
      .order("title");

    if (error || !data) return [];
    return data.map(toActivitySummary);
  } catch {
    return [];
  }
}

export async function getPublishedActivity(id: string): Promise<PublishedActivityResult> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return { status: "not-found" };

  try {
    const supabase = await createSupabaseServerClient();
    const catalogResult = await supabase
      .from("published_activity_catalog")
      .select("id,title,summary,cover_asset_url,level,access_policy")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (catalogResult.error || !catalogResult.data) return { status: "not-found" };

    const currentUser = await resolveCurrentUser();
    if (currentUser.status !== "resolved") return { status: "authentication-required" };
    if (catalogResult.data.access_policy !== "free") return { status: "entitlement-required" };

    const [activityResult, blocksResult] = await Promise.all([
      supabase.from("activities").select(activityColumns).eq("id", parsedId.data).maybeSingle(),
      supabase
        .from("free_activity_block_consumption")
        .select("id,position,block_type,content,exercise_id")
        .eq("activity_id", parsedId.data)
        .order("position"),
    ]);

    if (activityResult.error || !activityResult.data || blocksResult.error || !blocksResult.data)
      return { status: "not-found" };
    return {
      status: "allowed",
      activity: {
        ...toActivitySummary({
          ...activityResult.data,
          access_policy: catalogResult.data.access_policy,
        }),
        blocks: blocksResult.data.flatMap((block) => {
          const parsedBlock = parseActivityBlock(block);
          return parsedBlock ? [parsedBlock] : [];
        }),
      },
    };
  } catch {
    return { status: "not-found" };
  }
}

export async function getPublishedSyllabi(): Promise<SyllabusSummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("published_syllabus_catalog")
      .select(
        "syllabus_id,syllabus_title,syllabus_description,syllabus_level,expected_workload,activity_id,activity_title,activity_summary,activity_cover_asset_url,activity_level,access_policy",
      )
      .order("syllabus_title")
      .order("position");

    if (error || !data) return [];
    return [
      ...new Map(
        data.map((row) => [
          row.syllabus_id,
          {
            id: row.syllabus_id,
            title: row.syllabus_title,
            description: row.syllabus_description,
            level: row.syllabus_level,
            expectedWorkload: row.expected_workload,
          },
        ]),
      ).values(),
    ];
  } catch {
    return [];
  }
}

export async function getPublishedSyllabus(id: string): Promise<Syllabus | null> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("published_syllabus_catalog")
      .select(
        "syllabus_id,syllabus_title,syllabus_description,syllabus_level,expected_workload,position,activity_id,activity_title,activity_summary,activity_cover_asset_url,activity_level,access_policy",
      )
      .eq("syllabus_id", parsedId.data)
      .order("position");
    if (error || !data || data.length === 0) return null;

    const first = data[0];
    const visibleActivities = data.filter((row) => row.activity_id !== null);
    return {
      id: first.syllabus_id,
      title: first.syllabus_title,
      description: first.syllabus_description,
      level: first.syllabus_level,
      expectedWorkload: first.expected_workload,
      activities: visibleActivities.map((row) => ({
        position: row.position,
        activity: {
          id: row.activity_id,
          title: row.activity_title,
          summary: row.activity_summary,
          coverAssetUrl: row.activity_cover_asset_url,
          level: row.activity_level,
          accessPolicy: row.access_policy,
        },
        pedagogicalMetadata: {},
      })),
    };
  } catch {
    return null;
  }
}
