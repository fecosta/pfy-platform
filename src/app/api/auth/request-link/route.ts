import { NextResponse } from "next/server";
import { z } from "zod";

import { callbackUrl, safeRedirectPath } from "@/lib/auth/redirects";
import { authRequestLimiter } from "@/lib/auth/rate-limit";
import { loginEmailStatus } from "@/lib/identity/server";
import { normalizeEmail } from "@/lib/identity/email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  email: z.string().trim().email().max(320),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  let input: unknown;
  const isFormSubmission = !request.headers.get("content-type")?.includes("application/json");
  try {
    input = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const email = normalizeEmail(parsed.data.email);
  if (!authRequestLimiter(request, email).allowed) {
    return NextResponse.json({ error: "Too many authentication requests" }, { status: 429 });
  }

  try {
    const identity = await loginEmailStatus(email);
    if (!identity.exists) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/auth/registration-required", request.url), 303);
      }
      return NextResponse.json({ registration_required: true }, { status: 409 });
    }

    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    const localOrigin = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // The local Auth allow-list uses the site root; the root page hands the code to this callback.
        emailRedirectTo: localOrigin
          ? new URL("/", request.url).toString()
          : callbackUrl(origin, safeRedirectPath(parsed.data.next)),
        shouldCreateUser: !identity.authLinked,
      },
    });
    if (error)
      return NextResponse.json({ error: "Unable to send authentication link" }, { status: 502 });

    if (isFormSubmission) return NextResponse.redirect(new URL("/login?sent=1", request.url), 303);
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "Unable to send authentication link" }, { status: 503 });
  }
}
