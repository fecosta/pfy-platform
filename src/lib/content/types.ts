import { z } from "zod";

export const activityLifecycleSchema = z.enum(["draft", "published", "archived"]);
export type ActivityLifecycle = z.infer<typeof activityLifecycleSchema>;
export const activityAccessPolicySchema = z.enum(["free", "entitlement_required"]);
export type ActivityAccessPolicy = z.infer<typeof activityAccessPolicySchema>;

const objectSchema = z.record(z.string(), z.unknown());
const safeHttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  });

const blockContentSchemas = {
  editorial: z.object({ text: z.string() }),
  heading: z.object({ text: z.string() }),
  reflection: z.object({ prompt: z.string() }),
  image: z.object({ src: safeHttpUrlSchema, alt: z.string() }),
  video: z.object({ src: safeHttpUrlSchema, title: z.string().optional() }),
  infographic: z.object({ src: safeHttpUrlSchema, alt: z.string() }),
  embed: z.object({ url: safeHttpUrlSchema, title: z.string().optional() }),
  exercise: objectSchema,
} as const;

export type ActivityBlock =
  | { id: string; position: number; type: "editorial"; text: string }
  | { id: string; position: number; type: "heading"; text: string }
  | { id: string; position: number; type: "reflection"; prompt: string }
  | { id: string; position: number; type: "image"; src: string; alt: string }
  | { id: string; position: number; type: "video"; src: string; title?: string }
  | { id: string; position: number; type: "infographic"; src: string; alt: string }
  | { id: string; position: number; type: "embed"; url: string; title?: string }
  | { id: string; position: number; type: "exercise"; exerciseId: string };

export type ActivitySummary = {
  id: string;
  title: string;
  summary: string;
  coverAssetUrl: string | null;
  level: string | null;
  accessPolicy: ActivityAccessPolicy;
};

export type Activity = ActivitySummary & {
  blocks: ActivityBlock[];
};

export type SyllabusSummary = {
  id: string;
  title: string;
  description: string;
  level: string | null;
  expectedWorkload: string | null;
};

export type Syllabus = SyllabusSummary & {
  activities: Array<{
    position: number;
    activity: ActivitySummary;
    pedagogicalMetadata: Record<string, unknown>;
  }>;
};

export function parseActivityBlock(row: {
  id: string;
  position: number;
  block_type: string;
  content: unknown;
  exercise_id: string | null;
}): ActivityBlock | null {
  if (!(row.block_type in blockContentSchemas)) return null;
  if (row.block_type === "exercise") {
    return row.exercise_id
      ? { id: row.id, position: row.position, type: "exercise", exerciseId: row.exercise_id }
      : null;
  }

  if (row.block_type === "editorial" || row.block_type === "heading") {
    const parsed = blockContentSchemas[row.block_type].safeParse(row.content);
    return parsed.success
      ? { id: row.id, position: row.position, type: row.block_type, text: parsed.data.text }
      : null;
  }
  if (row.block_type === "reflection") {
    const parsed = blockContentSchemas.reflection.safeParse(row.content);
    return parsed.success
      ? { id: row.id, position: row.position, type: "reflection", prompt: parsed.data.prompt }
      : null;
  }
  if (row.block_type === "image" || row.block_type === "infographic") {
    const parsed = blockContentSchemas[row.block_type].safeParse(row.content);
    return parsed.success
      ? {
          id: row.id,
          position: row.position,
          type: row.block_type,
          src: parsed.data.src,
          alt: parsed.data.alt,
        }
      : null;
  }
  if (row.block_type === "video") {
    const parsed = blockContentSchemas.video.safeParse(row.content);
    return parsed.success
      ? {
          id: row.id,
          position: row.position,
          type: "video",
          src: parsed.data.src,
          title: parsed.data.title,
        }
      : null;
  }
  const parsed = blockContentSchemas.embed.safeParse(row.content);
  return parsed.success
    ? {
        id: row.id,
        position: row.position,
        type: "embed",
        url: parsed.data.url,
        title: parsed.data.title,
      }
    : null;
}
