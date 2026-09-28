import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  selectImplementationModel,
  selectReviewModel,
} from "../../scripts/campaign/config";
import { parseAgentResult, isAcceptableForClosure } from "../../scripts/campaign/result-protocol";
import { startCampaign, runCampaignStep } from "../../scripts/campaign/orchestrator";
import type { CampaignConfig, GitState, ReviewResult } from "../../scripts/campaign/types";
import type { GitAdapter } from "../../scripts/campaign/git";
import type { OpenCodeAdapter, OpenCodeRunResult } from "../../scripts/campaign/opencode";
import { createInitialState, saveCampaignState } from "../../scripts/campaign/state";

describe("campaign orchestrator", () => {
  let tempRoot: string;
  let specsRoot: string;
  let campaignsRoot: string;
  let originalSpecsEnv: string | undefined;

  const baseConfig: CampaignConfig = {
    models: {
      economy: "economy-model",
      standard: "standard-model",
      highRisk: "highrisk-model",
      review: "review-model",
      reviewEscalation: "escalation-model",
    },
    maxRemediationRounds: 2,
    requireIndependentReview: true,
    allowAutoCommits: true,
    autoApproveOpenCodePermissions: true,
    openCodeTimeoutSeconds: 60,
    campaignReportLocation: "",
  };

  function setupSpecDirs() {
    specsRoot = mkdtempSync(join(tmpdir(), "pfy-specs-"));
    campaignsRoot = mkdtempSync(join(tmpdir(), "pfy-campaigns-"));
    mkdirSync(join(specsRoot, "active"));
    mkdirSync(join(specsRoot, "planned"));
    mkdirSync(join(specsRoot, "completed"));
    writeFileSync(
      join(specsRoot, "README.md"),
      "# PFY Specifications\n\n### Active\n\nNo SPEC is currently active.\n\n### Completed\n\n- **SPEC-001 — Old**\n  - State: completed.\n\n### Planned roadmap\n\n1. **SPEC-006 — Next**\n",
    );
    originalSpecsEnv = process.env.PFY_CAMPAIGN_SPECS_ROOT;
    process.env.PFY_CAMPAIGN_SPECS_ROOT = specsRoot;
  }

  function teardownSpecDirs() {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(specsRoot, { recursive: true, force: true });
    rmSync(campaignsRoot, { recursive: true, force: true });
    if (originalSpecsEnv === undefined) {
      delete process.env.PFY_CAMPAIGN_SPECS_ROOT;
    } else {
      process.env.PFY_CAMPAIGN_SPECS_ROOT = originalSpecsEnv;
    }
  }

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "pfy-test-"));
    setupSpecDirs();
  });

  afterEach(() => {
    teardownSpecDirs();
  });

  function makeConfig(): CampaignConfig {
    return { ...baseConfig, campaignReportLocation: campaignsRoot };
  }

  function makeGitState(overrides: Partial<GitState> = {}): GitState {
    return {
      branch: "main",
      head: "abc123",
      isClean: true,
      changedFiles: [],
      untrackedFiles: [],
      ...overrides,
    };
  }

  function makeGitAdapter(state: GitState = makeGitState()): GitAdapter {
    return {
      getGitState: async () => state,
      verifyHead: async (expected: string) => {
        if (state.head !== expected) {
          throw new Error(`HEAD mismatch: ${state.head} !== ${expected}`);
        }
      },
      isAncestor: async () => true,
    };
  }

  function makeOpenCodeAdapter(responses: Record<string, OpenCodeRunResult>): OpenCodeAdapter {
    return {
      async run(_model: string, prompt: string) {
        const key = Object.keys(responses).find((k) => prompt.includes(`"operation": "${k}"`));
        const response = key ? responses[key] : responses.default;
        if (!response) {
          throw new Error(`No mock response for prompt: ${prompt.slice(0, 80)}`);
        }
        return {
          ...response,
          model: _model,
          startedAt: new Date(),
          endedAt: new Date(),
        };
      },
    };
  }

  function wrapResult(result: object): string {
    return `Some human text\n---PFY_CAMPAIGN_RESULT---\n${JSON.stringify(
      result,
      null,
      2,
    )}\n---END_PFY_CAMPAIGN_RESULT---`;
  }

  function writeSpec(id: string, folder: "active" | "planned") {
    writeFileSync(
      join(specsRoot, folder, `${id.toLowerCase()}-spec.md`),
      `# ${id}\n\nObjective.\n`,
    );
  }

  test("configuration validation rejects invalid config", async () => {
    const path = join(tempRoot, "bad.json");
    writeFileSync(path, JSON.stringify({ models: { economy: "" } }));
    await expect(loadConfig(path)).rejects.toThrow(/Invalid campaign config/);
  });

  test("model routing selects tier-appropriate models", () => {
    const config = makeConfig();
    expect(selectImplementationModel(config, "ECONOMY")).toBe("economy-model");
    expect(selectImplementationModel(config, "STANDARD")).toBe("standard-model");
    expect(selectImplementationModel(config, "HIGH_RISK")).toBe("highrisk-model");
    expect(selectReviewModel(config)).toBe("review-model");
  });

  test("result-block parsing extracts delimited JSON", () => {
    const raw = wrapResult({
      schema: "pfy-campaign-result/v1",
      operation: "implement",
      specId: "SPEC-006",
      status: "IMPLEMENTED",
      startingSha: "abc",
      endingSha: "def",
      commits: [],
      testsRun: [],
      checksNotRun: [],
      blockers: [],
      riskNotes: [],
      summary: "done",
    });
    const parsed = parseAgentResult(raw);
    expect(parsed.operation).toBe("implement");
    expect(parsed.specId).toBe("SPEC-006");
  });

  test("PASS flow advances to closing", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "implsha" }));
    const opencode = makeOpenCodeAdapter({
      implement: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "implement",
          specId: "SPEC-006",
          status: "IMPLEMENTED",
          startingSha: "abc123",
          endingSha: "implsha",
          commits: [{ sha: "implsha", message: "feat: impl" }],
          testsRun: ["npm test"],
          checksNotRun: [],
          blockers: [],
          riskNotes: [],
          summary: "implemented",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
      review: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "PASS",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [],
          blockers: [],
          summary: "pass",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = await startCampaign(
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );

    let report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("implementing");
    report = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("reviewing");
    report = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("closing");
  });

  test("PASS_WITH_FOLLOWUPS with no blockers advances to closing", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "implsha" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "PASS_WITH_FOLLOWUPS",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [
            {
              classification: "SAFE_FOLLOWUP",
              id: "F1",
              summary: "naming",
              affectedArea: "src/foo.ts",
            },
          ],
          blockers: [],
          summary: "pass with followups",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("closing");
  });

  test("FIX_REQUIRED triggers remediation and re-review", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "remsha" }));
    const opencode = makeOpenCodeAdapter({
      review: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "FIX_REQUIRED",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [
            {
              classification: "FIX_BEFORE_ACCEPTANCE",
              id: "F1",
              summary: "missing test",
            },
          ],
          blockers: [],
          summary: "fix needed",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
      remediate: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "remediate",
          specId: "SPEC-006",
          status: "REMEDIATED",
          startingSha: "implsha",
          endingSha: "remsha",
          findingsAddressed: [{ findingId: "F1", summary: "added test" }],
          findingsDisputed: [],
          commits: [{ sha: "remsha", message: "fix: test" }],
          testsRun: ["npm test"],
          blockers: [],
          summary: "fixed",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";

    let report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("remediating");
    expect(report.state.remediationCount).toBe(0);

    report = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("reviewing");
    expect(report.state.remediationCount).toBe(1);
    expect(report.state.remediationShas).toContain("remsha");

    // Re-review with a PASS response after remediation.
    const opencode2 = makeOpenCodeAdapter({
      review: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "PASS",
          baseSha: "abc123",
          headSha: "remsha",
          findings: [],
          blockers: [],
          summary: "pass after fix",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    report = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode: opencode2, git },
    );
    expect(report.state.phase).toBe("closing");
  });

  test("REJECT triggers remediation", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "remsha" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "REJECT",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [
            {
              classification: "MERGE_BLOCKER",
              id: "F1",
              summary: "wrong approach",
            },
          ],
          blockers: [],
          summary: "rejected",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("remediating");
  });

  test("max remediation rounds stops campaign", async () => {
    writeSpec("SPEC-006", "active");
    const config = { ...makeConfig(), maxRemediationRounds: 1 };
    const git = makeGitAdapter(makeGitState({ head: "remsha" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "FIX_REQUIRED",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [
            {
              classification: "FIX_BEFORE_ACCEPTANCE",
              id: "F1",
              summary: "missing test",
            },
          ],
          blockers: [],
          summary: "fix needed",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";
    state.remediationCount = 1;

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("human_review_required");
  });

  test("DECISION REQUIRED stops campaign", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "abc123" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "implement",
          specId: "SPEC-006",
          status: "BLOCKED",
          startingSha: "abc123",
          endingSha: "abc123",
          commits: [],
          testsRun: [],
          checksNotRun: [],
          blockers: [
            {
              type: "DECISION REQUIRED",
              reason: "Need product decision on score aggregation",
            },
          ],
          riskNotes: [],
          summary: "blocked",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = await startCampaign(
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("implementing");
    const report2 = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report2.state.phase).toBe("blocked");
    expect(report2.state.blockers[0].type).toBe("DECISION REQUIRED");
  });

  test("malformed agent JSON stops campaign", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "abc123" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: "---PFY_CAMPAIGN_RESULT---\nnot json\n---END_PFY_CAMPAIGN_RESULT---",
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = await startCampaign(
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("implementing");
    const report2 = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report2.state.phase).toBe("blocked");
    expect(report2.state.blockers[0].type).toBe("MALFORMED RESULT");
  });

  test("OpenCode non-zero exit stops campaign", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "abc123" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: "",
        stderr: "opencode crashed",
        exitCode: 1,
      } as OpenCodeRunResult,
    });

    const state = await startCampaign(
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("implementing");
    const report2 = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report2.state.phase).toBe("blocked");
    expect(report2.state.blockers[0].type).toBe("OPENCODE FAILURE");
  });

  test("Git SHA mismatch stops campaign", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "actualhead" }));
    const opencode = makeOpenCodeAdapter({
      default: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "implement",
          specId: "SPEC-006",
          status: "IMPLEMENTED",
          startingSha: "abc123",
          endingSha: "reportedhead",
          commits: [{ sha: "reportedhead", message: "feat" }],
          testsRun: [],
          checksNotRun: [],
          blockers: [],
          riskNotes: [],
          summary: "impl",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = await startCampaign(
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );

    const report = await runCampaignStep(
      state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("implementing");
    const report2 = await runCampaignStep(
      report.state,
      { dryRun: false, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report2.state.phase).toBe("blocked");
    expect(report2.state.blockers[0].type).toBe("GIT INTEGRITY");
  });

  test("resume from valid state continues", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "implsha" }));
    const opencode = makeOpenCodeAdapter({
      review: {
        stdout: wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "PASS",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [],
          blockers: [],
          summary: "pass",
        }),
        stderr: "",
        exitCode: 0,
      } as OpenCodeRunResult,
    });

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";
    state.campaignId = "resume-test";
    await saveCampaignState(config, state);

    const resumed = await startCampaign(
      { dryRun: false, once: false, resume: true, campaignId: state.campaignId },
      { config, opencode, git },
    );
    expect(resumed.campaignId).toBe("resume-test");

    const report = await runCampaignStep(
      resumed,
      { dryRun: false, once: false, resume: true, campaignId: state.campaignId },
      { config, opencode, git },
    );
    expect(report.state.phase).toBe("closing");
  });

  test("resume with divergent Git state throws", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter(makeGitState({ head: "diverged" }));
    const opencode = makeOpenCodeAdapter({});

    const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
    state.phase = "reviewing";
    state.implementationSha = "implsha";
    state.campaignId = "resume-diverged";
    await saveCampaignState(config, state);

    await expect(
      startCampaign(
        { dryRun: false, once: false, resume: true, campaignId: state.campaignId },
        { config, opencode, git },
      ),
    ).rejects.toThrow(/Resume Git mismatch/);
  });

  test("dry-run performs no execution", async () => {
    writeSpec("SPEC-006", "active");
    const config = makeConfig();
    const git = makeGitAdapter();
    let executed = false;
    const opencode: OpenCodeAdapter = {
      async run() {
        executed = true;
        throw new Error("should not run");
      },
    };

    const state = await startCampaign(
      { dryRun: true, once: false, resume: false },
      { config, opencode, git },
    );
    const report = await runCampaignStep(
      state,
      { dryRun: true, once: false, resume: false },
      { config, opencode, git },
    );
    expect(report.stopped).toBe(true);
    expect(executed).toBe(false);
  });

  test("MERGE_BLOCKER prevents closure", () => {
    const review = {
      schema: "pfy-campaign-result/v1" as const,
      operation: "review" as const,
      specId: "SPEC-006",
      verdict: "PASS_WITH_FOLLOWUPS" as const,
      baseSha: "abc",
      headSha: "def",
      findings: [
        {
          classification: "MERGE_BLOCKER" as const,
          id: "F1",
          summary: "security issue",
        },
      ],
      blockers: [],
      summary: "",
    };
    expect(isAcceptableForClosure(review as ReviewResult)).toBe(false);
  });

  test("active SPEC cannot be marked completed before review PASS", () => {
    const review = {
      schema: "pfy-campaign-result/v1" as const,
      operation: "review" as const,
      specId: "SPEC-006",
      verdict: "FIX_REQUIRED" as const,
      baseSha: "abc",
      headSha: "def",
      findings: [],
      blockers: [],
      summary: "",
    };
    expect(isAcceptableForClosure(review as ReviewResult)).toBe(false);
  });
});
