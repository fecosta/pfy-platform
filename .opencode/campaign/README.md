# PFY SPEC Campaign Orchestrator

Development tooling for running PFY implementation specifications through OpenCode + 9Router.

This is **not a PFY product feature**. It does not consume or renumber the functional SPEC-001…SPEC-015 roadmap.

## Purpose

Automate the proven manual workflow:

```text
implementation
→ independent review
→ remediation when necessary
→ independent re-review
→ lifecycle closure
→ next eligible SPEC
```

while preserving human decision gates and repository authority.

## Authority

The orchestrator controls **process**, not **product decisions**. Product authority remains:

```text
approved product decisions
→ PRODUCT_DEFINITION
→ accepted ADRs / architecture
→ active SPEC
→ implementation prompt
→ UX reference
→ implementation convenience
```

The orchestrator never asks a model to resolve a product decision merely to continue the campaign.

## Prerequisites

- Node.js 22.x and npm 10.x (same as the PFY application).
- OpenCode CLI installed and available on `PATH`.
- 9Router configured with credentials in your local environment (never committed).
- One active SPEC in `resources/specs/active/`.

## Configuration

Configuration lives in `.opencode/campaign/config.json`:

```json
{
  "models": {
    "economy": "9router/ocg/kimi-k2.7-code",
    "standard": "9router/ocg/kimi-k2.7-code",
    "highRisk": "9router/cc/claude-sonnet-5",
    "review": "9router/cx/gpt-5.6-luna-review",
    "reviewEscalation": "9router/cx/gpt-5.6-sol-review"
  },
  "maxRemediationRounds": 2,
  "requireIndependentReview": true,
  "allowAutoCommits": false,
  "autoApproveOpenCodePermissions": true,
  "openCodeTimeoutSeconds": 1800,
  "campaignReportLocation": "resources/campaigns"
}
```

- `models.*`: 9Router model routes. These are runtime defaults, not permanent architecture.
- `maxRemediationRounds`: maximum remediation/re-review loops before human review is required.
- `requireIndependentReview`: when true, implementation alone cannot complete a SPEC.
- `allowAutoCommits`: when false, the orchestrator stops before lifecycle closure and requires a human to commit.
- `autoApproveOpenCodePermissions`: passes `--auto` to `opencode run` so the campaign can run unattended.
- `openCodeTimeoutSeconds`: per-agent timeout.
- `campaignReportLocation`: root directory for campaign state and reports.

Environment variables:

- `PFY_CAMPAIGN_RISK_OVERRIDE=ECONOMY|STANDARD|HIGH_RISK`: explicit risk tier override.
- `PFY_CAMPAIGN_SPECS_ROOT`: used by tests to point to a temporary specs tree.

## Commands

```bash
# Show what the campaign would do without invoking OpenCode
npm run campaign:dry-run

# Run one SPEC and stop at completion, blocker, failure, or human-review-required
npm run campaign:once

# Resume a previously saved campaign
npm run campaign -- --resume --campaign-id <id>

# Run a full campaign (continues to next planned SPEC after closure)
npm run campaign
```

## Risk routing

The orchestrator determines the implementation model tier:

- `ECONOMY`: default, uses `models.economy`.
- `STANDARD`: medium-risk domain work, uses `models.standard`.
- `HIGH_RISK`: authentication, authorization, RLS, billing, licensing, migrations, H5P executable-library installation, sensitive legacy data, institutional privacy, untrusted content ingestion.

Risk is determined by explicit override first, then deterministic keyword rules based on the SPEC filename and content, then default economy.

## Lifecycle flow

```text
planned -> active -> implemented_review_required -> completed
```

Implementation agents are instructed to leave the SPEC active. After a review verdict of `PASS` or `PASS_WITH_FOLLOWUPS` with no `MERGE_BLOCKER` or `FIX_BEFORE_ACCEPTANCE` findings, the closure step:

1. moves the SPEC file `active/` → `completed/`;
2. updates `resources/specs/README.md`;
3. records the closure.

If lifecycle reconciliation requires judgment beyond mechanical documentation updates, the orchestrator stops.

## Review verdicts

- `PASS`: eligible for closure.
- `PASS_WITH_FOLLOWUPS`: eligible for closure only if no blocking findings exist.
- `FIX_REQUIRED`: remediation required.
- `REJECT`: remediation or escalation according to policy.
- `REVIEW_INCOMPLETE`: stop; do not complete.

Finding classifications:

- `MERGE_BLOCKER`: never complete until resolved and re-reviewed.
- `FIX_BEFORE_ACCEPTANCE`: never complete until resolved and re-reviewed.
- `SAFE_FOLLOWUP`: may be recorded without blocking closure.
- `INFORMATIONAL`: may be recorded without blocking closure.

## Decision gates

The orchestrator stops for:

- `DECISION REQUIRED` / `BLOCKED / DECISION REQUIRED`;
- `TECHNICAL INVESTIGATION REQUIRED`;
- `EXTERNAL DEPENDENCY REQUIRED`;
- `DEPENDENCY NOT YET SATISFIED`;
- review failure after max remediation rounds;
- OpenCode failure;
- malformed machine-readable agent response;
- Git integrity mismatch;
- unsupported lifecycle state;
- configuration failure;
- unknown model/provider execution failure;
- uncommitted-change ambiguity;
- lifecycle reconciliation requiring product judgment.

## Resume

Campaign state is persisted to `resources/campaigns/<campaignId>/state.json`. On resume, the orchestrator verifies that the current Git HEAD matches the expected SHA. If Git state has diverged, it stops with an explanation.

## Security

- No API keys, 9Router credentials, or Supabase secrets are stored in repository configuration.
- OpenCode is invoked with argument arrays, not interpolated shell strings.
- Subprocess environment passes through unchanged; credential values are never logged.
- Git safeguards record base/ending SHAs and detect mismatches.
- Independent review is required before lifecycle closure.
- Implementation agents are forbidden from completing their own SPEC.

## Reports

Each campaign directory contains:

- `state.json` — resumable campaign state.
- `campaign.log` — concise log.
- `implementation-report.md` — raw implementation agent output.
- `implementation-execution.md` — execution metadata.
- `review-report.md` — raw review agent output.
- `review-execution.md` — review execution metadata.
- `remediation-N-report.md` / `remediation-N-execution.md` — remediation rounds.
- `blocker-report.md` — produced when stopped on a blocker.

## Changing models

Edit `.opencode/campaign/config.json`. 9Router/model availability is runtime infrastructure and does not define PFY product architecture. The orchestrator validates configuration before launching agents.

## First-use recommendation

Do not start a full roadmap campaign immediately.

1. Run `npm run campaign:dry-run`.
2. Run a controlled single-SPEC campaign with `npm run campaign:once`.
3. Inspect generated review/remediation artifacts.
4. Only then enable full-campaign mode.
