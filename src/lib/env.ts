import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = envSchema.extend({
  PFY_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid application configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}

export function hasValidEnv(source: Record<string, string | undefined> = process.env): boolean {
  return envSchema.safeParse(source).success;
}

export function getServerEnv(source: Record<string, string | undefined> = process.env) {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid server configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
