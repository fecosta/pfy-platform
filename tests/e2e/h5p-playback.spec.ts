import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { ZipFile } from "yazl";

import { findMagicLink } from "./support/magic-link";

// SPEC-005 remediation (Finding 5 — Browser/runtime validation). This is the
// closest the repository's actual local infrastructure gets to the
// acceptance criteria "an authorized user can render an H5P-backed Exercise
// inside the Activity Learning Workspace", "Multiple H5P Exercise blocks can
// be represented/rendered within one Activity without identity collision"
// and "cross-origin integration works without weakening authorization": it
// drives a real browser against the real Next.js app AND the real isolated
// H5P runtime service (booted by playwright.config.ts on a different
// origin/port), through the real admin import HTTP route (twice, for two
// distinct Exercises in one Activity), real Supabase-backed authorization,
// and real signed, content-scoped runtime tokens embedded in <iframe src>.
//
// What this does NOT attempt (documented per SPEC-005's "smallest
// representative set" instruction rather than silently skipped):
//   - the full legacy H5P corpus / multiple content TYPES — that is
//     SPEC-014's bulk-migration validation, not SPEC-005's;
//   - a real H5P.org content-type library with actual xAPI scoring — the
//     fixture library declares no scoring semantics, matching the
//     non-scoring acceptance path explicitly called out in section 6.9.
const liveEnabled = Boolean(
  process.env.PFY_SUPABASE_URL &&
  process.env.PFY_SUPABASE_ANON_KEY &&
  process.env.PFY_SUPABASE_SERVICE_ROLE_KEY &&
  process.env.PFY_SUPABASE_INBUCKET_URL &&
  process.env.PFY_H5P_RUNTIME_SECRET &&
  process.env.PFY_H5P_ADMIN_SECRET,
);

