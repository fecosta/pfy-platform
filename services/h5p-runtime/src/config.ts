import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  PFY_H5P_RUNTIME_SECRET: z.string().min(32),
  PFY_H5P_ADMIN_SECRET: z.string().min(32),
  PFY_H5P_CORE_URL: z
    .string()
    .url()
    .default("https://cdn.jsdelivr.net/gh/h5p/h5p-php-library@1.26.0"),
  PFY_H5P_CONTENT_WHITELIST: z
    .string()
    .default(
      ".json .png .jpg .jpeg .gif .bmp .svg .mp3 .m4a .ogg .wav .mp4 .webm .ogg .ogv .txt .pdf .h5p",
    ),
  PFY_H5P_LIBRARY_WHITELIST: z
    .string()
    .default(".js .css .png .jpg .jpeg .gif .bmp .svg .json .md"),
  PFY_H5P_STORAGE_PATH: z.string().default("./storage"),
});

export type RuntimeConfig = z.infer<typeof envSchema>;

export function getRuntimeConfig(
  source: Record<string, string | undefined> = process.env,
): RuntimeConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid H5P runtime configuration: ${result.error.message}`);
  }
  return result.data;
}

export function runtimeStoragePaths(basePath: string) {
  return {
    content: `${basePath}/content`,
    libraries: `${basePath}/libraries`,
    temporary: `${basePath}/temporary`,
    userData: `${basePath}/user-data`,
    config: `${basePath}/config.json`,
  };
}
