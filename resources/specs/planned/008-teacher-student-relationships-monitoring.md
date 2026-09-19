# SPEC-008 — Teacher-Student Relationships & Monitoring

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-003, SPEC-006  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Purpose / Objective

Implement invitation-based teacher-student relationships and authorized teacher access to linked student learning history.

## 2. Current State

`docs/PRODUCT_DEFINITION.md` defines pending/active/revoked and persistence independent of subscription lifecycle.

## 3. Problem / Gap

Teachers need an explicit authorization boundary for monitoring students.

## 4. Decision

An active relationship established by invitation/acceptance is required for teacher access. Knowing a student ID is insufficient.

## 5. Scope

### In Scope
- invitation creation/token;
- acceptance;
- pending/active/revoked lifecycle;
- relationship listing;
- linked student PFY learning history as defined by the canonical evidence layers (Exercise Attempts, Activity Progress, Activity Performance and Percurso progress; `docs/ARCHITECTURE.md` §15–16);
- revoke;
- authorization/RLS tests;
- persistence independent of payment.

### Out of Scope
- assignments;
- teacher personal collections;
- billing/capacity enforcement;
- institutional manager relationships.

## 6. Expected Behavior

Pending exposes no history; active grants authorized history access; revoked removes access; relationship survives later entitlement suspension.

## 7. Constraints
- invitation tokens unguessable and expiring;
- no self-authorization by student ID;
- relationship deletion is not subscription cancellation.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Teacher can invite.
- [ ] Student can accept valid invitation.
- [ ] Pending grants no history access.
- [ ] Active grants authorized history.
- [ ] Revoked removes access.
- [ ] Direct access without relationship is denied.
- [ ] Relationship survives simulated entitlement suspension.
- [ ] RLS covers lifecycle states.

## 10. Implementation Freedom

Invitation delivery channel and UI details may vary.

## 11. Knowledge Updates Required

Document final relationship lifecycle and authorization.

## 12. Open Questions / Blockers

Define invitation expiration/reissue policy before activation.

Also unresolved and relevant to this SPEC's surfaces (recorded in `resources/ux/PROTOTYPE-CONFLICTS.md`; do not implement from the prototype):

- `DECISION REQUIRED — TEACHER STUDENT GROUPING (CLASSES)` (UXC-08);
- `DECISION REQUIRED — TEACHER INFORMATION ARCHITECTURE` (UXC-19);
- `DECISION REQUIRED — CURRENT PERCURSO SEMANTICS` (UXC-14).

Prototype assignments (UXC-09) and generic learner progress percentages (UXC-10) conflict with current contracts and remain out of scope.

This SPEC still requires full reconciliation with `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and ADR-002 before activation (see `resources/specs/README.md`).
