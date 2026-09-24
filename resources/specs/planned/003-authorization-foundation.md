# SPEC-003 — Authorization Foundation

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-002 — Identity & Authentication
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, completed SPEC-002 and applicable accepted ADRs

## 1. Purpose / Objective

Establish the smallest reusable server-side authorization foundation for PFY without inventing
future roles, relationships, organizations, entitlements or learning-resource policy.

SPEC-003 must make authorization decisions explicit, deny by default, relationship-capable and
independent from authentication credentials, while preserving PostgreSQL RLS as defense in depth
for critical database boundaries.

## 2. Current Verified State

SPEC-002 is completed and provides:

- application-owned canonical PFY Users;
- Profiles;
- application-owned primary login emails with normalized uniqueness;
- optional verified Supabase Auth linkage;
- server-side verified Supabase identity resolution;
- SSR session handling, logout and protected-route behavior;
- service-role-only identity provisioning and reconciliation;
- RLS protecting identity/profile data;
- positive and negative live identity/profile RLS tests.

The current server resolver can provide a verified canonical PFY User and Profile. It deliberately
does not provide or infer:

- Teacher, Student, Content Author or PFY Admin capability;
- global roles;
- organization membership;
- teacher-student relationships;
- licenses, entitlements, paid access or reporting policy;
- learning-resource authorization.

The current database contains no approved authorization-role, permission, relationship,
organization or entitlement schema.

## 3. Problem / Gap

Authentication establishes who the requester is. It does not establish what the requester may see
or do.

Future specifications need a common server-side boundary that can accept a verified canonical PFY
User, explicit action and resource/context, then return an authorization decision without trusting
browser claims or bypassing RLS through the service role.

The original planned wording was too abstract to define observable behavior. This SPEC narrows the
foundation to conventions and primitives that can be proved against the already approved Profile
boundary.

## 4. Authoritative Decisions

PFY preserves:

```text
Authentication
       ≠
Authorization
       ≠
Entitlement
```

Authorization is a server-side relational product decision layer. PostgreSQL RLS is defense in
depth for critical database boundaries, not the sole home of product semantics.

The foundation must not rely solely on a global user role. Capability decisions may later depend
on identity, relationship, organization context, resource, action, entitlement and privacy policy,
but SPEC-003 does not implement those future domains.

SPEC-003 does not create generic `roles`, `permissions`, `user_roles`, `capabilities` or
`user_permissions` tables. Current approved contracts do not require persistent authorization
state for this foundation.

## 5. Smallest Useful Foundation

SPEC-003 establishes:

- an authorization context derived from verified server state;
- an explicit authorization decision/result type;
- deny-by-default handling for unknown or incomplete decisions;
- a server-side enforcement convention for protected operations;
- extension points for resource and relationship evaluators;
- reusable positive/negative tests over the existing Profile RLS boundary.

The foundation does not need a new production resource or fake probe table. Existing Profiles are
the only current protected resource with an approved owner-access contract.

## 6. Trusted Authorization Context

The authorization context is constructed only after the supported server-side Supabase session
verification and canonical PFY User resolution succeed.

The minimum context is conceptually:

```text
AuthorizationContext
├── pfyUserId       canonical PFY User ID
└── authSubjectId   verified Supabase Auth subject
```

Profile data may be available for the authenticated shell but is not an authorization claim.

The context must not accept or derive authoritative values from:

- browser-supplied PFY User IDs;
- browser-supplied Auth IDs;
- request-body roles or capabilities;
- Supabase `user_metadata` or `app_metadata`;
- hidden form fields, query parameters or client state;
- unverified JWT claims in place of the supported server verification path.

Future relationship, organization, entitlement and resource context must be evaluated server-side
and attached by their owning specifications without changing canonical identity semantics.

## 7. Authorization Decision Contract

The implementation may choose its exact helper names, but the decision contract must be equivalent
to:

```text
authorize(context, action, resource/context)
        ↓
      allow | deny
```

The decision must be explicit and inspectable. A denied result may carry a stable internal reason
for server logging/tests, but must not expose sensitive identity or policy details to the browser.

Unknown actions, missing resource context, incomplete authorization context and evaluator errors
must deny. They must never fall through to allow.

The foundation must not equate `authenticated` with `allowed`.

## 8. Current Protected Operation

The only current positive authorization operation available without inventing future product policy
is access to the authenticated user's own Profile data and explicitly editable Profile fields.

The foundation may use this existing contract as its proof operation:

```text
resolved canonical PFY User
        ↓
own Profile resource
        ↓
explicitly permitted read/update action
        ↓
allow
```

The equivalent operation for another user's Profile must deny. No Teacher, Student, Admin,
Content Author, organization or entitlement meaning may be inferred from this operation.

For this proof operation, canonical identity may be resolved through the existing trusted
SPEC-002 identity boundary, but the Profile resource read/update used to demonstrate
authorization must execute through the ordinary authenticated Supabase server client so that
the existing Profile RLS policies remain effective.

Profile data returned incidentally by a privileged identity-resolution adapter must not be
used as a substitute for the RLS-protected resource access exercised by this proof operation.

## 9. Server Enforcement Boundary

