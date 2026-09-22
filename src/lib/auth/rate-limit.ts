import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const EMAIL_LIMIT = 5;
const CLIENT_LIMIT = 20;
const MAX_BUCKETS = 10_000;

type Bucket = { count: number; resetAt: number };

export type AuthRequestLimiter = (
  request: Request,
  normalizedEmail: string,
) => {
  allowed: boolean;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clientSignal(request: Request): string {
  // Forwarding headers are only an abuse signal. The email bucket remains effective if a caller spoofs them.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 128);
}

function consumeBucket(
  buckets: Map<string, Bucket>,
  key: string,
  limit: number,
  now: number,
): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function createAuthRequestLimiter(now: () => number = Date.now): AuthRequestLimiter {
  const buckets = new Map<string, Bucket>();

  return (request, normalizedEmail) => {
    const timestamp = now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) buckets.delete(key);
    }
    while (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (!oldest) break;
      buckets.delete(oldest);
    }

    const emailKey = `email:${digest(normalizedEmail)}`;
    const clientKey = `client:${digest(clientSignal(request))}`;
    const emailAllowed = consumeBucket(buckets, emailKey, EMAIL_LIMIT, timestamp);
    const clientAllowed =
      emailAllowed && consumeBucket(buckets, clientKey, CLIENT_LIMIT, timestamp);

    return { allowed: emailAllowed && clientAllowed };
  };
}

// This is process-local defense-in-depth. Supabase Auth and the deployment edge must provide
// shared throttling when the application runs across multiple instances.
export const authRequestLimiter = createAuthRequestLimiter();
