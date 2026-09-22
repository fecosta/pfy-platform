import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  InconsistentPfyIdentityError,
  MissingPfyIdentityError,
  reconcileAuthenticatedIdentity,
  type CanonicalPfyUser,
} from "@/lib/identity/server";

export type CurrentUserResult =
  | { status: "unauthenticated" }
  | { status: "resolved"; user: CanonicalPfyUser }
  | { status: "missing-domain-identity" }
  | { status: "inconsistent-identity" };

export async function resolveCurrentUser(): Promise<CurrentUserResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return { status: "unauthenticated" };
  if (!data.user.email) return { status: "inconsistent-identity" };

  try {
    return {
      status: "resolved",
      user: await reconcileAuthenticatedIdentity(data.user.id, data.user.email),
    };
  } catch (identityError) {
    if (identityError instanceof MissingPfyIdentityError) {
      return { status: "missing-domain-identity" };
    }
    if (identityError instanceof InconsistentPfyIdentityError) {
      return { status: "inconsistent-identity" };
    }
    throw identityError;
  }
}
