import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  selectImplementationModel,
  selectReviewModel,
} from "../../scripts/campaign/config";
import { parseAgentResult, isAcceptableForClosure } from "../../scripts/campaign/result-protocol";
import {
  startCampaign,
  runCampaignStep,
  getExpectedHead,
} from "../../scripts/campaign/orchestrator";
import type { CampaignConfig, GitState, ReviewResult } from "../../scripts/campaign/types";
import type { GitAdapter } from "../../scripts/campaign/git";
import type { OpenCodeAdapter, OpenCodeRunResult } from "../../scripts/campaign/opencode";
import {
  createInitialState,
  saveCampaignState,
  getCampaignDirectory,
  writeReport,
} from "../../scripts/campaign/state";

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

  /**
   * A GitAdapter whose reported state can change mid-test, so it can simulate
   * "clean at campaign start, then diverged after a timed-out OpenCode call".
   */
  function makeMutableGitAdapter(initial: GitState): {
    adapter: GitAdapter;
    setState: (next: GitState) => void;
  } {
    let current = initial;
    return {
      adapter: {
        getGitState: async () => current,
        verifyHead: async (expected: string) => {
          if (current.head !== expected) {
            throw new Error(`HEAD mismatch: ${current.head} !== ${expected}`);
          }
        },
        isAncestor: async () => true,
      },
      setState: (next: GitState) => {
        current = next;
      },
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

  /** OpenCode adapter stub whose run() always resolves as a timed-out execution. */
  function makeTimeoutOpenCodeAdapter(overrides: Partial<OpenCodeRunResult> = {}): OpenCodeAdapter {
    return {
      async run(model: string) {
        return {
          stdout: overrides.stdout ?? "",
          stderr: overrides.stderr ?? "",
          exitCode: overrides.exitCode ?? -1,
          model,
          startedAt: overrides.startedAt ?? new Date(),
          endedAt: overrides.endedAt ?? new Date(),
          timedOut: true,
          terminationSignal: overrides.terminationSignal ?? "SIGKILL",
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

  test("machine-readable results must match the active canonical SPEC ID", () => {
    const raw = wrapResult({
      schema: "pfy-campaign-result/v1",
      operation: "implement",
      specId: "006-exercise-attempts-activity-progress-results",
      status: "IMPLEMENTED",
      startingSha: "abc",
      endingSha: "def",
      summary: "done",
    });

    expect(() => parseAgentResult(raw, "SPEC-006")).toThrow(
      "Campaign result SPEC mismatch: expected SPEC-006, received 006-exercise-attempts-activity-progress-results",
    );
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

  describe("OpenCode timeout handling", () => {
    test("implementation timeout with unchanged HEAD and clean tree stops safely", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      // Git never advances: this is the timeout-with-no-evidence case (Case A).
      const git = makeGitAdapter(makeGitState({ head: "abc123", isClean: true }));
      const opencode = makeTimeoutOpenCodeAdapter({
        stdout: "partial stdout before timeout",
        stderr: "partial stderr before timeout",
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

      // Campaign must not remain stuck in "implementing".
      expect(report.state.phase).toBe("human_review_required");
      expect(report.state.phase).not.toBe("implementing");
      expect(report.stopped).toBe(true);
      expect(report.state.blockers.at(-1)?.type).toBe("OPENCODE TIMEOUT");
      expect(report.state.blockers.at(-1)?.reason).toContain("no repository change");
      expect(report.reason).toContain("OPENCODE TIMEOUT");
      expect(report.reason).toContain("Implementation agent exceeded");

      // Execution report must exist and preserve partial stdout/stderr,
      // even though no valid PFY_CAMPAIGN_RESULT JSON was produced.
      const dir = getCampaignDirectory(config, report.state.campaignId);
      expect(existsSync(join(dir, "implementation-execution.md"))).toBe(true);
      const executionReport = readFileSync(join(dir, "implementation-execution.md"), "utf-8");
      expect(executionReport).toContain("partial stdout before timeout");
      expect(executionReport).toContain("partial stderr before timeout");

      // No valid implementation report should be fabricated from a timed-out run.
      expect(existsSync(join(dir, "implementation-report.md"))).toBe(false);

      // A blocker report must exist as a durable artifact.
      expect(existsSync(join(dir, "blocker-report.md"))).toBe(true);
      const blockerReport = readFileSync(join(dir, "blocker-report.md"), "utf-8");
      expect(blockerReport).toContain("OPENCODE TIMEOUT");
    });

    test("implementation timeout with modified working tree is preserved and reported", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      // Clean at campaign start (preconditions must pass); the timed-out
      // OpenCode call leaves the working tree dirty (Case B) by the time Git
      // is inspected afterward.
      const { adapter: git, setState } = makeMutableGitAdapter(
        makeGitState({ head: "abc123", isClean: true }),
      );
      const opencode: OpenCodeAdapter = {
        async run() {
          setState(
            makeGitState({
              head: "abc123",
              isClean: false,
              changedFiles: ["src/foo.ts"],
              untrackedFiles: ["src/bar.ts"],
            }),
          );
          return {
            stdout: "",
            stderr: "",
            exitCode: -1,
            model: "m",
            startedAt: new Date(),
            endedAt: new Date(),
            timedOut: true,
            terminationSignal: "SIGKILL",
          };
        },
      };

      const state = await startCampaign(
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );
      let report = await runCampaignStep(
        state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );
      report = await runCampaignStep(
        report.state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );

      expect(report.state.phase).toBe("human_review_required");
      const blocker = report.state.blockers.at(-1);
      expect(blocker?.reason).toContain("working tree modified");
      expect(blocker?.reason).toContain("src/foo.ts");
      expect(blocker?.reason).toContain("src/bar.ts");
      expect(blocker?.reason).toContain("do not discard");
    });

    test("implementation timeout after new commit(s) preserves them and reports divergence", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      // Clean at campaign start; the timed-out agent produced a commit before
      // being killed, so HEAD has moved by the time Git is inspected (Case C).
      const { adapter: git, setState } = makeMutableGitAdapter(
        makeGitState({ head: "abc123", isClean: true }),
      );
      const opencode: OpenCodeAdapter = {
        async run() {
          setState(makeGitState({ head: "newcommitsha", isClean: true }));
          return {
            stdout: "",
            stderr: "",
            exitCode: -1,
            model: "m",
            startedAt: new Date(),
            endedAt: new Date(),
            timedOut: true,
            terminationSignal: "SIGKILL",
          };
        },
      };

      const state = await startCampaign(
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );
      let report = await runCampaignStep(
        state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );
      report = await runCampaignStep(
        report.state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );

      expect(report.state.phase).toBe("human_review_required");
      const blocker = report.state.blockers.at(-1);
      expect(blocker?.reason).toContain("new commit(s) exist");
      expect(blocker?.reason).toContain("currentHead=newcommitsha");
      expect(blocker?.reason).toContain("Do not reset, revert, amend, or auto-resume");
    });

    test("review-phase timeout stops safely and does not require implementing", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      const git = makeGitAdapter(makeGitState({ head: "implsha", isClean: true }));
      const opencode = makeTimeoutOpenCodeAdapter({
        stdout: "review partial stdout",
      });

      const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
      state.phase = "reviewing";
      state.implementationSha = "implsha";

      const report = await runCampaignStep(
        state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );

      expect(report.state.phase).toBe("human_review_required");
      expect(report.state.phase).not.toBe("reviewing");
      const dir = getCampaignDirectory(config, report.state.campaignId);
      expect(existsSync(join(dir, "review-execution.md"))).toBe(true);
      expect(existsSync(join(dir, "review-report.md"))).toBe(false);
      const blocker = report.state.blockers.at(-1);
      expect(blocker?.reason).toContain("Review agent exceeded");
      expect(blocker?.reason).toContain("no repository change");
    });

    test("remediation-phase timeout stops safely", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      const git = makeGitAdapter(makeGitState({ head: "implsha", isClean: true }));
      const opencode = makeTimeoutOpenCodeAdapter();

      const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
      state.phase = "remediating";
      state.implementationSha = "implsha";

      // Remediation requires a stored review report to build its prompt from.
      await writeReport(
        config,
        state.campaignId,
        "review-report.md",
        wrapResult({
          schema: "pfy-campaign-result/v1",
          operation: "review",
          specId: "SPEC-006",
          verdict: "FIX_REQUIRED",
          baseSha: "abc123",
          headSha: "implsha",
          findings: [
            { classification: "FIX_BEFORE_ACCEPTANCE", id: "F1", summary: "missing test" },
          ],
          blockers: [],
          summary: "fix needed",
        }),
      );

      const report = await runCampaignStep(
        state,
        { dryRun: false, once: false, resume: false },
        { config, opencode, git },
      );

      expect(report.state.phase).toBe("human_review_required");
      expect(report.state.phase).not.toBe("remediating");
      const dir = getCampaignDirectory(config, report.state.campaignId);
      expect(existsSync(join(dir, "remediation-1-execution.md"))).toBe(true);
      expect(existsSync(join(dir, "remediation-1-report.md"))).toBe(false);
      const blocker = report.state.blockers.at(-1);
      expect(blocker?.reason).toContain("Remediation agent exceeded");
    });

    test("resume does not silently rerun an ambiguous timed-out implementation", async () => {
      writeSpec("SPEC-006", "active");
      const config = makeConfig();
      // Git still reports HEAD at the original startingSha (Case A): the campaign
      // state after timeout is human_review_required, and resume must not treat
      // this as safe to auto-continue into another implementation attempt merely
      // because HEAD matches. Verify getExpectedHead reflects the pre-timeout
      // baseline (no phase-specific "resume as if nothing happened" branch),
      // and that the persisted state still records the timeout blocker/phase for
      // an operator to inspect before resuming.
      const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
      state.phase = "human_review_required";
      state.blockers.push({
        type: "OPENCODE TIMEOUT",
        reason: "[OPENCODE TIMEOUT] Implementation agent exceeded 60s",
      });
      state.campaignId = "resume-timeout-test";
      await saveCampaignState(config, state);

      expect(getExpectedHead(state)).toBe("abc123");

      const git = makeGitAdapter(makeGitState({ head: "abc123", isClean: true }));
      const opencode: OpenCodeAdapter = {
        async run() {
          throw new Error("must not invoke OpenCode again without human review");
        },
      };

      const resumed = await startCampaign(
        { dryRun: false, once: false, resume: true, campaignId: state.campaignId },
        { config, opencode, git },
      );
      expect(resumed.phase).toBe("human_review_required");

      // runCampaignStep on a human_review_required phase must stop, not re-run.
      const report = await runCampaignStep(
        resumed,
        { dryRun: false, once: false, resume: true, campaignId: state.campaignId },
        { config, opencode, git },
      );
      expect(report.stopped).toBe(true);
      expect(report.state.phase).toBe("human_review_required");
    });

    test("resume after a review-phase timeout compares HEAD against the implementation SHA, not startingSha", async () => {
      // Regression test: getExpectedHead previously fell through to startingSha
      // for terminal phases, which would spuriously reject a valid resume after
      // a review/remediation-phase timeout where HEAD had already legitimately
      // advanced past startingSha.
      const state = createInitialState("SPEC-006", "abc123", "ECONOMY", "m1", "m2");
      state.phase = "human_review_required";
      state.implementationSha = "implsha";
      expect(getExpectedHead(state)).toBe("implsha");

      state.remediationShas.push("remsha");
      expect(getExpectedHead(state)).toBe("remsha");
    });
  });
});
