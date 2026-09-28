import { parseArgs } from "node:util";
import { loadConfig } from "./campaign/config";
import { createOpenCodeAdapter } from "./campaign/opencode";
import { runCampaignStep, startCampaign, type CampaignReport } from "./campaign/orchestrator";
import { createGitAdapter } from "./campaign/git";
import { discoverActiveSpec } from "./campaign/lifecycle";
import { classifyRisk } from "./campaign/risk";
import { selectImplementationModel, selectReviewModel } from "./campaign/config";

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      once: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
      "campaign-id": { type: "string" },
      config: { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const config = await loadConfig(values.config);

  if (values["dry-run"]) {
    await printDryRun(config);
    process.exit(0);
  }

  const deps = {
    config,
    opencode: createOpenCodeAdapter(config),
    git: createGitAdapter(),
  };

  const state = await startCampaign(
    {
      dryRun: false,
      once: values.once,
      resume: values.resume,
      campaignId: values["campaign-id"],
      configPath: values.config,
    },
    deps,
  );

  let report: CampaignReport = { state, stopped: false };
  let iterations = 0;
  const maxIterations = 10;

  while (!report.stopped && iterations < maxIterations) {
    iterations += 1;
    report = await runCampaignStep(
      report.state,
      {
        dryRun: false,
        once: values.once,
        resume: values.resume,
        campaignId: values["campaign-id"],
        configPath: values.config,
      },
      deps,
    );
  }

  console.log(`Campaign ${report.state.campaignId} stopped: ${report.state.phase}`);
  if (report.reason) {
    console.log(`Reason: ${report.reason}`);
  }
  if (report.nextSpec) {
    console.log(`Next eligible SPEC promoted to active: ${report.nextSpec.id}`);
  }
  if (report.state.blockers.length > 0) {
    console.log("Blockers:");
    for (const blocker of report.state.blockers) {
      console.log(`  [${blocker.type}] ${blocker.reason}`);
    }
  }

  process.exit(report.state.phase === "completed" ? 0 : 1);
}

async function printDryRun(config: Awaited<ReturnType<typeof loadConfig>>) {
  const git = await createGitAdapter().getGitState();
  const spec = await discoverActiveSpec();

  console.log("=== PFY SPEC Campaign Dry Run ===");
  console.log(`Current branch: ${git.branch}`);
  console.log(`Current HEAD: ${git.head}`);
  console.log(`Working tree clean: ${git.isClean}`);

  if (!spec) {
    console.log("No active SPEC found.");
    return;
  }

  console.log(`Active SPEC: ${spec.id} (${spec.title ?? "no title"})`);
  console.log(`SPEC file: ${spec.filePath}`);

  const risk = await classifyRisk(spec);
  const tier = process.env.PFY_CAMPAIGN_RISK_OVERRIDE ?? risk.tier;
  console.log(`Risk tier: ${tier} (${risk.reason})`);

  const implementModel = selectImplementationModel(config, tier as never);
  const reviewModel = selectReviewModel(config);
  console.log(`Implementation model: ${implementModel}`);
  console.log(`Review model: ${reviewModel}`);
  console.log(`Max remediation rounds: ${config.maxRemediationRounds}`);
  console.log(`Require independent review: ${config.requireIndependentReview}`);
  console.log(`Allow auto commits: ${config.allowAutoCommits}`);
  console.log(`Campaign report location: ${config.campaignReportLocation}`);
  console.log(
    "Next phases: preconditions -> implementation -> review -> (remediation -> re-review)* -> closure",
  );
}

function printHelp() {
  console.log(`PFY SPEC Campaign Orchestrator

Usage:
  npm run campaign -- [options]
  npm run campaign:dry-run
  npm run campaign:once
  npm run campaign:resume -- --campaign-id <id>

Options:
  --dry-run          Show planned campaign without invoking OpenCode
  --once             Stop after the current SPEC reaches a terminal state
  --resume           Resume a previously saved campaign (requires --campaign-id)
  --campaign-id <id> Campaign identifier for resume
  --config <path>    Path to campaign config JSON
  --help             Show this help

Environment:
  PFY_CAMPAIGN_RISK_OVERRIDE=ECONOMY|STANDARD|HIGH_RISK
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
