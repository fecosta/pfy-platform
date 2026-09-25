import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const integrationReady = Boolean(
  process.env.PFY_SUPABASE_URL &&
  process.env.PFY_SUPABASE_SERVICE_ROLE_KEY &&
  process.env.PFY_SUPABASE_ANON_KEY,
);

test.skip(!integrationReady, "requires local Supabase integration credentials");

test("anonymous Activity opening uses the existing login flow", async ({ page }) => {
  const admin = createClient(
    process.env.PFY_SUPABASE_URL!,
    process.env.PFY_SUPABASE_SERVICE_ROLE_KEY!,
  );
  const activity = await admin
    .from("activities")
    .insert({
      title: `Browser access ${Date.now()}`,
      lifecycle: "published",
      access_policy: "free",
    })
    .select("id")
    .single();
  if (activity.error || !activity.data)
    throw activity.error ?? new Error("Browser fixture was not created");
  const syllabus = await admin
    .from("syllabi")
    .insert({ title: `Empty browser Percurso ${Date.now()}`, lifecycle: "published" })
    .select("id")
    .single();
  if (syllabus.error || !syllabus.data)
    throw syllabus.error ?? new Error("Browser Percurso fixture was not created");

  try {
    await page.goto(`/atividades/${activity.data.id}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=.*atividades`));
    await expect(page.getByRole("heading", { name: "Entre no PFY" })).toBeVisible();

    await page.goto(`/percursos/${syllabus.data.id}`);
    await expect(page.getByRole("heading", { name: /Empty browser Percurso/ })).toBeVisible();
    await expect(
      page.getByText(/este percurso ainda não tem atividades publicadas/i),
    ).toBeVisible();
  } finally {
    await admin.from("syllabi").delete().eq("id", syllabus.data.id);
    await admin.from("activities").delete().eq("id", activity.data.id);
  }
});