Server code handling a protected operation must:

1. obtain the supported server-side Supabase client/session;
2. verify the authenticated identity through the existing trusted path;
3. resolve the canonical PFY User;
4. construct the authorization context server-side;
5. evaluate the explicit action/resource decision;
6. deny unless the decision is explicitly allowed;
7. perform data access through the ordinary authenticated server/database boundary where applicable;
8. retain RLS enforcement for critical data.

UI code may use an authorization result to hide or show affordances, but UI state is never the
authoritative enforcement boundary.

Authorization denial must not be implemented by creating a second authentication/session system.

## 10. Authentication and Authorization Failure Semantics

Future server code must distinguish these states:

### Unauthenticated

No verified authenticated session is available. The request has no authorization context.

### Authenticated but unresolved/inconsistent

Supabase authentication exists, but it cannot be safely resolved to exactly one canonical PFY User.
The request must fail closed and must not create authorization or entitlement state.

### Authenticated and resolved but unauthorized

A canonical PFY User exists, but the requested action/resource decision is not explicitly allowed.
The request must be denied without treating it as a login failure.

Exact HTTP status and user-facing error mapping remain implementation choices unless a later domain
SPEC defines them. The semantic distinction is mandatory.

## 11. RLS Boundary

SPEC-003 reuses the existing Profile RLS as the concrete database authorization boundary.

The existing tests already establish:

- anonymous Profile read/update denial;
- authenticated owner read/update allowance for permitted fields;
- cross-user Profile isolation;
- browser protection of identity linkage and legacy provenance;
- protected login-email ownership and directory access.

No new sample/probe table is justified. A fake authorization table would pollute the production
schema and imply unsupported product semantics.

Future domain specifications must add RLS policies only for real approved domain tables and must
pair them with server-side relational authorization. RLS policies must not be used to invent roles,
relationships or entitlements.

## 12. Service-Role Boundary

SPEC-002 uses the service role only for narrow privileged identity operations:

- provisioning a canonical identity through the approved RPC;
- controlled login-email existence/status lookup;
- verified first-auth identity reconciliation;
- trusted server-side identity resolution support.

Ordinary authorization and ordinary authenticated resource access must not use the service role to
bypass RLS and manually recreate all policy in application code.

SPEC-003 must document and test the convention that service-role clients are isolated to explicit
privileged adapters. Future domain authorization should use the ordinary authenticated server
boundary whenever the operation is subject to RLS.

## 13. Deny-by-Default Rules

The following cases must deny:

- no authenticated user;
- authenticated identity with no canonical PFY User;
- inconsistent or ambiguous identity linkage;
- missing authorization context;
- missing resource or relationship context required by the action;
- unrecognized action or capability;
- evaluator failure or policy lookup failure;
- cross-user Profile access without an approved relationship policy;
- any client-supplied role, capability or identity claim that is not independently verified.

Only an explicit server-side allow from a known policy may authorize an operation.

## 14. Persona and Capability Semantics

Product personas are not automatically database roles.

- Student and Teacher describe product personas whose capabilities and relationships are defined by
  later specifications.
- Content Author is explicitly a capability/context, not necessarily a global user role.
- Organization Manager is contextual to an authorized organization scope.
- PFY Admin capability requires an explicit future capability model.

SPEC-003 must not persist or infer any of these states. Later specifications own their concrete
relationship, organization, capability and entitlement semantics.

## 15. Future Extension Model

Future specifications extend the foundation by supplying explicit evaluators and resource context,
not by bypassing the authorization boundary.

Examples of future inputs include:

- teacher-student relationship;
- organization membership and scope;
- Content Author capability;
- PFY Admin capability;
- license/allocation/entitlement state;
- institutional reporting and privacy policy;
- learning-resource ownership or context.

Each future evaluator must define its own approved allow and deny invariants, server-side data
source, RLS policy where applicable and focused positive/negative tests.

Identity/session infrastructure from SPEC-002 remains the trusted source for canonical user context.

## 16. Database / Migration Decision

**NO DATABASE CHANGE REQUIRED** for SPEC-003 itself.

No current approved invariant requires persistent authorization schema. Existing identity/profile
tables and Profile RLS provide the only real protected resource needed to establish the foundation.

SPEC-003 must prohibit speculative authorization tables and must not add a migration. Persistent
authorization state may be introduced only by a later specification that defines the corresponding
product domain and invariant.

## 17. Security Invariants

SPEC-003 must preserve:

1. Server-side authorization is the product decision layer.
2. PostgreSQL RLS remains defense in depth for critical database boundaries.
3. Authentication does not imply authorization.
4. Authorization does not imply entitlement or paid access.
5. Canonical PFY User context comes only from verified server state.
6. Browser-supplied identity, role and capability claims are never authoritative.
7. Supabase Auth metadata is not the PFY authorization model.
8. Unknown and incomplete policy states deny by default.
9. Ordinary authorization does not use service-role RLS bypass.
10. Identity visibility and learning-data visibility remain distinct permissions.
11. Future relationship and entitlement policies must extend, not bypass, this boundary.

## 18. In Scope

