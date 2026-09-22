import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

type Profile = { first_name: string; last_name: string };

export type CanonicalPfyUser = {
  id: string;
  authUserId: string;
  profile: Profile;
};

export class MissingPfyIdentityError extends Error {
  constructor() {
    super("No canonical PFY identity owns this authenticated email");
    this.name = "MissingPfyIdentityError";
  }
}

export class InconsistentPfyIdentityError extends Error {
  constructor(message = "Authenticated identity is inconsistent") {
    super(message);
    this.name = "InconsistentPfyIdentityError";
  }
}

function createIdentityAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, PFY_SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, PFY_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function loginEmailExists(email: string): Promise<boolean> {
  const admin = createIdentityAdminClient();
  const { data, error } = await admin.rpc("pfy_login_email_exists", { submitted_email: email });
  if (error) throw new Error("Unable to evaluate login email");
  return data === true;
}

export async function reconcileAuthenticatedIdentity(authUserId: string, email: string) {
  const admin = createIdentityAdminClient();
  const { error } = await admin.rpc("pfy_link_authenticated_identity", {
    authenticated_user_id: authUserId,
    authenticated_email: email,
  });

  if (error) {
    if (error.code === "P0002") throw new MissingPfyIdentityError();
    throw new InconsistentPfyIdentityError();
  }

  const { data, error: lookupError } = await admin
    .from("users")
    .select("id, auth_user_id, profiles(first_name, last_name)")
    .eq("auth_user_id", authUserId);

  if (lookupError) throw new InconsistentPfyIdentityError();
  if (data.length === 0) throw new MissingPfyIdentityError();
  if (data.length !== 1) throw new InconsistentPfyIdentityError();

  const row = data[0];
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (row.auth_user_id !== authUserId || !profile?.first_name || !profile.last_name) {
    throw new InconsistentPfyIdentityError();
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    profile: { first_name: profile.first_name, last_name: profile.last_name },
  } satisfies CanonicalPfyUser;
}
