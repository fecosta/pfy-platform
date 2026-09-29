import crypto from "node:crypto";

// NOTE: This module is intentionally byte-identical to
// services/h5p-runtime/src/token.ts. The PFY application and the isolated
// H5P runtime are separate deployables (no shared workspace package), so the
// two copies cannot import a single module today. Keep them in sync; a
// regression test (tests/h5p-token-parity.test.ts) diffs the two source
// files so drift fails CI instead of silently diverging security behavior.

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

const SIGNATURE_BYTE_LENGTH = 32; // HMAC-SHA256 digest length

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

/**
 * Verifies a runtime token. Fails closed (returns null) for ANY malformed,
 * truncated, oversized, mistyped or tampered input. Never throws: attacker
 * controlled input must not crash the caller/runtime process.
 */
export function verifyRuntimeToken(token: string, secret: string): RuntimeTokenPayload | null {
  try {
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    if (!encodedHeader || !encodedPayload || !signature) return null;

    // Validate the header before trusting anything else. Reject unknown
    // algorithms so a future addition of an "alg" downgrade path can't be
    // used to bypass HMAC verification.
    let header: unknown;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf-8"));
    } catch {
      return null;
    }
    if (
      typeof header !== "object" ||
      header === null ||
      (header as { alg?: unknown }).alg !== "HS256" ||
      (header as { typ?: unknown }).typ !== "PFY-H5P-RT"
    ) {
      return null;
    }

    // Decode the signature and compare lengths BEFORE calling
    // timingSafeEqual, which throws RangeError on length mismatch.
    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    if (
      signatureBuffer.length !== SIGNATURE_BYTE_LENGTH ||
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    } catch {
      return null;
    }
    if (typeof payload !== "object" || payload === null) return null;

    const candidate = payload as Partial<RuntimeTokenPayload>;
    if (
      typeof candidate.sub !== "string" ||
      typeof candidate.cid !== "string" ||
      typeof candidate.eid !== "string" ||
      typeof candidate.act !== "string" ||
      typeof candidate.exp !== "number" ||
      !Number.isFinite(candidate.exp) ||
      typeof candidate.iat !== "number" ||
      !Number.isFinite(candidate.iat)
    ) {
      return null;
    }
    if (candidate.exp <= Math.floor(Date.now() / 1000)) return null;

    return candidate as RuntimeTokenPayload;
  } catch {
    // Defense in depth: any unexpected decode/parse error fails closed.
    return null;
  }
}
