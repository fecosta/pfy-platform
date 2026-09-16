# SPEC-013 — Legacy User Migration

**Status:** PLANNED — TECHNICAL INVESTIGATION REQUIRED  
**Depends on:** SPEC-002, SPEC-008, SPEC-009, SPEC-010 as applicable  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Migrate relevant WordPress users and meaningful profile/relationship/access provenance into canonical PFY identities without legacy authentication architecture.

## 2. Current State

Legacy data contains WordPress users/usermeta and historical membership/corporate-account systems; password hashes are not required.

## 3. Problem / Gap

Existing customers need continuity without copying plugin-specific schemas.

## 4. Decision

Use deterministic ETL with legacy provenance and reconciliation; PFY profiles activate new Supabase Auth identities through the approved flow.

## 5. Scope

### In Scope
- source inventory/export;
- field mapping;
- normalization/deduplication;
- legacy provenance;
- PFY profile import;
- approved meaningful relationships/access;
- activation flow;
- dry-run/reconciliation;
- idempotent tooling.

### Out of Scope
- password-hash migration;
- plugin configuration;
- WordPress pages/layouts;
- historical H5P progress;
- wholesale plugin-table migration.

## 6. Expected Behavior

Each accepted legacy user maps deterministically to one PFY user or a documented exception; reruns do not duplicate users.

## 7. Constraints
- legacy DB is migration input only;
- preserve source IDs;
- do not silently merge ambiguity;
- protect/minimize PII;
- support dry-run;
- no production mutation before reconciliation approval.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Source inventory/mapping documented.
- [ ] Dry-run counts/exceptions produced.
- [ ] Import is idempotent.
- [ ] Ambiguous identities are quarantined.
- [ ] No WordPress password hash required.
- [ ] Legacy provenance retained.
- [ ] Approved relationships/access map correctly.
- [ ] Reconciliation meets approved threshold.
- [ ] Retry/rollback runbook exists.

## 10. Implementation Freedom

ETL language/tooling may vary; reproducibility and correctness dominate.

## 11. Knowledge Updates Required

Add migration mapping, runbook, reconciliation evidence and cutover plan.

## 12. Open Questions / Blockers

Before activation inventory actual production user/member/corporate data and decide which legacy relationships/access states remain meaningful.
