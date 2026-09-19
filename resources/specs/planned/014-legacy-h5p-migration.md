# SPEC-014 — Legacy Learning Content Migration

**Status:** PLANNED — DECISION READY / PRODUCTION GATES REQUIRED / RECONCILIATION REQUIRED
**Depends on:** SPEC-004, SPEC-005, SPEC-007
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, `docs/ADR-001-LUMI-H5P-RUNTIME.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md` and applicable accepted ADRs

> **Reconciliation note (2026-09-19):** wording that mapped legacy H5P packages directly to PFY Activities was corrected to the ADR-002 boundary (H5P package → H5P-backed PFY Exercise). The rest of this SPEC predates the composed Activity model and still requires full reconciliation before activation (see `resources/specs/README.md`).

## 1. Purpose / Objective

Migrate the legacy WordPress H5P corpus into H5P-backed PFY Exercises with normalized libraries, sanitization and automated render verification.

Importing an H5P package does not by itself reconstruct a complete PFY Activity. Legacy Activity-composition migration and legacy Syllabus/Percurso migration remain decision-gated (see Section 12).

## 2. Current State

The spike imported 185/185 packages and demonstrated full-corpus rendering while identifying patch-order and sanitization risks.

## 3. Problem / Gap

PFY needs existing pedagogical content without WordPress runtime dependency.

## 4. Decision

Export legacy `.h5p`, inventory/normalize libraries, sanitize/import, map each imported package to an H5P-backed PFY Exercise (`PFY Exercise UUID ↔ Lumi content id` through the PFY H5P Adapter, per ADR-002), preserve legacy H5P IDs as provenance and render-verify.

## 5. Scope

### In Scope
- production corpus inventory/export;
- checksums;
- dependency/version inventory;
- patch normalization;
- trusted library installation;
- sanitized import;
- H5P package → PFY Exercise mapping;
- legacy provenance;
- assets/media;
- full render gate;
- exception/reconciliation report;
- rerunnable tooling.

### Out of Scope
- historical learner attempts/results;
- WordPress pages/config;
- automatic redesign;
- content-author library-code installation.

## 6. Expected Behavior

Every eligible legacy H5P package is imported/render-verified as an H5P-backed PFY Exercise or explicitly reported as an exception; the PFY Exercise UUID becomes canonical.

## 7. Constraints
- sanitize before persistence;
- privileged library install;
- normalize patches before bulk import;
- preserve required major/minor coexistence;
- import order cannot determine final patch state.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Production corpus count established.
- [ ] Libraries/versions inventoried.
- [ ] Highest compatible patches normalized.
- [ ] Eligible packages import or appear as exceptions.
- [ ] Legacy H5P ID provenance retained.
- [ ] Assets resolve.
- [ ] Full migrated corpus passes render gate.
- [ ] Expected/imported/rendered counts reconcile.
- [ ] Known XSS regression remains blocked.
- [ ] Rerun is predictable.

## 10. Implementation Freedom

Batching and verification harness may vary.

## 11. Knowledge Updates Required

Record final counts, library inventory, exceptions, runbook and validation evidence.

## 12. Open Questions / Blockers

Requires SPEC-005 security invariants, handling of GPL production gate, and a fresh production corpus inventory because legacy content may change.

Unresolved decisions that must not be resolved by implementation:

- `DECISION REQUIRED — LEGACY ACTIVITY COMPOSITION MIGRATION` (`docs/PRODUCT_DEFINITION.md` §23; `docs/ARCHITECTURE.md` §26; ADR-002): how legacy editorial content, media, embeds, ordering and metadata are reconstructed into composed PFY Activities. Because an Exercise belongs to exactly one Activity (SPEC-004), how imported Exercises are attached to Activities depends on this decision.
- `DECISION REQUIRED — LEGACY SYLLABUS/PERCURSO MIGRATION` (`docs/ARCHITECTURE.md` §27): extraction, Activity association, ordering, workload, level, pedagogical metadata and reconciliation.
