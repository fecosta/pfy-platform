# SPEC-002 — Identity & Authentication

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-001  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Implement PFY identity and authentication on Supabase Auth while keeping authentication identities separate from application-owned user/profile data.

## 2. Current State

Architecture v1 selects Supabase Auth and requires PFY domain users to live in application-owned tables linked to authentication identities. Legacy WordPress password hashes are outside the new domain.

## 3. Problem / Gap

PFY needs secure account activation, login, session handling and logout before authenticated product experiences can be implemented.

## 4. Decision

Use Supabase Auth as the v1 identity provider. Create an application-owned user/profile identity linked to the authentication subject. Authentication does not define product authorization or paid access.

## 5. Scope

### In Scope
- application-owned user/profile identity;
- login/logout/session lifecycle;
- activation/recovery primitives;
- authenticated shell;
- server-side current-user resolution;
- secure session refresh;
- baseline legacy provenance fields;
- auth/RLS tests.

### Out of Scope
- organization memberships;
- teacher-student relationships;
- licenses/entitlements;
- PFY Admin permission model;
- WordPress import;
- billing;
- H5P.

## 6. Expected Behavior

A user can authenticate, maintain a secure session, log out and resolve to one canonical PFY user/profile. Unauthenticated users cannot access protected surfaces.

## 7. Constraints
- `auth.users` is not the PFY domain user table.
- Do not add a global role that defines all authorization.
- Authentication success does not imply entitlement.
- Service-role credentials remain server-only.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] PFY user/profile links one-to-one to auth identity.
- [ ] Login/session/logout works end-to-end.
- [ ] Server resolves canonical current user.
- [ ] Protected access rejects unauthenticated users.
- [ ] No global-role shortcut exists.
- [ ] RLS protects user-owned profile data.
- [ ] Positive/negative auth tests pass.
- [ ] Secrets remain server-only.

## 10. Implementation Freedom

Route structure, auth UI, validation library and helper organization may vary without changing identity ownership or authorization semantics.

## 11. Knowledge Updates Required

Update current-state architecture/auth docs with verified methods, schema and validation commands.

## 12. Open Questions / Blockers

Before activation, confirm launch authentication UX (magic link/password/reset combination) and whether social login is MVP.
