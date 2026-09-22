import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationEnabled = process.env.PFY_SUPABASE_INTEGRATION === "1";

describe.skipIf(!integrationEnabled)("identity foundation against local Supabase", () => {
  let admin: SupabaseClient;
  let anonymous: SupabaseClient;
  const createdAuthUsers: string[] = [];
  const createdPfyUsers: string[] = [];

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for integration tests`);
    return value;
  }

  async function createAuthFixture(email: string): Promise<{ id: string; client: SupabaseClient }> {
    const password = "Phase1-test-password-123!";
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user)
      throw result.error ?? new Error("Auth fixture was not created");
    createdAuthUsers.push(result.data.user.id);

    const client = createClient(
      requireEnv("PFY_SUPABASE_URL"),
      requireEnv("PFY_SUPABASE_ANON_KEY"),
    );
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return { id: result.data.user.id, client };
  }

  async function provision(email: string, authUserId: string | null = null): Promise<string> {
    const result = await admin.rpc("pfy_provision_identity", {
      requested_email: email,
      requested_first_name: "Phase",
      requested_last_name: "Tester",
      requested_auth_user_id: authUserId,
    });
    if (result.error || !result.data)
      throw result.error ?? new Error("PFY fixture was not provisioned");
    createdPfyUsers.push(result.data);
    return result.data;
  }

  beforeAll(() => {
    const url = requireEnv("PFY_SUPABASE_URL");
    admin = createClient(url, requireEnv("PFY_SUPABASE_SERVICE_ROLE_KEY"));
    anonymous = createClient(url, requireEnv("PFY_SUPABASE_ANON_KEY"));
  });

  afterAll(async () => {
    for (const id of createdAuthUsers) await admin.auth.admin.deleteUser(id);
    if (createdPfyUsers.length > 0) {
      await admin
        .from("users")
        .delete()
        .in("id", [...new Set(createdPfyUsers)]);
    }
  });

  it("blocks anonymous identity and profile access", async () => {
    const profileRead = await anonymous.from("profiles").select("*");
    expect(profileRead.error).toBeTruthy();

    const emailRead = await anonymous.from("user_emails").select("*");
    expect(emailRead.error).toBeTruthy();

    const identityInsert = await anonymous.from("users").insert({});
    expect(identityInsert.error).toBeTruthy();

    const profileUpdate = await anonymous
      .from("profiles")
      .update({ first_name: "Anonymous" })
      .eq("user_id", "00000000-0000-0000-0000-000000000001");
    expect(profileUpdate.error).toBeTruthy();
  });

  it("isolates owner profile access and editable fields", async () => {
    const ownerEmail = `owner-${Date.now()}@example.com`;
    const otherEmail = `other-${Date.now()}@example.com`;
    const owner = await createAuthFixture(ownerEmail);
    const other = await createAuthFixture(otherEmail);
    const ownerId = await provision(ownerEmail, owner.id);
    const otherId = await provision(otherEmail, other.id);

    const ownRead = await owner.client
      .from("profiles")
      .select("first_name,last_name")
      .eq("user_id", ownerId);
    expect(ownRead.error).toBeNull();
    expect(ownRead.data).toHaveLength(1);

    const crossRead = await owner.client.from("profiles").select("*").eq("user_id", otherId);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data).toEqual([]);

    const ownUpdate = await owner.client
      .from("profiles")
      .update({ first_name: "Updated" })
      .eq("user_id", ownerId);
    expect(ownUpdate.error).toBeNull();

    const crossUpdate = await owner.client
      .from("profiles")
      .update({ first_name: "Should not change" })
      .eq("user_id", otherId);
    expect(crossUpdate.error).toBeNull();
    expect(crossUpdate.data).toBeNull();

    const linkageUpdate = await owner.client
      .from("users")
      .update({ auth_user_id: other.id })
      .eq("id", ownerId);
    expect(linkageUpdate.error).toBeTruthy();

    const emailUpdate = await owner.client
      .from("user_emails")
      .update({ email: "changed@example.com" })
      .eq("user_id", ownerId);
    expect(emailUpdate.error).toBeTruthy();

    const provenanceUpdate = await owner.client
      .from("users")
      .update({ legacy_wp_user_id: 12345 })
      .eq("id", ownerId);
    expect(provenanceUpdate.error).toBeTruthy();
  });

  it("provisions concurrently and links a pre-auth identity safely", async () => {
    const email = `concurrent-${Date.now()}@example.com`;
    const results = await Promise.all(Array.from({ length: 4 }, () => provision(email)));
    expect(new Set(results).size).toBe(1);
    expect(await provision(` ${email.toUpperCase()} `)).toBe(results[0]);

    const preauthEmail = `preauth-${Date.now()}@example.com`;
    const activation = await createAuthFixture(preauthEmail);
    const preauthId = await provision(preauthEmail);

    const beforeLink = await admin
      .from("users")
      .select("auth_user_id")
      .eq("id", preauthId)
      .single();
    expect(beforeLink.error).toBeNull();
    if (!beforeLink.data) throw new Error("Pre-auth fixture was not found");
    expect(beforeLink.data.auth_user_id).toBeNull();

    const link = await admin.rpc("pfy_link_authenticated_identity", {
      authenticated_user_id: activation.id,
      authenticated_email: preauthEmail,
    });
    const repeatLink = await admin.rpc("pfy_link_authenticated_identity", {
      authenticated_user_id: activation.id,
      authenticated_email: preauthEmail,
    });
    expect(link.error).toBeNull();
    expect(repeatLink.error).toBeNull();
    expect(link.data).toBe(preauthId);
    expect(repeatLink.data).toBe(preauthId);

    const mismatch = await admin.rpc("pfy_link_authenticated_identity", {
      authenticated_user_id: activation.id,
      authenticated_email: `wrong-${Date.now()}@example.com`,
    });
    expect(mismatch.error).toBeTruthy();

    const authCollision = await admin.rpc("pfy_provision_identity", {
      requested_email: `another-${Date.now()}@example.com`,
      requested_first_name: "Phase",
      requested_last_name: "Tester",
      requested_auth_user_id: activation.id,
    });
    expect(authCollision.error).toBeTruthy();

    const resolved = await admin
      .from("users")
      .select("id,auth_user_id")
      .eq("id", preauthId)
      .single();
    expect(resolved.error).toBeNull();
    if (!resolved.data) throw new Error("Linked fixture was not found");
    expect(resolved.data).toEqual({ id: preauthId, auth_user_id: activation.id });
  });
});
