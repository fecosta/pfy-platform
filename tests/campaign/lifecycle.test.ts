import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  closeSpecLifecycle,
  discoverActiveSpec,
  findNextPlannedSpec,
  promotePlannedSpecToActive,
} from "../../scripts/campaign/lifecycle";

describe("campaign SPEC lifecycle", () => {
  let specsRoot: string;
  let originalSpecsEnv: string | undefined;

  beforeEach(() => {
    specsRoot = mkdtempSync(join(tmpdir(), "pfy-campaign-lifecycle-"));
    mkdirSync(join(specsRoot, "active"));
    mkdirSync(join(specsRoot, "planned"));
    mkdirSync(join(specsRoot, "completed"));
    writeFileSync(
      join(specsRoot, "README.md"),
      [
        "# Specifications",
        "",
        "## Current state",
        "",
        "### Active",
        "",
        "- **SPEC-006 --- Exercise Attempts, Activity Progress & Results**",
        "  - `active/006-exercise-attempts-activity-progress-results.md`",
        "  - State: ACTIVE — IMPLEMENTATION READY.",
        "",
        "### Planned roadmap",
        "",
        "SPEC-006 is active; SPEC-007 remains the next planned roadmap item.",
        "",
        "### Completed",
        "",
      ].join("\n"),
    );
    originalSpecsEnv = process.env.PFY_CAMPAIGN_SPECS_ROOT;
    process.env.PFY_CAMPAIGN_SPECS_ROOT = specsRoot;
  });

  afterEach(() => {
    rmSync(specsRoot, { recursive: true, force: true });
    if (originalSpecsEnv === undefined) delete process.env.PFY_CAMPAIGN_SPECS_ROOT;
    else process.env.PFY_CAMPAIGN_SPECS_ROOT = originalSpecsEnv;
  });

  test("discovers numeric-prefix filenames with a canonical SPEC ID", async () => {
    writeFileSync(join(specsRoot, "active", "006-foo.md"), "# SPEC-006 — Foo\n");

    const spec = await discoverActiveSpec();

    expect(spec?.id).toBe("SPEC-006");
    expect(spec?.filePath).toBe(join(specsRoot, "active", "006-foo.md"));
  });

  test("accepts a legacy SPEC-prefixed filename without changing its canonical ID", async () => {
    writeFileSync(join(specsRoot, "active", "SPEC-006-foo.md"), "# SPEC-006 — Foo\n");

    const spec = await discoverActiveSpec();

    expect(spec?.id).toBe("SPEC-006");
  });

  test("discovers the repository's current active SPEC filename as SPEC-006", async () => {
    const fileName = "006-exercise-attempts-activity-progress-results.md";
    writeFileSync(
      join(specsRoot, "active", fileName),
      "# SPEC-006 --- Exercise Attempts, Activity Progress & Results\n",
    );

    const spec = await discoverActiveSpec();

    expect(spec?.id).toBe("SPEC-006");
    expect(spec?.title).toBe("Exercise Attempts, Activity Progress & Results");
  });

  test("discovers the repository's next planned SPEC-007 filename canonically", async () => {
    writeFileSync(
      join(specsRoot, "planned", "007-h5p-authoring-content-workflow.md"),
      "# SPEC-007 — Authoring\n",
    );

    const spec = await findNextPlannedSpec();

    expect(spec?.id).toBe("SPEC-007");
    expect(spec?.filePath).toBe(
      join(specsRoot, "planned", "007-h5p-authoring-content-workflow.md"),
    );
  });

  test("canonicalizes the documented 007-activity-authoring filename form", async () => {
    writeFileSync(
      join(specsRoot, "planned", "007-activity-authoring-h5p-content-workflow.md"),
      "# SPEC-007 — Activity Authoring\n",
    );

    expect((await findNextPlannedSpec())?.id).toBe("SPEC-007");
  });

  test("discovers the repository's current planned SPEC-007 filename canonically", async () => {
    const fileName = "007-h5p-authoring-content-workflow.md";
    writeFileSync(join(specsRoot, "planned", fileName), "# SPEC-007 — Activity Authoring\n");

    const spec = await findNextPlannedSpec();

    expect(spec?.id).toBe("SPEC-007");
    expect(spec?.filePath).toBe(join(specsRoot, "planned", fileName));
  });

  test("closes without duplicating the canonical ID or filename number", async () => {
    const fileName = "006-exercise-attempts-activity-progress-results.md";
    const activePath = join(specsRoot, "active", fileName);
    writeFileSync(activePath, "# SPEC-006 --- Exercise Attempts, Activity Progress & Results\n");
    const spec = await discoverActiveSpec();
    expect(spec).not.toBeNull();

    const moved = await closeSpecLifecycle(spec!);
    const expectedCompletedPath = join(specsRoot, "completed", fileName);
    expect(moved.to).toBe(expectedCompletedPath);
    expect(existsSync(expectedCompletedPath)).toBe(true);
    expect(
      existsSync(
        join(specsRoot, "completed", "spec-006-006-exercise-attempts-activity-progress-results.md"),
      ),
    ).toBe(false);

    const readme = readFileSync(join(specsRoot, "README.md"), "utf8");
    expect(readme).toContain(`completed/${fileName}`);
    expect(readme).toContain(
      "SPEC-006 is completed; SPEC-007 remains the next planned roadmap item.",
    );
    expect(readme).not.toContain("active/006-exercise-attempts-activity-progress-results.md");
    expect(readme).not.toMatch(/completed\/(?:spec-)?006-006-/i);
  });

  test("promotes the next planned SPEC without changing its filename", async () => {
    const fileName = "007-activity-authoring-h5p-content-workflow.md";
    const plannedPath = join(specsRoot, "planned", fileName);
    writeFileSync(plannedPath, "# SPEC-007 — Authoring\n");
    const spec = await findNextPlannedSpec();
    expect(spec?.id).toBe("SPEC-007");

    const moved = await promotePlannedSpecToActive(spec!);

    expect(moved.to).toBe(join(specsRoot, "active", fileName));
    expect(existsSync(join(specsRoot, "active", fileName))).toBe(true);
  });
});
