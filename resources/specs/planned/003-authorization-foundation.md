# SPEC-003 — Authorization Foundation

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-002  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Purpose / Objective

Establish reusable relationship-aware authorization and RLS foundations without prematurely implementing every future relationship or entitlement domain.

## 2. Current State

PFY requires authorization based on relationships, organization membership, entitlements and reporting policy rather than a single global role.

## 3. Problem / Gap

Authentication identifies a user but does not determine what that user may see or do.

## 4. Decision

Use server-side authorization as the product decision layer and PostgreSQL RLS as defense in depth. Capabilities are contextual and relational.

## 5. Scope

### In Scope
- authorization conventions/helpers;
- deny-by-default protected operations;
- RLS policy conventions;
- contextual capability primitives needed by later specs;
- positive/negative authorization test harness.

### Out of Scope
- teacher-student workflow;
- organization workflows;
- entitlements;
- institutional reporting;
- complete PFY Admin capability model.

## 6. Expected Behavior

Protected operations require explicit authorization and future relationships extend rather than bypass the foundation.

## 7. Constraints
- no client-supplied role claims as sole authority;
- no authenticated-means-allowed shortcut;
- no ordinary request authorization via service-role;
- RLS does not become the sole home of product semantics.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Protected sample operations deny by default.
- [ ] Server authorization and RLS both protect critical access.
- [ ] Positive/negative RLS tests exist.
- [ ] No global-role-only model exists.
- [ ] Service-role bypass is isolated.

## 10. Implementation Freedom

Exact helper API, policy organization and test utilities are implementation choices.

## 11. Knowledge Updates Required

Document authorization conventions and security test commands.

## 12. Open Questions / Blockers

Activate after SPEC-002 establishes the actual user/session schema.
