# SPEC-012 — B2C Billing Integration

**Status:** PLANNED — DECISION REQUIRED  
**Depends on:** SPEC-009  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Integrate a payment/subscription provider with PFY License/Capacity/Entitlement for teacher B2C plans.

## 2. Current State

Monthly teacher plan grants up to 5 student accesses; quarterly/annual up to 10. Billing is not access source of truth.

## 3. Problem / Gap

PFY needs automated purchase, renewal, cancellation and subscription-status synchronization.

## 4. Decision

Provider events translate into PFY access commands; provider records remain integration data.

## 5. Scope

### In Scope
- monthly/quarterly/annual products;
- checkout/subscription;
- verified webhooks;
- idempotent event processing;
- license/capacity synchronization;
- cancellation/expiration/suspension/reactivation;
- basic customer billing status;
- reconciliation tooling.

### Out of Scope
- B2B invoicing;
- reseller settlement;
- sophisticated cofunding;
- destructive teacher-student unlinking.

## 6. Expected Behavior

Purchase activates correct capacity; renewal extends access; cancellation updates entitlement while preserving relationships.

## 7. Constraints
- verify webhook signatures;
- idempotent/out-of-order-safe events;
- provider does not own learning authorization;
- relationships persist;
- downgrade follows approved policy.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Plans map to correct capacity.
- [ ] Webhooks are verified/idempotent.
- [ ] Purchase/renewal/cancellation synchronize PFY access.
- [ ] Relationships survive cancellation.
- [ ] Duplicate/out-of-order events do not corrupt state.
- [ ] Provider retry/outage can be reconciled.
- [ ] Billing secrets remain server-only.

## 10. Implementation Freedom

Provider SDK and checkout UX depend on selected provider.

## 11. Knowledge Updates Required

Record provider decision, event mapping, reconciliation and operations.

## 12. Open Questions / Blockers

BLOCKED until payment provider, 10->5 downgrade policy, cancellation/grace/refund rules and applicable Brazilian tax/invoice responsibilities are decided.
