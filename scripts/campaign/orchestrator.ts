import type { CampaignConfig } from "./types";
import type { GitAdapter } from "./git";
import {
  closeSpecLifecycle,
  discoverActiveSpec,
  findNextPlannedSpec,
  promotePlannedSpecToActive,
} from "./lifecycle";
import type { OpenCodeAdapter, OpenCodeRunResult } from "./opencode";
import {
  extractDecisionRequiredBlockers,
  isAcceptableForClosure,
  parseAgentResult,
} from "./result-protocol";
import {
  addBlocker,
  appendCampaignLog,
  createInitialState,
  getCampaignDirectory,
  loadCampaignState,
  saveCampaignState,
  writeReport,
} from "./state";
import type {
  ActiveSpec,
  CampaignOptions,
  CampaignState,
  ImplementationResult,
  RemediationResult,
  ReviewResult,
  RiskTier,
} from "./types";
import { classifyRisk, classifyRiskExplicit } from "./risk";
import { formatFindingsForPrompt, loadPromptTemplate, renderPrompt } from "./prompts";
import { selectImplementationModel, selectReviewModel } from "./config";

export interface CampaignDependencies {
  config: CampaignConfig;
  opencode: OpenCodeAdapter;
  git: GitAdapter;
}

export interface CampaignReport {
  state: CampaignState;
  stopped: boolean;
  reason?: string;
  nextSpec?: ActiveSpec;
}

export async function startCampaign(
  options: CampaignOptions,
  deps: CampaignDependencies,
): Promise<CampaignState> {
  if (options.resume) {
    if (!options.campaignId) {
      throw new Error("--resume requires --campaign-id");
    }
    const state = await loadCampaignState(deps.config, options.campaignId);
    if (!state) {
      throw new Error(`Campaign state not found: ${options.campaignId}`);
    }
    const expectedHead = getExpectedHead(state);
    const git = await deps.git.getGitState();
    if (git.head !== expectedHead) {
      throw new Error(`Resume Git mismatch: expected HEAD ${expectedHead}, found ${git.head}`);
    }
    return state;
  }

  const spec = await discoverActiveSpec();
  if (!spec) {
    throw new Error("No active SPEC found in resources/specs/active/");
  }

  const git = await deps.git.getGitState();
  const risk = await classifyRisk(spec);
  const riskTier: RiskTier = process.env.PFY_CAMPAIGN_RISK_OVERRIDE
    ? classifyRiskExplicit(process.env.PFY_CAMPAIGN_RISK_OVERRIDE)
    : risk.tier;

  const implementModel = selectImplementationModel(deps.config, riskTier);
  const reviewModel = selectReviewModel(deps.config);

  const state = createInitialState(spec.id, git.head, riskTier, implementModel, reviewModel);
  state.dryRun = options.dryRun;

  await appendCampaignLog(
    deps.config,
    state.campaignId,
    `Campaign started for ${spec.id} on ${git.branch}@${git.head} risk=${riskTier} reason=${risk.reason}`,
  );

  return state;
}

export async function runCampaignStep(
  state: CampaignState,
  options: CampaignOptions,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  if (state.dryRun) {
    return { state, stopped: true, reason: "Dry run completed" };
  }

  const spec = await discoverActiveSpec();
  if (!spec && state.phase !== "completed" && state.phase !== "blocked") {
    return {
      state,
      stopped: true,
      reason: "Active SPEC disappeared during campaign",
    };
  }

  switch (state.phase) {
    case "idle":
      return await runPreconditions(state, spec!, deps);
    case "preconditions":
      return await runImplementation(state, spec!, deps);
    case "implementing":
      return await runImplementation(state, spec!, deps);
    case "reviewing":
      return await runReview(state, spec!, deps);
    case "remediating":
      return await runRemediation(state, spec!, deps);
    case "closing":
      return await runClosure(state, spec!, options, deps);
    case "completed":
    case "blocked":
    case "failed":
    case "human_review_required":
      return { state, stopped: true };
    default:
      return {
        state,
        stopped: true,
        reason: `Unsupported campaign phase: ${state.phase}`,
      };
  }
}

