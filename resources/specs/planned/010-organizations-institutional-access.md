# SPEC-010 — Organizations & Institutional Access

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-003, SPEC-009  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Purpose / Objective

Implement organizations, contextual membership and institutional license distribution for Partner/Reseller, Institutional and PFY Impact.

## 2. Current State

Users may belong to multiple organizations with different contextual capabilities; capacities are audience-specific.

## 3. Problem / Gap

PFY needs organization-scoped participation without converting organization roles into global identity.

## 4. Decision

Model OrganizationMembership many-to-many. Organization type is descriptive; behavior derives primarily from contract/license/reporting policy.

## 5. Scope

### In Scope
- Organization;
- OrganizationMembership;
- contextual capabilities;
- institutional license association;
- teacher/student seat distribution;
- participant management;
- partner/institutional/impact classification;
- organization-scoped authorization.

### Out of Scope
- advanced reporting;
- payment integration;
- reseller settlement;
- sophisticated cofunding.

## 6. Expected Behavior

One user can belong to multiple organizations with different permissions; managers act only within authorized organization scope.

## 7. Constraints
- no exclusive `organization_id` ownership on User;
- no global role from membership;
- no cross-organization manager access;
- membership and entitlement remain distinct.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] User can belong to multiple organizations.
- [ ] Capabilities differ per organization.
- [ ] Manager actions are organization-scoped.
- [ ] Teacher/student capacity can be distributed separately.
- [ ] Cross-organization access is denied.
- [ ] Organization removal does not delete canonical user.
- [ ] Multi-org RLS tests pass.

## 10. Implementation Freedom

Organization type taxonomy and UI may evolve within product contracts.

## 11. Knowledge Updates Required

Document membership/capability schema and allocation flow.

## 12. Open Questions / Blockers

Confirm minimum PFY Admin organization-management capabilities before activation.
