# SPEC-006 — Attempts & Results

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-004, SPEC-005  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Implement append-only learner Attempts and normalized Results, including H5P tracking semantics.

## 2. Current State

PFY defines one Attempt per learner execution; Result fields are nullable; H5P score provenance is `client_reported`.

## 3. Problem / Gap

Playback does not yet create durable PFY learning history.

## 4. Decision

The server creates Attempts. New executions always create distinct Attempts. H5P top-level events are normalized through an attempt-bound token/context.

## 5. Scope

### In Scope
- Attempt/Result schema;
- monotonic attempt number;
- start/completion;
- score/duration normalization;
- score provenance;
- H5P top-level event filtering;
- attempt token isolation;
- duplicate-completion protection;
- learner own-history.

### Out of Scope
- teacher monitoring;
- institutional reporting;
- historical migration;
- high-stakes score verification.

## 6. Expected Behavior

Repeating an activity preserves prior attempts. Unscored completion stores null score/pass. H5P scores are explicitly client-reported.

## 7. Constraints
- Attempts append-only.
- Browser cannot choose arbitrary Attempt IDs.
- Sub-content cannot complete parent Attempt.
- Missing score is never zero.
- Completion does not mean mastery/passing.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Repetition creates distinct Attempt.
- [ ] Previous Attempts remain unchanged.
- [ ] Attempt numbering is monotonic and concurrency-safe.
- [ ] Unscored completion preserves null score/pass.
- [ ] H5P score provenance is `client_reported`.
- [ ] Invalid token cannot update Attempt.
- [ ] Sub-content events do not complete parent.
- [ ] Duplicate completion is idempotently ignored/rejected.
- [ ] Learner sees only own history.

## 10. Implementation Freedom

Raw audit retention and derived-summary strategy may vary within approved privacy/retention policy.

## 11. Knowledge Updates Required

Document final schema, tracking flow and score semantics.

## 12. Open Questions / Blockers

Define raw xAPI retention before production if raw statements are retained.
