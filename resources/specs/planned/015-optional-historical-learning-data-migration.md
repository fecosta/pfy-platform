# SPEC-015 — Optional Historical Learning Data Migration

**Status:** PLANNED — FUTURE / NOT MVP  
**Depends on:** SPEC-006, SPEC-013, SPEC-014  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Purpose / Objective

Optionally migrate selected historical H5P attempts, scores, xAPI or progress when business value justifies the complexity.

## 2. Current State

Historical learning migration is explicitly optional and not a launch blocker.

## 3. Problem / Gap

Legacy history may be useful but old semantics may not map cleanly to canonical Attempt/Result.

## 4. Decision

Do not block launch. If later approved, import only records with defined provenance and trustworthy semantic mapping.

## 5. Scope

### In Scope
- source inventory;
- mapping feasibility;
- provenance;
- selected historical Attempt/Result import;
- reconciliation;
- explicit limitations.

### Out of Scope
- launch dependency;
- fabricated scores/completion;
- raw xAPI as canonical product state.

## 6. Expected Behavior

Only semantically valid records appear and remain distinguishable as migrated history.

## 7. Constraints
- preserve nullability;
- missing score is not zero;
- do not infer mastery/pass;
- retain provenance;
- quarantine/exclude ambiguity.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Business decision approves migration.
- [ ] Source semantics documented.
- [ ] Mapping rules deterministic.
- [ ] Provenance retained.
- [ ] Ambiguity is not silently transformed.
- [ ] Reconciliation quantifies imported/excluded records.

## 10. Implementation Freedom

Migration may cover only selected historical sources.

## 11. Knowledge Updates Required

Record source coverage, mapping limitations and reconciliation.

## 12. Open Questions / Blockers

Requires explicit post-MVP value/cost decision before activation.
