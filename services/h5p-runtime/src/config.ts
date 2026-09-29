import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  PFY_H5P_RUNTIME_SECRET: z.string().min(32),
  PFY_H5P_ADMIN_SECRET: z.string().min(32),
  // SPEC-005 remediation: the previous default pointed at git tag "1.26.0",
  // which does not exist in h5p/h5p-php-library (verified against the GitHub
  // tags API: the real releases are "1.26", "1.27.0", "1.28.0", etc., with
  // inconsistent "vX.Y" vs "X.Y.Z" naming across versions). Every core
  // script/style request (jQuery, h5p.js, h5p.css, ...) would 404, so no H5P
  // content could ever render in a browser regardless of authorization.
  // "1.27.0" is a real, verified-reachable tag and matches this h5p-server
  // version's `coreApiVersion` (major 1, minor 27).
  PFY_H5P_CORE_URL: z
    .string()
    .url()
    .default("https://cdn.jsdelivr.net/gh/h5p/h5p-php-library@1.27.0"),
  // SPEC-005 remediation (Finding 3/5): h5p-server's PackageValidator strips
  // the leading dot from a file's own extension before comparing it to these
  // whitelist entries (see PackageValidator.isAllowedFileExtension). The
  // previous defaults included leading dots, so EVERY file in EVERY package
  // failed validation with "not-in-whitelist" — the import route was
  // completely non-functional, not just insecurely ordered. Verified by
  // writing a real .h5p package fixture and running it through
  // editor.uploadPackage in services/h5p-runtime/tests/import.integration.test.ts.
  PFY_H5P_CONTENT_WHITELIST: z
    .string()
    .default("json png jpg jpeg gif bmp svg mp3 m4a ogg wav mp4 webm ogv txt pdf h5p"),
  PFY_H5P_LIBRARY_WHITELIST: z.string().default("js css png jpg jpeg gif bmp svg json md"),
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