- authorization context derived from verified canonical PFY User state;
- explicit allow/deny decision primitives;
- deny-by-default semantics;
- server-side enforcement conventions;
- ordinary-client versus privileged-service-role conventions;
- reuse of existing Profile RLS as the current database boundary;
- reusable authorization-focused test fixtures/helpers for anonymous, resolved and unresolved users;
- positive/negative tests for the own-Profile proof operation;
- documentation of extension requirements for later specifications.

## 19. Out of Scope

- global roles or generic RBAC tables;
- Teacher or Student capability assignment;
- Content Author capability assignment;
- PFY Admin capability model;
- teacher-student relationships;
- organizations and memberships;
- licenses, allocations, entitlements or paid-access policy;
- institutional reporting/privacy policy implementation;
- learning-resource authorization;
- role management, permission editor or organization UI;
- new production domain tables or migrations;
- changes to SPEC-002 identity, sessions, callbacks, RLS or provisioning behavior.

## 20. Required Test Coverage

### Application authorization

Tests must cover:

- unauthenticated context denies;
- authenticated but unresolved/inconsistent identity denies;
- resolved canonical PFY User context is constructed from server state;
- own-Profile permitted action allows;
- another user's Profile action denies;
- unknown action denies;
- missing resource/context denies;
- evaluator failure denies;
- browser-supplied user ID, role or capability claims are ignored;
- Auth metadata is not treated as authorization;
- authorization denial is distinct from authentication failure.

### RLS and integration

Reuse the existing local Supabase fixtures to verify:

- anonymous Profile access remains denied;
- owner Profile access remains allowed only for permitted fields;
- cross-user Profile access remains denied;
- identity linkage, provenance and login-email ownership remain browser-protected;
- service-role-only identity operations are not exposed to browser clients.
- the own-Profile proof operation performs its resource access through an authenticated
  non-service-role client and demonstrably remains subject to Profile RLS;

Do not add a fake resource solely to create a positive authorization example.

### Test harness

The implementation may add the smallest reusable fixture helpers needed to construct:

- anonymous requests;
- authenticated User A and User B contexts;
- resolved canonical PFY identities;
- unresolved/inconsistent identity states;
- own-resource allow cases;
- cross-user and missing-context deny cases.

The harness must remain test infrastructure, not a generalized policy framework or production user
directory.

## 21. Validation Requirements

At minimum:

```bash
npm run validate
npm run supabase:reset
npm run test:identity:integration
```

The implementation must also run the focused authorization tests introduced by SPEC-003. Existing
authentication E2E gates must remain green when authorization helpers affect protected surfaces.

Validation must prove that migrations remain unchanged, existing RLS policies still apply and no
service-role credential is present in browser-visible code.

Hosted validation is required only if the repository delivery process or a later deployment
contract requires it.

## 22. Implementation Freedom

Implementation may choose:

- exact authorization context and decision type names;
- function/module organization;
- whether the initial decision helper is synchronous or asynchronous;
- exact internal deny reasons;
- test fixture organization;
- exact server error mapping.

Implementation may not change:

- authentication/authorization/entitlement separation;
- verified canonical PFY User as the identity input;
- deny-by-default behavior;
- server-side policy enforcement;
- RLS defense-in-depth boundary;
- service-role isolation;
- no-schema decision for this foundation;
- future-domain ownership boundaries.

## 23. Knowledge Updates Required

After implementation and validation, reconcile only the durable knowledge necessary to describe:

- the authorization context and decision boundary;
- deny-by-default semantics;
- application authorization versus RLS responsibilities;
- service-role isolation;
- reusable security/test conventions;
- the no-migration decision.

Do not activate or close future domain specifications as part of SPEC-003.

## 24. Deferred Questions

The following remain future product/domain decisions and do not block this bounded foundation:

- what makes a user a Student or Teacher;
- how teacher-student relationships are created and revoked;
- what Content Author capability entails;
- what PFY Admin capabilities exist;
- organization membership and scope semantics;
- license, allocation and entitlement rules;
- independent learner access policy;
- institutional reporting and privacy policy;
- learning-resource ownership and contextual authorization.

Those questions must be resolved by their owning specifications before implementation of the related
authorization evaluators.

## 25. Completion Gate

SPEC-003 may move to `COMPLETED` only when:

- a verified canonical-user authorization context exists;
- explicit allow/deny decision primitives exist;
- unknown and incomplete states deny by default;
- server-side enforcement is demonstrated on the approved own-Profile proof operation;
- authentication and authorization failures remain semantically distinct;
- browser identity/role/capability claims are ignored;
- service-role access remains isolated to privileged identity adapters;
- existing Profile RLS positive/negative tests remain green;
- reusable authorization fixtures cover anonymous, resolved, unresolved and cross-user denial;
- no speculative authorization schema or migration was introduced;
- focused security tests and required validation pass;
- durable documentation reflects the verified foundation.

## 26. Implementation Readiness

The bounded authorization foundation is sufficiently defined for activation.

The activation decision is:

**READY TO ACTIVATE**

This decision does not activate SPEC-003, create authorization code or resolve future persona,
relationship, organization or entitlement semantics. Activation remains a separate governance step.
