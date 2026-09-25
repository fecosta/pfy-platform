# SPEC-009 — Licensing Capacity Allocation & Entitlements

**Status:** PLANNED — DECISION READY / PRODUCT DECISION GATE  
**Depends on:** SPEC-003, SPEC-008  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Purpose / Objective

Implement provider-agnostic access semantics shared by B2C, B2B and PFY Impact.

## 2. Current State

PFY separates commercial origin from access: License -> LicenseCapacity -> SeatAllocation -> Entitlement -> User.

SPEC-004 already distinguishes publication, safe catalog discovery and Activity content access. It
classifies Activities as `free` or `entitlement_required`; SPEC-009 owns the future entitlement
evaluation required for the latter and must not treat publication or authentication alone as an
entitlement.

## 3. Problem / Gap

PFY needs durable access semantics before billing or institutional distribution can control learning access.

## 4. Decision

License represents granted access; capacity is audience-specific; allocation consumes capacity; entitlement represents effective access with validity/status/scope.

## 5. Scope

### In Scope
- License;
- audience-specific capacity;
- SeatAllocation;
- Entitlement;
- validity/status;
- manual/admin grants;
- capacity accounting;
- suspension/reactivation;
- entitlement-aware access;
- over-allocation protection.

### Out of Scope
- payment provider;
- organization contract UI;
- cofunding;
- assignments.

## 6. Expected Behavior

Authorized grants create entitlements while capacity exists. Suspension removes effective access without deleting durable relationships.

## 7. Constraints
- capacity, relationship and entitlement remain distinct;
- separate teacher/student quantities;
- no over-allocation;
- provider IDs are integration metadata only;
- server/RLS enforce access.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Separate audience capacities work.
- [ ] Allocation consumes correct capacity.
- [ ] Transactional/concurrent over-allocation is prevented.
- [ ] Entitlement validity/status controls effective access.
- [ ] Suspension blocks access without deleting relationships.
- [ ] Reactivation restores valid access.
- [ ] Manual grant works without billing provider.
- [ ] Active/expired/suspended/absent cases are tested.

## 10. Implementation Freedom

Exact status enum and service API may vary if semantics remain explicit.

## 11. Knowledge Updates Required

Document access state machine and capacity invariants.

## 12. Open Questions / Blockers

Before activation resolve B2C 10->5 downgrade allocation policy and whether v1 entitlements can scope library subsets.
