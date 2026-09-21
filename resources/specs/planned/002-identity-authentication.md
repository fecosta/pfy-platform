# SPEC-002 — Identity & Authentication

**Status:** PLANNED — IMPLEMENTATION READY  
**Depends on:** SPEC-001 — Application Foundation  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, accepted ADRs, approved product decisions

---

## 1. Purpose / Objective

Implement the PFY identity and authentication foundation using Supabase Auth while preserving the passwordless Magic Link experience already familiar to existing Portuguese for You users.

SPEC-002 establishes:

- canonical PFY user identities owned by the application;
- passwordless authentication through Magic Link;
- progressive self-registration through the same entry flow used for login;
- secure session creation, persistence, refresh, and logout;
- server-side resolution of the authenticated Supabase identity to exactly one canonical PFY user;
- the identity foundation required for later authorization, organization, teacher-student relationship, licensing, entitlement, migration, and learning-history specifications.

Authentication establishes **who the user is**.

It must not determine:

- what the user is allowed to do;
- whether the user is a Teacher or Student;
- whether the user belongs to an Organization;
- whether the user owns or consumes a license;
- whether the user currently has paid access.

Those concerns belong to later specifications.

---

## 2. Current State

SPEC-001 provides the validated PFY application foundation:

- Next.js 16.x;
- React 19.x;
- TypeScript;
- Supabase client infrastructure;
- Supabase Auth availability;
- PostgreSQL/Supabase migration infrastructure;
- local Supabase development environment;
- Vitest;
- Playwright;
- baseline environment validation;
- clean local database reset capability.

The current database baseline intentionally contains no PFY domain user tables.

The architecture already establishes that:

- Supabase Auth is the authentication provider;
- `auth.users` is not the canonical PFY domain user model;
- PFY domain users are application-owned;
- authentication, authorization, and entitlement are separate concerns;
- users may later participate in multiple organizations and relationships;
- legacy WordPress password hashes are not part of the new PFY authentication model.

The existing production platform primarily uses passwordless login through Magic Link.

The new platform must preserve this familiar authentication experience, particularly to avoid creating unnecessary friction for existing users during migration.

---

## 3. Problem

PFY needs a secure identity and authentication foundation before authorization, content access, licensing, organizations, teacher-student relationships, or learning history can be implemented.

The system must support both:

1. existing users who already have a PFY account; and
2. new users who do not yet have an account.

Both flows must begin from the same passwordless authentication experience.

The platform must also be capable of supporting future migration of existing WordPress users without:

- requiring them to create or remember a password;
- changing their familiar Magic Link login experience;
- creating duplicate PFY identities;
- using the WordPress user ID as the new canonical identity;
- importing WordPress password hashes into the new authentication domain.

---

## 4. Product Decision

PFY adopts a **passwordless-first authentication model based on Magic Link**.

The primary authentication entry point is an email field.

After the user submits an email address, PFY determines whether the email belongs to an existing PFY identity.

### Existing user

If the user already exists:

```text
Email
  ↓
Existing PFY identity found
  ↓
Send Magic Link
  ↓
User opens email
  ↓
User follows Magic Link
  ↓
Supabase session established
  ↓
Canonical PFY user resolved
```

No password is required.

### New user

If no PFY identity exists for the submitted email:

```text
Email
  ↓
No PFY identity found
  ↓
Expand registration form
  ↓
Request:
- First name
- Last name
  ↓
Create PFY identity
  ↓
Create/link Supabase Auth identity
  ↓
Send Magic Link
  ↓
User follows Magic Link
  ↓
Supabase session established
  ↓
Canonical PFY user resolved
```

Login and registration therefore belong to the same progressive authentication experience.

There is no separate mandatory password-based registration flow.

---

## 5. Migration Continuity

Existing PFY users must be able to access the new platform through an authentication experience materially equivalent to the current Magic Link flow.

Migration must not require legacy users to:

- create a password;
- remember an existing WordPress password;
- reset a WordPress password;
- create a second PFY account.

A legacy PFY user may exist in the new PFY domain before a corresponding Supabase Auth identity has been activated.

The architecture must therefore support the conceptual state:

