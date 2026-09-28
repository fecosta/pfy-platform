# PFY Campaign Reports

This directory holds durable campaign state and reports produced by the SPEC campaign orchestrator.

## Tracked vs ignored

- `README.md` is tracked.
- Subdirectories (`resources/campaigns/<campaignId>/`) are ignored. They contain runtime state, logs, and agent reports.

## Per-campaign contents

Each campaign directory contains:

- `state.json` — resumable campaign state.
- `campaign.log` — concise human-readable log.
- `implementation-report.md` — raw implementation agent output.
- `implementation-execution.md` — execution metadata (exit code, model, duration).
- `review-report.md` — raw review agent output.
- `review-execution.md` — review execution metadata.
- `remediation-N-report.md` / `remediation-N-execution.md` — remediation rounds.
- `blocker-report.md` — produced when the campaign stops on a blocker.

## Lifecycle

A campaign corresponds to one active SPEC. Full-campaign mode may promote the next planned SPEC to active and start a fresh campaign. Completed campaign directories are retained as audit history.
