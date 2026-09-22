import { NextResponse } from "next/server";
import { z } from "zod";

import { callbackUrl, safeRedirectPath } from "@/lib/auth/redirects";
import { authRequestLimiter } from "@/lib/auth/rate-limit";
import { loginEmailStatus, provisionIdentity } from "@/lib/identity/server";
import { normalizeEmail } from "@/lib/identity/email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const registrationSchema = z.object({
  email: z.string().trim().email().max(320),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar a solicitação." },
      { status: 400 },
    );
  }

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Indique um e-mail, nome e sobrenome válidos." },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  if (!authRequestLimiter(request, email).allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }

  try {
    // Recheck after the progressive lookup. A concurrent registration may have won the race.
    const identity = await loginEmailStatus(email);
    if (identity.exists) {
      return sendMagicLink(request, email, parsed.data.next, !identity.authLinked);
    }

    await provisionIdentity(email, parsed.data.firstName.trim(), parsed.data.lastName.trim());
    return sendMagicLink(request, email, parsed.data.next, true);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro. Tente novamente." },
      { status: 503 },
    );
  }
}

async function sendMagicLink(
  request: Request,
  email: string,
  next: string | undefined,
  shouldCreateUser: boolean,
) {
  const supabase = await createSupabaseServerClient();
  const origin = new URL(request.url).origin;
  const localOrigin = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: localOrigin
        ? new URL("/", request.url).toString()
        : callbackUrl(origin, safeRedirectPath(next)),
      shouldCreateUser,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível enviar o link de acesso. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true });
}
