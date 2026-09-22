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
  return (await loginEmailStatus(email)).exists;
}

export async function loginEmailStatus(email: string): Promise<{
  exists: boolean;
  authLinked: boolean;
}> {
  const admin = createIdentityAdminClient();
  const { data, error } = await admin
    .from("user_emails")
    .select("users(auth_user_id)")
    .eq("normalized_email", email)
    .maybeSingle();
  if (error) throw new Error("Unable to evaluate login email");
  const users = data?.users;
  const user = Array.isArray(users) ? users[0] : users;
  return { exists: Boolean(data), authLinked: Boolean(user?.auth_user_id) };
}

export async function provisionIdentity(
  email: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const admin = createIdentityAdminClient();
  const { data, error } = await admin.rpc("pfy_provision_identity", {
    requested_email: email,
    requested_first_name: firstName,
    requested_last_name: lastName,
  });

  if (error || typeof data !== "string") throw new Error("Unable to provision PFY identity");
  return data;
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