```text
Legacy PFY user
      ↓
Canonical PFY User migrated
      ↓
No activated Supabase Auth identity yet
      ↓
User submits existing email
      ↓
Magic Link authentication / activation
      ↓
Supabase Auth identity securely linked
      ↓
Existing canonical PFY User preserved
```

The first authentication of a migrated user must not create a duplicate canonical PFY user.

Detailed bulk WordPress migration remains outside SPEC-002.

SPEC-002 must only establish the identity model and authentication behavior required to support that future migration safely.

---

## 6. Identity Model

PFY must maintain a clear separation between authentication identity and application identity.

Conceptually:

```text
Supabase Auth
auth.users
     │
     │ 0..1 : 1
     ▼
PFY User
     │
     │ 1 : 1
     ▼
Profile
```

A PFY User is the canonical application identity.

A Profile contains user-facing personal attributes associated with that identity.

An authenticated account that is usable inside PFY must resolve deterministically to exactly one canonical PFY User.

A PFY User may temporarily exist without an activated Supabase Auth identity when created through an approved provisioning or migration flow.

Once linked, one Supabase Auth identity must not resolve to multiple PFY Users.

---

## 7. Canonical User

The application-owned User represents stable PFY identity.

The implementation must provide an equivalent of:

```text
users

id                  UUID PRIMARY KEY
auth_user_id        UUID UNIQUE NULLABLE
legacy_wp_user_id   BIGINT UNIQUE NULLABLE
created_at
updated_at
```

Exact table and column names remain implementation freedom provided the semantics are preserved.

### Requirements

`id` is the canonical PFY user identifier.

`auth_user_id` links the PFY identity to Supabase Auth.

`auth_user_id` may initially be null for identities provisioned before authentication, including migrated legacy users.

Once established, the authentication relationship must be unique.

`legacy_wp_user_id` exists only as migration provenance.

It must not become:

- the canonical PFY identifier;
- an authentication credential;
- a client-controlled field.

---

## 8. Profile

User-facing identity attributes must be stored separately from authentication credentials.

The implementation must provide an equivalent of:

```text
profiles

user_id       UUID PRIMARY KEY / FK users.id
first_name
last_name
created_at
updated_at
```

Exact naming and optional additional technical fields remain implementation freedom.

The initial registration flow requires:

- email;
- first name;
- last name.

Email authentication identity remains governed by Supabase Auth and the identity provisioning layer.

The implementation must avoid creating competing authoritative email fields without an explicit synchronization contract.

---

## 9. Registration Behavior

Registration begins from the same email input used for login.

For an unknown email, PFY must progressively reveal the required registration fields.

The expected UX behavior is:

```text
Step 1

Email
[____________________________]

[Continue]
```

If the email belongs to an existing account:

```text
Send Magic Link
```

If the email does not belong to an existing account:

```text
Continue with registration and you will receive
the login link when registration is completed.

First name
[____________]

Last name
[____________]

Email
[user@example.com]

[Register and send login link]
```

The exact visual copy may follow the approved PFY UX and brand system.

The behavioral contract must remain unchanged.

---

## 10. Registration Semantics

Creating a PFY account establishes identity only.

Registration must **not automatically imply**:

- Teacher status;
- Student status;
- PFY Admin status;
- organization membership;
- teacher-student relationship;
- license ownership;
- license consumption;
- entitlement;
- subscription;
- paid access.

These concerns belong to later specifications.

Therefore:

```text
Account creation
      ≠
Authorization
      ≠
Entitlement
```

SPEC-002 must not introduce a global role field as a shortcut for future authorization.

---

## 11. Email Existence Resolution

The application must be able to determine whether a submitted email corresponds to an existing PFY identity in order to provide the progressive login/registration experience.

This capability must be implemented through a controlled server-side boundary.

The browser must not receive unrestricted access to:

- `auth.users`;
- the PFY user directory;
- arbitrary user lookup queries.

The implementation must minimize user-enumeration risk while preserving the approved progressive UX.

The exact API, server action, RPC, or equivalent mechanism is implementation freedom.

It must be:

