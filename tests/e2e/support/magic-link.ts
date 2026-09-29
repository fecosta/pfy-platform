import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Polls the local Inbucket/Mailpit HTTP API for the Supabase magic-link
 * email sent to `email` and returns the verify URL inside it. Extracted from
 * tests/e2e/auth.spec.ts so other E2E specs (e.g. h5p-playback.spec.ts) don't
 * duplicate the quoted-printable decoding logic.
 */
export async function findMagicLink(
  request: APIRequestContext,
  emailCaptureUrl: string,
  email: string,
  supabaseUrl: string,
): Promise<string> {
  await expect
    .poll(async () => {
      const messages = await (
        await request.get(new URL("/api/v1/messages", emailCaptureUrl).toString())
      ).json();
      return messages.messages.some(
        (candidate: { To: { Address: string }[] }) => candidate.To[0]?.Address === email,
      );
    })
    .toBe(true);
  const messages = await (
    await request.get(new URL("/api/v1/messages", emailCaptureUrl).toString())
  ).json();
  const message = messages.messages.find(
    (candidate: { To: { Address: string }[] }) => candidate.To[0]?.Address === email,
  );
  expect(message).toBeTruthy();
  const raw = await (
    await request.get(new URL(`/api/v1/message/${message.ID}/raw`, emailCaptureUrl).toString())
  ).text();
  const decoded = raw
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .replace(/&amp;/g, "&");
  const authOrigin = new URL(supabaseUrl).origin;
  const magicLink = [...decoded.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1])
    .find((href) => {
      try {
        const link = new URL(href);
        return link.origin === authOrigin && link.pathname === "/auth/v1/verify";
      } catch {
        return false;
      }
    });
  expect(magicLink).toBeTruthy();
  return magicLink!;
}
