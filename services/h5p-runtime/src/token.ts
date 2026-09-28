import crypto from "node:crypto";

import type { RuntimeConfig } from "./config.js";

export interface RuntimeTokenPayload {
  /** PFY user identifier */
  sub: string;
  /** Lumi content id */
  cid: string;
  /** PFY Exercise UUID */
  eid: string;
  /** PFY Activity UUID */
  act: string;
  /** Expiration timestamp (seconds) */
  exp: number;
  /** Issued-at timestamp (seconds) */
  iat: number;
}

export function signRuntimeToken(
  payload: Omit<RuntimeTokenPayload, "iat">,
  secret: string,
): string {
  const fullPayload: RuntimeTokenPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const header = { alg: "HS256", typ: "PFY-H5P-RT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyRuntimeToken(token: string, secret: string): RuntimeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as RuntimeTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (typeof payload.cid !== "string" || typeof payload.eid !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminSecret(
  requestSecret: string | undefined,
  config: RuntimeConfig,
): boolean {
  return requestSecret === config.PFY_H5P_ADMIN_SECRET;
}

export function requireRuntimeSecret(
  requestSecret: string | undefined,
  config: RuntimeConfig,
): boolean {
  return requestSecret === config.PFY_H5P_RUNTIME_SECRET;
}