- server-controlled;
- narrowly scoped;
- rate-limitable;
- safe against arbitrary user-directory enumeration.

---

## 12. Identity Provisioning

Identity provisioning must be deterministic and idempotent.

Concurrent or repeated requests for the same normalized email must not result in multiple canonical PFY users.

The implementation must safely handle races such as:

```text
Request A → register user@example.com
Request B → register user@example.com
```

The resulting state must contain one canonical identity.

Database uniqueness constraints must enforce identity invariants wherever possible rather than relying exclusively on application-level checks.

---

## 13. Email Normalization

Email identity comparison must follow one consistent normalization strategy.

The implementation must not allow trivial representation differences to create duplicate PFY identities.

Normalization behavior must be centralized and tested.

The implementation must not invent provider-specific transformations such as removing dots or `+` aliases unless explicitly required by an authoritative product decision.

---

## 14. Magic Link Authentication

Magic Link is the primary authentication method for SPEC-002.

The system must support:

- requesting a Magic Link;
- sending the Magic Link through Supabase Auth;
- completing authentication through the link;
- creating the authenticated session;
- resolving the authenticated identity to the canonical PFY User;
- safe post-authentication redirect;
- expired or invalid Magic Links;
- requesting a replacement link.

Magic Link requests must be protected against abuse through appropriate rate limiting or equivalent controls.

---

## 15. Password Authentication

Password authentication is not required by SPEC-002.

SPEC-002 must not require:

- password creation;
- password confirmation;
- password recovery;
- password reset;
- legacy WordPress password validation.

The architecture must not prevent password authentication from being introduced in the future if an explicit product decision requires it.

---

## 16. Social Authentication

Google, Apple, Facebook, or other social authentication providers are outside SPEC-002.

No social provider should be introduced merely because Supabase supports it.

Adding a social authentication method requires a future product decision or specification.

---

## 17. Session Lifecycle

Authentication sessions must use the supported Supabase SSR model for the versions installed in the repository.

The expected trust path is:

```text
Browser
   ↓
Supabase authentication cookies
   ↓
Server-side session handling / refresh
   ↓
Verified Supabase Auth identity
   ↓
Canonical PFY User resolution
   ↓
Authenticated PFY request
```

The implementation must support:

- session creation;
- persistence across navigation;
- persistence across page reload;
- secure refresh;
- server-side authenticated-user resolution;
- logout;
- rejection of unauthenticated access to protected surfaces.

Server-side authorization decisions must not trust unverified client-provided identity information.

The implementation agent must use the current supported Supabase SSR APIs available in the repository dependencies and must consult the repository-local Next.js documentation required by project governance before implementation.

---

## 18. Current User Resolution

SPEC-002 must provide a server-side application abstraction capable of resolving the current authenticated PFY user.

Conceptually:

```text
Supabase authenticated identity
        ↓
PFY identity resolver
        ↓
Canonical PFY User
        ↓
Profile
```

The resulting abstraction may expose:

- canonical PFY User ID;
- authentication subject identifier;
- profile information required by the authenticated shell.

It must not expose or infer future concepts such as:

- `isTeacher`;
- `isStudent`;
- `isAdmin`;
- organizations;
- permissions;
- licenses;
- entitlements.

Those belong to later specifications.

---

## 19. Missing Domain Identity

A valid Supabase Auth session that cannot be safely resolved to a canonical PFY User must not silently create authorization or entitlement.

The implementation must handle this state explicitly.

Where safe automatic identity reconciliation is part of the approved provisioning contract, it must be deterministic and idempotent.

Otherwise, the request must fail safely rather than inventing product state.

---

## 20. Protected Application Surface

SPEC-002 must establish at least one authenticated application surface sufficient to prove the authentication contract.

The exact route structure is implementation freedom.

Observable behavior must include:

```text
Anonymous user
      ↓
Protected surface
      ↓
Authentication required
```

and:

```text
Authenticated user
      ↓
Protected surface
      ↓
Canonical PFY identity available
```

After logout:

```text
Logged-out user
      ↓
Protected surface
      ↓
Authentication required
```

The authenticated shell must not imply future authorization, license, or entitlement behavior.

