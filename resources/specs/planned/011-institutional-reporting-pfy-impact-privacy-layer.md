# SPEC-011 — Institutional Reporting & PFY Impact Privacy Layer

**Status:** PLANNED — DECISION REQUIRED  
**Depends on:** SPEC-006, SPEC-009, SPEC-010  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Provide basic institutional monitoring while independently authorizing learning-data and civil-identity visibility.

## 2. Current State

Traditional institutions may see both; PFY Impact may require pseudonymous individual learning monitoring.

## 3. Problem / Gap

Reporting cannot safely ship until metrics, reporting scope, privacy and pseudonymization are explicit.

## 4. Decision

Use ReportingPolicy with independent learning-data and identity permissions; PFY Impact supports stable pseudonymous individual monitoring.

## 5. Scope

### In Scope
- ReportingPolicy;
- organization-scoped learning reporting;
- approved basic metrics;
- individual records when permitted;
- pseudonymous learner ID when identity hidden;
- authorization/RLS;
- privileged identity-access audit where required.

### Out of Scope
- advanced analytics;
- predictive risk;
- sophisticated impact studies;
- certificates;
- cross-org benchmarking;
- external BI.

## 6. Expected Behavior

Learning-authorized managers see scoped records; identity-restricted managers receive pseudonymous records without direct identity fields.

## 7. Constraints
- learning permission does not imply identity permission;
- pseudonyms do not encode civil identity;
- server/RLS enforce privacy;
- retention/identity resolution follow approved policy.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Learning and identity permissions are independently enforced.
- [ ] Identity-restricted view exposes pseudonyms, not direct identity.
- [ ] Identity-authorized view shows only permitted identity fields.
- [ ] Cross-org access is denied.
- [ ] Metrics derive from canonical Attempts/Results.
- [ ] Privacy is not client-side-only.
- [ ] MVP metric definitions are tested.

## 10. Implementation Freedom

Visualization and aggregation technology may vary after metric definitions are approved.

## 11. Knowledge Updates Required

Record ReportingPolicy, metrics, pseudonymization, retention and identity-resolution rules.

## 12. Open Questions / Blockers

BLOCKED until authoritative decisions define MVP metrics, pseudonym stability, identity-resolution authority, retention/deletion, LGPD/lawful-basis requirements and audit requirements.