test("authorized user renders multiple H5P-backed Exercises via the isolated runtime, across origins", async ({
  page,
  request,
}) => {
  test.skip(
    !liveEnabled,
    "requires local Supabase + Inbucket credentials and H5P runtime secrets " +
      "(PFY_SUPABASE_URL, PFY_SUPABASE_ANON_KEY, PFY_SUPABASE_SERVICE_ROLE_KEY, " +
      "PFY_SUPABASE_INBUCKET_URL, PFY_H5P_RUNTIME_SECRET, PFY_H5P_ADMIN_SECRET)",
  );

  const supabaseUrl = process.env.PFY_SUPABASE_URL!;
  const emailCaptureUrl = process.env.PFY_SUPABASE_INBUCKET_URL!;
  const admin = createClient(supabaseUrl, process.env.PFY_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const activityIds: string[] = [];
  const createdAuthUsers: string[] = [];
  const createdPfyUsers: string[] = [];
  let packagesDir: string | undefined;

  try {
    // 1. Build and import a real, minimal, non-scoring H5P package through
    //    the runtime's real admin HTTP route (proves the import pipeline
    //    end-to-end, not just unit-level).
    packagesDir = mkdtempSync(path.join(tmpdir(), "pfy-h5p-e2e-"));
    const packagePath = await buildFixturePackage(packagesDir);
    const importResponse = await request.post("http://127.0.0.1:3001/h5p/admin/import", {
      headers: { "X-PFY-H5P-Admin-Secret": process.env.PFY_H5P_ADMIN_SECRET! },
      data: { packagePath },
    });
    expect(importResponse.ok()).toBe(true);
    const importBody = (await importResponse.json()) as { contentId: string | number };
    const lumiContentId = String(importBody.contentId);

    // 2. Seed a published, free Activity with an H5P Exercise block mapped to
    //    the imported Lumi content.
    const activity = await admin
      .from("activities")
      .insert({
        title: `H5P playback E2E ${Date.now()}`,
        lifecycle: "published",
        access_policy: "free",
      })
      .select("id")
      .single();
    expect(activity.error).toBeNull();
    if (!activity.data) throw new Error("Activity fixture was not created");
    activityIds.push(activity.data.id);

    const exercise = await admin
      .from("exercises")
      .insert({ activity_id: activity.data.id, title: "H5P Exercise" })
      .select("id")
      .single();
    expect(exercise.error).toBeNull();
    if (!exercise.data) throw new Error("Exercise fixture was not created");

    const block = await admin.from("activity_blocks").insert({
      activity_id: activity.data.id,
      position: 1,
      block_type: "exercise",
      content: {},
      exercise_id: exercise.data.id,
    });
    expect(block.error).toBeNull();

    const mapping = await admin
      .from("exercise_h5p_mappings")
      .insert({ exercise_id: exercise.data.id, lumi_content_id: lumiContentId });
    expect(mapping.error).toBeNull();

    // Acceptance criterion: "Multiple H5P Exercise blocks can be
    // represented/rendered within one Activity without identity collision."
    // Import a SECOND package and map a SECOND Exercise into the same
    // Activity to prove this, not just assert it.
    const secondPackagePath = await buildFixturePackage(packagesDir);
    const secondImportResponse = await request.post("http://127.0.0.1:3001/h5p/admin/import", {
      headers: { "X-PFY-H5P-Admin-Secret": process.env.PFY_H5P_ADMIN_SECRET! },
      data: { packagePath: secondPackagePath },
    });
    expect(secondImportResponse.ok()).toBe(true);
    const secondImportBody = (await secondImportResponse.json()) as { contentId: string | number };
    const secondLumiContentId = String(secondImportBody.contentId);
    expect(secondLumiContentId).not.toBe(lumiContentId);

    const secondExercise = await admin
      .from("exercises")
      .insert({ activity_id: activity.data.id, title: "Second H5P Exercise" })
      .select("id")
      .single();
    expect(secondExercise.error).toBeNull();
    if (!secondExercise.data) throw new Error("Second Exercise fixture was not created");

    const secondBlock = await admin.from("activity_blocks").insert({
      activity_id: activity.data.id,
      position: 2,
      block_type: "exercise",
      content: {},
      exercise_id: secondExercise.data.id,
    });
    expect(secondBlock.error).toBeNull();

    const secondMapping = await admin
      .from("exercise_h5p_mappings")
      .insert({ exercise_id: secondExercise.data.id, lumi_content_id: secondLumiContentId });
    expect(secondMapping.error).toBeNull();

    // 3. Authenticate a real learner through the existing Magic Link flow
    //    (no new auth path introduced for this test).
    const email = `h5p-playback-e2e-${Date.now()}@example.com`;
    const provision = await admin.rpc("pfy_provision_identity", {
      requested_email: email,
      requested_first_name: "Playback",
      requested_last_name: "Tester",
    });
    expect(provision.error).toBeNull();
    createdPfyUsers.push(provision.data as string);

    await page.goto("/login");
    const appOrigin = new URL(page.url()).origin;
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();
    const magicLink = await findMagicLink(request, emailCaptureUrl, email, supabaseUrl);
    await page.goto(magicLink);
    await page.goto(new URL(`/atividades/${activity.data.id}`, appOrigin).toString());

    // 4. BOTH Exercise blocks must resolve to distinct cross-origin iframes
    //    pointing at the isolated runtime (port 3001), each with its own
    //    content-scoped token — no identity collision between the two
    //    Exercises in the same Activity.
    const frameLocators = page.locator('iframe[title="Exercício interativo"]');
    await expect(frameLocators).toHaveCount(2);

    const firstSrc = await frameLocators.nth(0).getAttribute("src");
    const secondSrc = await frameLocators.nth(1).getAttribute("src");
    expect(firstSrc).toBeTruthy();
    expect(secondSrc).toBeTruthy();
    expect(firstSrc).not.toBe(secondSrc);

    for (const src of [firstSrc!, secondSrc!]) {
      const frameUrl = new URL(src);
      expect(frameUrl.origin).toBe("http://localhost:3001");
      expect(frameUrl.searchParams.get("token")).toBeTruthy();
    }

    const frames = page.frameLocator('iframe[title="Exercício interativo"]');
    await expect(frames.first().locator("body")).toContainText(/./, { timeout: 15_000 });
    await expect(frames.nth(1).locator("body")).toContainText(/./, { timeout: 15_000 });

    // 5. Reload must preserve availability (acceptance criterion: "Reload
    //    preserves runtime content availability") for both Exercises.
    await page.reload();
    await expect(frameLocators).toHaveCount(2);
  } finally {
    for (const id of createdAuthUsers) await admin.auth.admin.deleteUser(id);
    if (activityIds.length > 0) await admin.from("activities").delete().in("id", activityIds);
    if (createdPfyUsers.length > 0)
      await admin
        .from("users")
        .delete()
        .in("id", [...new Set(createdPfyUsers)]);
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true });
  }
});

async function buildFixturePackage(dir: string): Promise<string> {
  const zip = new ZipFile();
  const minorVersion = Date.now() % 100000; // unique per test run
  const machineName = "H5P.E2EFixture";

  const h5pJson = {
    title: "E2E playback fixture",
    language: "en",
    mainLibrary: machineName,
    embedTypes: ["iframe"],
    license: "U",
    preloadedDependencies: [{ machineName, majorVersion: 1, minorVersion }],
  };
  const libraryJson = {
    title: "E2E Fixture",
    machineName,
    majorVersion: 1,
    minorVersion,
    patchVersion: 0,
    runnable: 1,
    license: "MIT",
  };

  zip.addBuffer(Buffer.from(JSON.stringify(h5pJson)), "h5p.json");
  zip.addBuffer(
    Buffer.from(JSON.stringify({ text: "<p>Hello from the isolated H5P runtime</p>" })),
    "content/content.json",
  );
  zip.addBuffer(
    Buffer.from(JSON.stringify(libraryJson)),
    `${machineName}-1.${minorVersion}/library.json`,
  );
  zip.addBuffer(
    Buffer.from(JSON.stringify([{ name: "text", type: "text", tags: ["p"] }])),
    `${machineName}-1.${minorVersion}/semantics.json`,
  );
  zip.end();

  const outPath = path.join(dir, "fixture.h5p");
  await new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on("end", () => {
      writeFileSync(outPath, Buffer.concat(chunks));
      resolve();
    });
    zip.outputStream.on("error", reject);
  });
  return outPath;
}