---

## 21. Row Level Security

PFY user/profile data exposed through Supabase must be protected by PostgreSQL Row Level Security.

At minimum, tests must prove:

### Anonymous access

An anonymous user cannot:

- read private PFY profiles;
- update profiles;
- create arbitrary canonical PFY identities;
- modify legacy provenance.

### Authenticated owner

An authenticated user can:

- resolve their own permitted profile data;
- read their own permitted profile data;
- update only explicitly user-editable profile attributes.

### Cross-user isolation

User A cannot:

- read User B's private profile data;
- update User B's profile;
- alter User B's identity linkage;
- alter User B's legacy provenance.

### Identity infrastructure

Browser clients must not be allowed to:

- assign arbitrary `auth_user_id` values;
- assign arbitrary `legacy_wp_user_id` values;
- bypass canonical identity provisioning;
- create identity relationships outside the approved provisioning flow.

---

## 22. Security Requirements

SPEC-002 must preserve the following security invariants:

1. Supabase service-role credentials must never be exposed to browser code.

2. Service-role credentials must never use a `NEXT_PUBLIC_*` environment variable.

3. Authentication tokens must not be manually persisted in browser `localStorage` as a replacement for the supported Supabase SSR session model.

4. Protected server surfaces must verify authenticated identity server-side.

5. Client-provided user IDs must not be trusted as proof of identity.

6. Authentication metadata must not become the PFY authorization model.

7. `user_metadata` or `app_metadata` must not be used as a shortcut for future PFY roles, relationships, licenses, or entitlements.

8. Legacy provenance fields must not be user-writable.

9. Magic Link redirects must be constrained to approved application destinations.

10. Invalid or expired authentication links must fail safely.

11. Repeated Magic Link requests must be subject to appropriate abuse protection.

12. Identity creation must be protected against duplicate and concurrent provisioning.

---

## 23. In Scope

SPEC-002 includes:

- canonical application-owned PFY User;
- Profile;
- Supabase Auth linkage;
- Magic Link login;
- progressive registration;
- first name and last name collection;
- safe email existence resolution;
- identity provisioning;
- legacy identity provenance fields;
- support for future migrated-user activation;
- session lifecycle;
- session refresh;
- logout;
- server-side current-user resolution;
- authenticated application shell;
- protected-route behavior;
- RLS for identity/profile data;
- authentication security controls;
- database tests;
- application tests;
- E2E authentication tests.

---

## 24. Out of Scope

SPEC-002 does not implement:

- WordPress bulk migration;
- historical user-data migration;
- teacher-student relationships;
- Teacher authorization;
- Student authorization;
- PFY Admin authorization;
- global application roles;
- organizations;
- organization memberships;
- licenses;
- subscriptions;
- entitlements;
- billing;
- payment gateway integration;
- activity access rules;
- H5P;
- attempts;
- learning history;
- learner level;
- pedagogical profile;
- social login;
- password authentication;
- password recovery;
- organization invitations;
- teacher invitations.

These belong to later specifications unless explicitly promoted through project governance.

---

## 25. Acceptance Criteria

### AC-01 — Canonical identity

PFY has an application-owned canonical User identity separate from `auth.users`.

---

### AC-02 — Authentication linkage

A usable authenticated PFY account resolves to exactly one canonical PFY User.

The database prevents one authentication identity from being linked to multiple PFY users.

---

### AC-03 — Existing-user Magic Link

Given an existing PFY user,

when the user submits their registered email,

then PFY sends a Magic Link without requesting registration information or a password.

---

### AC-04 — New-user progressive registration

Given an email with no existing PFY identity,

when the user submits the email,

then PFY presents the registration fields for first name and last name.

After valid registration,

one canonical PFY User is created and a Magic Link is sent.

---

### AC-05 — No password requirement

Neither existing-user login nor new-user registration requires a password.

---

### AC-06 — Successful authentication

Following a valid Magic Link establishes an authenticated Supabase session and resolves the canonical PFY User.

---

### AC-07 — Session persistence

A valid authenticated session persists across normal navigation and page reload.

---

### AC-08 — Session refresh

