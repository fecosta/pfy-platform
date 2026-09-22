import { createClient } from "@supabase/supabase-js";
import { test, expect, type APIRequestContext } from "@playwright/test";

const liveAuthEnabled = Boolean(
  process.env.PFY_SUPABASE_URL &&
  process.env.PFY_SUPABASE_ANON_KEY &&
  process.env.PFY_SUPABASE_SERVICE_ROLE_KEY &&
  process.env.PFY_SUPABASE_INBUCKET_URL,
);
const explicitAuthGate = process.env.PFY_AUTH_E2E === "1";

if (explicitAuthGate && !liveAuthEnabled) {
  throw new Error("Phase 2 auth E2E requires all documented Supabase and email-capture variables");
}

test("Magic Link establishes, persists, and logs out an authenticated PFY session", async ({
  page,
  request,
}) => {
  test.skip(!liveAuthEnabled, "requires local Supabase auth credentials");

  const url = process.env.PFY_SUPABASE_URL!;
  const emailCaptureUrl = process.env.PFY_SUPABASE_INBUCKET_URL!;
  const admin = createClient(url, process.env.PFY_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const email = `phase2-e2e-${Date.now()}@example.com`;
  const provision = await admin.rpc("pfy_provision_identity", {
    requested_email: email,
    requested_first_name: "Browser",
    requested_last_name: "Tester",
  });
  expect(provision.error).toBeNull();
  const pfyUserId = provision.data as string;

  try {
    await page.goto("/login");
    const appOrigin = new URL(page.url()).origin;
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Verifique o seu e-mail" })).toBeVisible();

    await expect
      .poll(async () =>
        (await request.get(new URL("/api/v1/messages", emailCaptureUrl).toString())).json(),
      )
      .toMatchObject({ total: expect.any(Number) });
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
    const authOrigin = new URL(url).origin;
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

    await page.goto(magicLink!);
    await page.goto(new URL("/protected", appOrigin).toString());
    await expect(page).toHaveURL(/\/protected$/);
    await expect(page.getByRole("heading", { name: /welcome, browser/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /welcome, browser/i })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/protected");
    await expect(page.getByRole("heading", { name: "Entre no PFY" })).toBeVisible();
  } finally {
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = users.data.users.find((user) => user.email === email);
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
    await admin.from("users").delete().eq("id", pfyUserId);
  }
});

test("new email progressively registers and completes the same Magic Link journey", async ({
  page,
  request,
}) => {
  test.skip(!liveAuthEnabled, "requires local Supabase auth credentials");

  const url = process.env.PFY_SUPABASE_URL!;
  const emailCaptureUrl = process.env.PFY_SUPABASE_INBUCKET_URL!;
  const admin = createClient(url, process.env.PFY_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const email = `phase3-e2e-${Date.now()}@example.com`;
  let pfyUserId: string | null = null;

  try {
    await page.goto("/login");
    const appOrigin = new URL(page.url()).origin;
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Nome")).toBeFocused();
    await expect(page.getByLabel("E-mail")).toHaveValue(email);
    const authUsersBeforeRegistration = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    expect(authUsersBeforeRegistration.data.users.some((user) => user.email === email)).toBe(false);
    await page.getByLabel("Nome").fill("Novo");
    await page.getByLabel("Apelido").fill("Utilizador");
    await page.getByRole("button", { name: "Registar e enviar link" }).click();
    await expect(page.getByRole("heading", { name: "Verifique o seu e-mail" })).toBeVisible();

    const emailMessage = await findMagicLink(request, emailCaptureUrl, email, url);
    await page.goto(emailMessage);
    await page.goto(new URL("/protected", appOrigin).toString());
    await expect(page.getByRole("heading", { name: /welcome, novo/i })).toBeVisible();

    const identity = await admin
      .from("user_emails")
      .select("user_id,users(auth_user_id)")
      .eq("normalized_email", email)
      .single();
    expect(identity.error).toBeNull();
    pfyUserId = identity.data?.user_id ?? null;
    expect(identity.data?.users).toBeTruthy();
    const profile = await admin
      .from("profiles")
      .select("first_name,last_name")
      .eq("user_id", pfyUserId)
      .single();
    expect(profile.data).toEqual({ first_name: "Novo", last_name: "Utilizador" });
  } finally {
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = users.data.users.find((user) => user.email === email);
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
    if (pfyUserId) await admin.from("users").delete().eq("id", pfyUserId);
  }
});

async function findMagicLink(
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
