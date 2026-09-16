# SPEC-014 — Legacy H5P Migration

**Status:** PLANNED — DECISION READY / PRODUCTION GATES REQUIRED  
**Depends on:** SPEC-004, SPEC-005, SPEC-007  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Migrate the legacy WordPress H5P corpus into canonical PFY Activities with normalized libraries, sanitization and automated render verification.

## 2. Current State

The spike imported 185/185 packages and demonstrated full-corpus rendering while identifying patch-order and sanitization risks.

## 3. Problem / Gap

PFY needs existing pedagogical content without WordPress runtime dependency.

## 4. Decision

Export legacy `.h5p`, inventory/normalize libraries, sanitize/import, create PFY Activity mappings, preserve legacy H5P IDs and render-verify.

## 5. Scope

### In Scope
- production corpus inventory/export;
- checksums;
- dependency/version inventory;
- patch normalization;
- trusted library installation;
- sanitized import;
- Activity mapping;
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

Every eligible legacy activity is imported/render-verified or explicitly reported as an exception; PFY UUID becomes canonical.

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