A valid session can be securely refreshed using the supported Supabase SSR mechanism without requiring the user to authenticate again unnecessarily.

---

### AC-09 — Logout

After logout, the previous authenticated session no longer grants access to protected PFY surfaces.

---

### AC-10 — Protected surface

An unauthenticated user cannot access the authenticated application surface.

---

### AC-11 — Invalid Magic Link

An invalid or expired Magic Link does not authenticate the user.

The UX provides a safe path to request another link.

---

### AC-12 — Duplicate registration protection

Repeated or concurrent attempts to register the same normalized email do not create multiple canonical PFY Users.

---

### AC-13 — Migrated identity compatibility

The identity model supports a canonical PFY User with legacy provenance existing before Supabase Auth activation.

When that user later authenticates through the approved activation flow, the authentication identity can be linked without replacing or duplicating the canonical PFY User.

---

### AC-14 — Profile isolation

An authenticated user can access permitted own-profile information but cannot read or modify another user's private profile.

---

### AC-15 — Protected provenance

A browser user cannot modify:

- authentication linkage;
- legacy WordPress user identifier;
- identity ownership.

---

### AC-16 — No implicit authorization

Registration and authentication do not automatically create:

- Teacher status;
- Student status;
- Admin status;
- organization membership;
- teacher-student relationship;
- license;
- entitlement.

---

### AC-17 — No global-role shortcut

SPEC-002 does not introduce a global role field or authentication-metadata shortcut that determines PFY authorization.

---

### AC-18 — Server-side current user

Server-side application code can resolve the authenticated request to the canonical PFY User and permitted profile information.

---

### AC-19 — User-directory protection

The progressive registration flow does not expose unrestricted access to the PFY user directory or Supabase `auth.users`.

---

### AC-20 — Secrets remain server-only

No privileged Supabase credentials are present in browser bundles or public environment variables.

---

## 26. Required Test Coverage

### Database / RLS

Tests must cover at minimum:

- anonymous profile read denied;
- anonymous profile update denied;
- authenticated owner profile read allowed;
- explicitly editable owner profile update allowed;
- cross-user profile read denied;
- cross-user profile update denied;
- authentication linkage protected;
- legacy provenance protected;
- duplicate identity linkage rejected;
- duplicate canonical email identity prevented according to the chosen identity model.

### Application tests

Tests must cover at minimum:

- email normalization;
- existing-user resolution;
- new-user resolution;
- current-user resolver;
- missing canonical-user handling;
- duplicate provisioning;
- invalid provisioning input;
- safe redirect handling.

### End-to-end tests

At minimum:

#### Existing user

```text
email
→ Magic Link
→ authenticated session
→ protected surface
```

#### New user

```text
email
→ registration form
→ first name + last name
→ register
→ Magic Link
→ authenticated session
→ protected surface
```

#### Duplicate registration

```text
same email
→ repeated/concurrent registration
→ one canonical PFY User
```

#### Invalid or expired link

```text
invalid/expired Magic Link
→ no authentication
→ replacement-link path available
```

#### Session persistence

```text
authenticated
→ reload
→ remains authenticated
```

#### Logout

```text
authenticated
→ logout
→ protected surface inaccessible
```

#### Anonymous protection

```text
anonymous
→ protected surface
→ authentication required
```

#### No implicit authorization

```text
new registration
→ canonical identity exists
→ no role/license/entitlement created
```

### Migration compatibility

Where feasible within SPEC-002 test fixtures:

```text
pre-existing canonical PFY User
+ legacy provenance
+ no linked Auth identity
        ↓
approved authentication activation
        ↓
Auth identity linked
        ↓
same canonical PFY User preserved
```

---

## 27. Validation Requirements

Implementation is not complete until the repository's required validation passes.

At minimum:

```bash
npm run validate
```

The Supabase database must also be reproducible from a clean local state.

At minimum:

```bash
supabase db reset --local
```

or the repository-equivalent validated command.

The clean database validation must prove that:

- migrations apply from zero;
- RLS policies are created correctly;
- identity constraints exist;
- authentication/profile tests pass against the clean schema.

Hosted validation must be performed if required by the repository's implementation and delivery process.

