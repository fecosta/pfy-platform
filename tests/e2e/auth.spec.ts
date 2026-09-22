import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const liveAuthEnabled = Boolean(
  process.env.PFY_SUPABASE_URL &&
  process.env.PFY_SUPABASE_ANON_KEY &&
  process.env.PFY_SUPABASE_SERVICE_ROLE_KEY,
);

test("Magic Link establishes, persists, and logs out an authenticated PFY session", async ({
  page,
  request,
}) => {
  test.skip(!liveAuthEnabled, "requires local Supabase auth credentials");

  const url = process.env.PFY_SUPABASE_URL!;
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
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Magic Link" }).click();
    await expect(page.getByRole("status")).toContainText("Check your email");

    await expect
      .poll(async () => (await request.get("http://127.0.0.1:56324/api/v1/messages")).json())
      .toMatchObject({ total: expect.any(Number) });
    const messages = await (await request.get("http://127.0.0.1:56324/api/v1/messages")).json();
    const message = messages.messages.find(
      (candidate: { To: { Address: string }[] }) => candidate.To[0]?.Address === email,
    );
    expect(message).toBeTruthy();
    const raw = await (
      await request.get(`http://127.0.0.1:56324/api/v1/message/${message.ID}/raw`)
    ).text();
    const decoded = raw
      .replace(/=\r?\n/g, "")
      .replace(/=3D/g, "=")
      .replace(/&amp;/g, "&");
    const magicLink = decoded.match(/http:\/\/127\.0\.0\.1:56321\/auth\/v1\/verify\?[^\s"]+/)?.[0];
    expect(magicLink).toBeTruthy();

    // The local Auth config permits 127.0.0.1, while Playwright's Next server uses localhost.
    await page.goto(
      magicLink!.replace("redirect_to=http://127.0.0.1:3000", "redirect_to=http://localhost:3000"),
    );
    await page.goto("http://127.0.0.1:3000/protected");
    await expect(page).toHaveURL(/\/protected$/);
    await expect(page.getByRole("heading", { name: /welcome, browser/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /welcome, browser/i })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/protected");
    await expect(page.getByRole("heading", { name: /sign in with a magic link/i })).toBeVisible();
  } finally {
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = users.data.users.find((user) => user.email === email);
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
    await admin.from("users").delete().eq("id", pfyUserId);
  }
});
