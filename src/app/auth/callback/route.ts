import { NextResponse } from "next/server";

import { safeRedirectPath } from "@/lib/auth/redirects";
import {
  InconsistentPfyIdentityError,
  MissingPfyIdentityError,
  reconcileAuthenticatedIdentity,
} from "@/lib/identity/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeRedirectPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (!code || url.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/auth/error?reason=invalid", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError)
    return NextResponse.redirect(new URL("/auth/error?reason=invalid", request.url));

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/error?reason=identity", request.url));
  }

  try {
    await reconcileAuthenticatedIdentity(data.user.id, data.user.email);
  } catch (identityError) {
    if (identityError instanceof MissingPfyIdentityError) {
      return NextResponse.redirect(new URL("/auth/registration-required", request.url));
    }
    await supabase.auth.signOut();
    if (identityError instanceof InconsistentPfyIdentityError) {
      return NextResponse.redirect(new URL("/auth/error?reason=identity", request.url));
    }
    return NextResponse.redirect(new URL("/auth/error?reason=identity", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