---

## 28. Implementation Freedom

The implementation agent may choose, without requiring a product decision:

- exact route names;
- server actions versus route handlers where behavior is equivalent;
- internal service/module organization;
- validation-library organization;
- exact database table names;
- exact database column names;
- trigger versus transactional server-side provisioning;
- internal Supabase helper structure;
- test fixture organization;
- loading-state implementation;
- exact wording of technical error messages;
- implementation details of the authenticated shell.

Implementation freedom does not permit changing:

- Magic Link as the primary authentication experience;
- progressive registration behavior;
- canonical PFY identity ownership;
- separation of authentication and authorization;
- migration-continuity requirements;
- identity uniqueness semantics;
- RLS/security requirements;
- acceptance criteria.

If implementation discovers a constraint requiring one of those contracts to change, work must return:

`BLOCKED / DECISION REQUIRED`

---

## 29. UX Freedom and Constraints

The authentication surfaces are not fully defined by the existing product prototype.

Implementation may create the minimum authentication UX necessary for this specification using the approved PFY visual system.

The UX must preserve the behavioral sequence:

```text
email
   ↓
existing?
   │
   ├── yes → Magic Link
   │
   └── no → first name + last name
                ↓
             register
                ↓
            Magic Link
```

The registration fields should appear progressively rather than requiring the user to choose between separate "Login" and "Create account" concepts before entering an email.

This behavior intentionally preserves the interaction model of the current PFY platform.

---

## 30. Deferred Product Questions

The following questions are deliberately deferred and do not block SPEC-002:

- What entitlement does an independently registered user receive?
- Can an independent user access any activities without a paid license?
- When does an independently registered user become a Student?
- How does a Teacher invite or link a Student?
- How does institutional provisioning work?
- How does an Organization assign Teacher or Student capacity?
- How does purchasing a B2C plan affect an existing identity?
- What learner level or pedagogical profile data should be collected?
- Should social authentication be introduced later?
- Should password authentication ever be offered as an alternative?

These questions belong to their respective future specifications.

SPEC-002 must not answer them implicitly.

---

## 31. Knowledge Updates Required

After implementation and validation, update durable project knowledge to reflect verified current state.

At minimum review:

- `README.md`;
- `docs/README.md`;
- `docs/ARCHITECTURE.md`;
- relevant security/authentication documentation;
- `resources/specs/README.md`;
- this specification.

Documentation must distinguish:

- implemented current state;
- future authorization;
- future entitlement;
- future migration;
- deferred authentication options.

Do not create a second competing source of truth.

---

## 32. Completion Gate

SPEC-002 may move to `COMPLETED` only when:

- canonical PFY identity exists;
- Profile exists;
- Magic Link login works;
- progressive new-user registration works;
- no password is required;
- session persistence works;
- session refresh works;
- logout works;
- protected surfaces reject unauthenticated access;
- server-side current-user resolution works;
- duplicate provisioning is prevented;
- RLS positive and negative cases pass;
- legacy provenance is protected;
- migrated-user activation compatibility is demonstrated;
- registration creates no implicit authorization or entitlement;
- required unit/integration/database/E2E tests pass;
- clean database reset and validation pass;
- required hosted validation passes;
- durable project documentation reflects verified current state.

---

## 33. Implementation Readiness

The product behavior required by SPEC-002 is defined.

Confirmed decisions:

- Supabase Auth is the authentication provider.
- PFY owns the canonical domain User.
- Magic Link is the primary authentication mechanism.
- Passwords are not required by the MVP.
- Login and registration share the same email-first flow.
- Unknown emails trigger progressive first-name/last-name registration.
- New users may self-register.
- Registration creates identity, not authorization or entitlement.
- Existing users retain a materially equivalent Magic Link experience during migration.
- Legacy WordPress passwords are not migrated.
- Legacy WordPress IDs are provenance only.
- A migrated PFY User may exist before its Supabase Auth identity is activated.
- Learner level is not part of SPEC-002.
- Social login is outside SPEC-002.
- Authorization and entitlement remain future concerns.

**Implementation state: IMPLEMENTATION READY.**