async function runPreconditions(
  state: CampaignState,
  _spec: ActiveSpec,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  const git = await deps.git.getGitState();

  if (!git.isClean) {
    return stopWithBlocker(
      state,
      deps,
      "UNCOMMITTED CHANGES",
      `Working tree is not clean. Changed files: ${git.changedFiles.join(", ") || "none"}; untracked: ${git.untrackedFiles.join(", ") || "none"}. Commit or stash unrelated work before running the campaign.`,
    );
  }

  if (state.startingSha !== git.head) {
    return stopWithBlocker(
      state,
      deps,
      "GIT MISMATCH",
      `Expected HEAD ${state.startingSha}, found ${git.head}`,
    );
  }

  if (deps.config.requireIndependentReview && !deps.config.models.review) {
    return stopWithBlocker(
      state,
      deps,
      "CONFIG MISSING",
      "Independent review is required but no review model is configured",
    );
  }

  state.phase = "implementing";
  await saveCampaignState(deps.config, state);
  return { state, stopped: false };
}

async function runImplementation(
  state: CampaignState,
  spec: ActiveSpec,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  state.phase = "implementing";
  await saveCampaignState(deps.config, state);

  const template = await loadPromptTemplate("implement");
  const prompt = renderPrompt(template, {
    specId: spec.id,
    riskTier: state.riskTier,
    branch: (await deps.git.getGitState()).branch,
    startingSha: state.startingSha,
  });

  const run = await deps.opencode.run(state.models.implement, prompt);
  await writeExecutionReport(deps.config, state, "implementation", run);

  if (run.timedOut) {
    return await stopOnTimeout(
      state,
      deps,
      "implement",
      "Implementation",
      state.models.implement,
      state.startingSha,
      run,
    );
  }

  if (run.exitCode !== 0) {
    return stopWithBlocker(
      state,
      deps,
      "OPENCODE FAILURE",
      `Implementation agent exited with code ${run.exitCode}. stderr: ${run.stderr.slice(0, 500)}`,
    );
  }

  let result: ImplementationResult;
  try {
    result = parseAgentResult(run.stdout, spec.id) as ImplementationResult;
  } catch (err) {
    return stopWithBlocker(
      state,
      deps,
      "MALFORMED RESULT",
      `Could not parse implementation result: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await writeReport(deps.config, state.campaignId, "implementation-report.md", run.stdout);

  if (result.status === "BLOCKED") {
    const decisionBlockers = extractDecisionRequiredBlockers(result);
    if (decisionBlockers.length > 0) {
      state = addBlocker(
        state,
        "DECISION REQUIRED",
        decisionBlockers.map((b) => b.reason).join("; "),
      );
      state.phase = "blocked";
      await saveCampaignState(deps.config, state);
      return {
        state,
        stopped: true,
        reason: `Implementation blocked by human decision: ${decisionBlockers[0].reason}`,
      };
    }
    state.phase = "blocked";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Implementation blocked: ${result.blockers.map((b) => b.reason).join("; ")}`,
    };
  }

  if (result.status === "FAILED") {
    state.phase = "failed";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Implementation failed: ${result.summary}`,
    };
  }

  const git = await deps.git.getGitState();
  if (result.endingSha !== git.head) {
    return stopWithBlocker(
      state,
      deps,
      "GIT INTEGRITY",
      `Implementation reported ending SHA ${result.endingSha}, but HEAD is ${git.head}`,
    );
  }

  if (!(await deps.git.isAncestor(state.startingSha, result.endingSha))) {
    return stopWithBlocker(
      state,
      deps,
      "GIT INTEGRITY",
      `Implementation ending SHA ${result.endingSha} is not a descendant of starting SHA ${state.startingSha}`,
    );
  }

  state.implementationSha = result.endingSha;
  state.phase = "reviewing";
  await saveCampaignState(deps.config, state);

  return { state, stopped: false };
}

async function runReview(
  state: CampaignState,
  spec: ActiveSpec,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  state.phase = "reviewing";
  await saveCampaignState(deps.config, state);

  const headSha = state.remediationShas.at(-1) ?? state.implementationSha;
  if (!headSha) {
    return stopWithBlocker(
      state,
      deps,
      "STATE ERROR",
      "Review requested but no implementation/remediation SHA recorded",
    );
  }

  const template = await loadPromptTemplate("review");
  const prompt = renderPrompt(template, {
    specId: spec.id,
    riskTier: state.riskTier,
    baseSha: state.startingSha,
    headSha,
  });

  const run = await deps.opencode.run(state.models.review, prompt);
  await writeExecutionReport(deps.config, state, "review", run);

  if (run.timedOut) {
    return await stopOnTimeout(state, deps, "review", "Review", state.models.review, headSha, run);
  }

  if (run.exitCode !== 0) {
    return stopWithBlocker(
      state,
      deps,
      "OPENCODE FAILURE",
      `Review agent exited with code ${run.exitCode}. stderr: ${run.stderr.slice(0, 500)}`,
    );
  }

  let result: ReviewResult;
  try {
    result = parseAgentResult(run.stdout, spec.id) as ReviewResult;
  } catch (err) {
    return stopWithBlocker(
      state,
      deps,
      "MALFORMED RESULT",
      `Could not parse review result: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await writeReport(deps.config, state.campaignId, "review-report.md", run.stdout);

  state.reviewVerdicts.push(result.verdict);

  if (result.verdict === "REVIEW_INCOMPLETE") {
    state.phase = "blocked";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Review incomplete: ${result.summary}`,
    };
  }

  const decisionBlockers = extractDecisionRequiredBlockers(result);
  if (decisionBlockers.length > 0) {
    state = addBlocker(
      state,
      "DECISION REQUIRED",
      decisionBlockers.map((b) => b.reason).join("; "),
    );
    state.phase = "blocked";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Review blocked by human decision: ${decisionBlockers[0].reason}`,
    };
  }

  if (isAcceptableForClosure(result)) {
    state.phase = "closing";
    await saveCampaignState(deps.config, state);
    return { state, stopped: false };
  }

  if (state.remediationCount >= deps.config.maxRemediationRounds) {
    state.phase = "human_review_required";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Max remediation rounds (${deps.config.maxRemediationRounds}) exceeded`,
    };
  }

  state.phase = "remediating";
  await saveCampaignState(deps.config, state);
  return { state, stopped: false };
}

async function runRemediation(
  state: CampaignState,
  spec: ActiveSpec,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  state.phase = "remediating";
  state.remediationCount += 1;
  await saveCampaignState(deps.config, state);

  const implementationSha = state.implementationSha;
  if (!implementationSha) {
    return stopWithBlocker(
      state,
      deps,
      "STATE ERROR",
      "Remediation requested but no implementation SHA recorded",
    );
  }
  const startingSha = state.remediationShas.at(-1) ?? implementationSha;

  const lastReview = await loadLastReviewContent(deps.config, state);
  if (!lastReview) {
    return stopWithBlocker(
      state,
      deps,
      "STATE ERROR",
      "Remediation requested but no review report found",
    );
  }

  let review: ReviewResult;
  try {
    review = parseAgentResult(lastReview, spec.id) as ReviewResult;
  } catch (err) {
    return stopWithBlocker(
      state,
      deps,
      "STATE ERROR",
      `Could not parse stored review result: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const template = await loadPromptTemplate("remediate");
  const prompt = renderPrompt(template, {
    specId: spec.id,
    riskTier: state.riskTier,
    baseSha: state.startingSha,
    implementationSha,
    startingSha,
    reviewFindings: formatFindingsForPrompt(review.findings),
  });

  const run = await deps.opencode.run(state.models.implement, prompt);
  await writeExecutionReport(deps.config, state, `remediation-${state.remediationCount}`, run);

  if (run.timedOut) {
    return await stopOnTimeout(
      state,
      deps,
      `remediation-${state.remediationCount}`,
      "Remediation",
      state.models.implement,
      startingSha,
      run,
    );
  }

  if (run.exitCode !== 0) {
    return stopWithBlocker(
      state,
      deps,
      "OPENCODE FAILURE",
      `Remediation agent exited with code ${run.exitCode}. stderr: ${run.stderr.slice(0, 500)}`,
    );
  }

  let result: RemediationResult;
  try {
    result = parseAgentResult(run.stdout, spec.id) as RemediationResult;
  } catch (err) {
    return stopWithBlocker(
      state,
      deps,
      "MALFORMED RESULT",
      `Could not parse remediation result: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await writeReport(
    deps.config,
    state.campaignId,
    `remediation-${state.remediationCount}-report.md`,
    run.stdout,
  );

  if (result.status === "BLOCKED") {
    const decisionBlockers = extractDecisionRequiredBlockers(result);
    if (decisionBlockers.length > 0) {
      state = addBlocker(
        state,
        "DECISION REQUIRED",
        decisionBlockers.map((b) => b.reason).join("; "),
      );
      state.phase = "blocked";
      await saveCampaignState(deps.config, state);
      return {
        state,
        stopped: true,
        reason: `Remediation blocked by human decision: ${decisionBlockers[0].reason}`,
      };
    }
    state.phase = "blocked";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Remediation blocked: ${result.blockers.map((b) => b.reason).join("; ")}`,
    };
  }

  if (result.status === "FAILED") {
    state.phase = "failed";
    await saveCampaignState(deps.config, state);
    return {
      state,
      stopped: true,
      reason: `Remediation failed: ${result.summary}`,
    };
  }

  const git = await deps.git.getGitState();
  if (result.endingSha !== git.head) {
    return stopWithBlocker(
      state,
      deps,
      "GIT INTEGRITY",
      `Remediation reported ending SHA ${result.endingSha}, but HEAD is ${git.head}`,
    );
  }

  state.remediationShas.push(result.endingSha);
  state.phase = "reviewing";
  await saveCampaignState(deps.config, state);

  return { state, stopped: false };
}

async function runClosure(
  state: CampaignState,
  spec: ActiveSpec,
  options: CampaignOptions,
  deps: CampaignDependencies,
): Promise<CampaignReport> {
  state.phase = "closing";
  await saveCampaignState(deps.config, state);

  if (!deps.config.allowAutoCommits) {
    return stopWithBlocker(
      state,
      deps,
      "AUTO COMMIT DISABLED",
      "allowAutoCommits is false. Manual closure required.",
    );
  }

  if (!deps.config.requireIndependentReview) {
    return stopWithBlocker(
      state,
      deps,
      "LIFECYCLE SAFETY",
      "Independent review is disabled; lifecycle closure is not allowed by this configuration",
    );
  }

  const moved = await closeSpecLifecycle(spec);
  state.completedSpecs.push(spec.id);
  state.phase = "completed";
  await saveCampaignState(deps.config, state);

  await appendCampaignLog(
    deps.config,
    state.campaignId,
    `Closed ${spec.id}: ${moved.from} -> ${moved.to}`,
  );

  if (options.once) {
    return { state, stopped: true, reason: "Single-SPEC mode: stopping after closure" };
  }

  const next = await findNextPlannedSpec();
  if (!next) {
    return { state, stopped: true, reason: "No more planned SPECs" };
  }

  await promotePlannedSpecToActive(next);
  await appendCampaignLog(
    deps.config,
    state.campaignId,
    `Promoted ${next.id} to active for next campaign`,
  );

  return { state, stopped: true, nextSpec: next };
}

/**
 * Handle an OpenCode execution that reached its configured timeout.
 *
 * Timeout is a first-class campaign stop condition, not a Git-mismatch or
 * OpenCode-failure blocker: a timed-out agent may have made partial repository
 * changes even though it produced no valid result. This inspects Git state,
 * records the divergence class (A: no change, B: uncommitted changes,
 * C: new commits), and moves the campaign to human_review_required.
 */
async function stopOnTimeout(
  state: CampaignState,
  deps: CampaignDependencies,
  operation: string,
  agentLabel: string,
  model: string,
  expectedSha: string,
  run: OpenCodeRunResult,
): Promise<CampaignReport> {
  const durationMs = run.endedAt.getTime() - run.startedAt.getTime();
  const git = await deps.git.getGitState();

  let gitCase: string;
  let gitDetail: string;

  if (git.head === expectedSha && git.isClean) {
    gitCase = "A: no repository change";
    gitDetail = "HEAD unchanged and working tree clean. No implementation evidence was produced.";
  } else if (git.head === expectedSha && !git.isClean) {
    gitCase = "B: working tree modified, no new commit";
    gitDetail = `HEAD unchanged (${git.head}) but working tree is dirty. Changed: ${git.changedFiles.join(", ") || "none"}; untracked: ${git.untrackedFiles.join(", ") || "none"}. Changes preserved; do not discard.`;
  } else {
    const stillAncestor = await deps.git.isAncestor(expectedSha, git.head).catch(() => false);
    gitCase = "C: new commit(s) exist";
    gitDetail = `Expected SHA ${expectedSha}, current HEAD ${git.head}. Starting SHA is${stillAncestor ? "" : " NOT"} an ancestor of current HEAD. Do not reset, revert, amend, or auto-resume.`;
  }

  const reason = [
    `[OPENCODE TIMEOUT] ${agentLabel} agent exceeded ${deps.config.openCodeTimeoutSeconds}s`,
    `operation=${operation} model=${model} configuredTimeoutSeconds=${deps.config.openCodeTimeoutSeconds}`,
    `durationMs=${durationMs} terminationSignal=${run.terminationSignal ?? "unknown"}`,
    `expectedSha=${expectedSha} currentHead=${git.head} workingTreeClean=${git.isClean}`,
    `headChangedFromExpected=${git.head !== expectedSha}`,
    `gitCase=${gitCase}`,
    gitDetail,
  ].join("\n");

  state = addBlocker(state, "OPENCODE TIMEOUT", reason);
  state.phase = "human_review_required";
  await saveCampaignState(deps.config, state);
  await appendCampaignLog(deps.config, state.campaignId, `STOPPED [OPENCODE TIMEOUT]: ${reason}`);
  await writeReport(
    deps.config,
    state.campaignId,
    "blocker-report.md",
    ["# Blocker Report", "", `## OPENCODE TIMEOUT`, "", reason].join("\n"),
  );

  return {
    state,
    stopped: true,
    reason: `[OPENCODE TIMEOUT] ${agentLabel} agent exceeded ${deps.config.openCodeTimeoutSeconds}s`,
  };
}

async function stopWithBlocker(
  state: CampaignState,
  deps: CampaignDependencies,
  type: string,
  reason: string,
): Promise<CampaignReport> {
  state = addBlocker(state, type, reason);
  state.phase = "blocked";
  await saveCampaignState(deps.config, state);
  await appendCampaignLog(deps.config, state.campaignId, `STOPPED [${type}]: ${reason}`);
  return { state, stopped: true, reason: `[${type}] ${reason}` };
}

/**
 * Expected Git HEAD for the current campaign state, regardless of phase.
 *
 * This is the last SHA the campaign durably recorded: the most recent successful
 * remediation, else the implementation SHA, else the starting SHA. Before any
 * implementation/remediation attempt succeeds, implementationSha/remediationShas
 * are unset, so this correctly collapses to startingSha for idle/preconditions/
 * implementing. It also covers terminal stop phases (blocked, failed,
 * human_review_required, completed) so that a timeout during review or
 * remediation — where HEAD had already legitimately advanced past startingSha
 * before the timed-out call — is compared against the correct expected SHA on
 * resume, instead of spuriously mismatching against startingSha.
 */
function getExpectedHead(state: CampaignState): string {
  return state.remediationShas.at(-1) ?? state.implementationSha ?? state.startingSha;
}

async function loadLastReviewContent(
  config: CampaignConfig,
  state: CampaignState,
): Promise<string | null> {
  const dir = getCampaignDirectory(config, state.campaignId);
  try {
    const report = await import("node:fs/promises").then((m) =>
      m.readFile(`${dir}/review-report.md`, "utf-8"),
    );
    return report;
  } catch {
    return null;
  }
}

async function writeExecutionReport(
  config: CampaignConfig,
  state: CampaignState,
  name: string,
  run: OpenCodeRunResult,
): Promise<void> {
  const durationMs = run.endedAt.getTime() - run.startedAt.getTime();

  const content = [
    `# Execution Report: ${name}`,
    "",
    `- Model: ${run.model}`,
    `- Exit code: ${run.exitCode}`,
    `- Duration: ${durationMs}ms`,
    `- Starting SHA: ${state.startingSha}`,
    "",
    "## stderr",
    "",
    "```",
    run.stderr,
    "```",
    "",
    "## stdout",
    "",
    "```",
    run.stdout,
    "```",
  ].join("\n");

  await writeReport(config, state.campaignId, `${name}-execution.md`, content);
}

export { getExpectedHead };
