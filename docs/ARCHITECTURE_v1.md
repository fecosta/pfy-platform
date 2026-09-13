# Portuguese for You — Architecture v1

**Status:** DECISION READY — ARCHITECTURE v1  
**Date:** 2026-09-13  
**Architecture style:** modular web application with isolated H5P runtime

## 1. Objective

Define the target architecture for the greenfield PFY rebuild while preserving the approved product contracts and selectively migrating users and H5P content from the legacy WordPress platform.

This architecture deliberately does not reproduce WordPress plugin boundaries.

## 2. Architecture decisions

### Application

- Next.js 16.x + TypeScript for the primary PFY web application and server-side application layer.
- React 19.x through the Next.js runtime.
- Modular-monolith product architecture inside the PFY application.

### Data platform

- PostgreSQL as the system of record for PFY domain data.
- Supabase as the initial managed platform for PostgreSQL, Auth and Storage where applicable.
- Relational modeling for identities, relationships, organizations, licenses, entitlements, activities and attempts.

### Authentication

- Supabase Auth as the identity provider candidate/decision for v1.
- PFY domain users live in application-owned tables linked to authentication identities.
- Legacy WordPress password hashes are not part of the new domain and should not be required for migration.

### Authorization

- Relationship-aware server-side authorization.
- PostgreSQL Row Level Security as a database enforcement layer for critical access boundaries.
- Authorization is not modeled as a single global `user.role`.
- Teacher-student relationships, organization memberships, entitlements and reporting policies participate in authorization decisions.

### H5P

- Lumi H5P Node.js is adopted as the runtime and authoring engine under a CONDITIONAL GO decision.
- H5P runs in its own Node process/service.
- PFY owns an H5P Adapter boundary.
- Lumi identifiers and internal storage paths do not become PFY domain identifiers.
- PFY activities use PFY UUIDs as canonical identity.

### Deployment

Initial target topology:

- PFY Web/Application: deployable independently, initially suitable for Vercel or equivalent Next.js hosting.
- PostgreSQL/Auth/Storage: Supabase managed project.
- H5P Runtime: separate Node-compatible service/container with persistent/object storage for H5P content, libraries and assets.

Deployment provider for the H5P runtime remains an implementation decision; its process isolation is an architecture decision.

## 3. System context

```text
Browser
  |
  v
PFY Web / Application (Next.js)
  |       |        |
  |       |        +--> Supabase Auth
  |       +-----------> PostgreSQL / RLS
  +-------------------> Object Storage
  |
  | internal/application API
  v
PFY H5P Runtime (Node + Lumi)
  |
  +--> H5P libraries
  +--> H5P content/assets
  +--> player/editor models
```

The browser may load the H5P player/editor resources from the isolated H5P origin, but PFY remains responsible for authorization and PFY-domain state.

## 4. Logical domains

The PFY application should preserve clear internal modules even when deployed as a monolith:

- Identity
- Organizations
- Access & Entitlements
- Learning Library
- Learning Progress
- Teacher-Student Relationships
- Authoring
- Institutional Reporting
- Commerce/Billing integration
- Migration

These are product/domain boundaries, not necessarily separate deployable services.

## 5. Canonical data ownership

### PFY PostgreSQL owns

- users/profiles;
- organization membership;
- teacher-student relationships and invitations;
- contracts/licenses/capacity/allocation/entitlements;
- activities and editorial metadata;
- collections and textbooks;
- attempts/results;
- reporting policies;
- migration provenance;
- H5P-to-PFY mapping metadata required by the adapter.

### H5P runtime owns

- Lumi/H5P runtime identifiers;
- H5P libraries and patch versions;
- H5P content parameters required by the player/editor;
- H5P runtime assets and user-state details that are runtime-specific;
- temporary H5P import/export state.

PFY must be able to replace the H5P implementation without redefining core Activity, Attempt or Result semantics.

## 6. Activity identity

Canonical identity:

`activities.uuid`

The H5P runtime keeps an adapter-owned mapping:

`PFY activity UUID <-> Lumi content id`

Legacy migration may additionally retain:

`legacy_h5p_content_id`

for provenance and reconciliation only.

No PFY public URL or domain API should require Lumi content IDs.

A narrow implementation exception is acceptable inside the browser H5P component when the Lumi web component requires its runtime `content-id` DOM attribute. That identifier must not escape into canonical PFY state.

## 7. Learning attempts

Attempts are append-only.

For each learner and activity:

- attempt numbers are monotonic;
- a new execution creates a new Attempt;
- completed attempts are not overwritten by later attempts;
- summaries such as best score and latest score are derived views.

The server creates the Attempt and issues an unguessable attempt token for the H5P client event channel.

The browser must not be trusted to choose an arbitrary Attempt identifier to update.

## 8. H5P tracking

H5P xAPI statements originate in the browser. The adapter normalizes supported top-level completion/scoring statements into PFY Result semantics.

```text
H5P player
   |
   | xAPI
   v
H5P Adapter
   |
   +--> raw statement/audit record (optional but recommended)
   |
   v
PFY Attempt / Result
```

Sub-content completion statements must not prematurely complete the parent activity Attempt.

### Score provenance

For H5P:

`score_provenance = client_reported`

The platform must not represent H5P browser-generated scores as server-authoritative.

### Non-scoring activities

Non-scoring H5P content is valid.

For such activities:

- `is_completed` may be true;
- score fields remain null;
- `is_passed` remains null.

Absence of score must never be converted to zero.

## 9. H5P authoring architecture

PFY provides an authoring shell around the Lumi editor.

```text
Content Author
    |
    v
PFY Authoring UI
    |
    v
H5P Adapter / Authoring API
    |
    v
Lumi H5P Editor
```

The PFY shell owns:

- PFY title/metadata;
- content-type guidance;
- draft/publish state;
- user-friendly Portuguese errors;
- authoring permissions;
- review/publish actions;
- future AI-assisted draft generation.

The stock H5P editor remains responsible for H5P-specific content forms and semantics.

## 10. AI-assisted authoring

AI authoring is adapter-based and human-reviewed.

```text
Prompt/reference material
      |
      v
PFY structured authoring draft
      |
      v
Content-type-specific deterministic transformer
      |
      v
H5P draft
      |
      v
H5P Editor
      |
      v
Human review -> Publish
```

No model-generated content is published automatically.

Transformers must be versioned/tested per supported H5P content type.

## 11. H5P security invariants

The spike discovered a stored-XSS gap in Lumi 10.0.x package import parameters. Production PFY must preserve the mitigation as an explicit invariant.

Import pipeline:

```text
Package upload
  -> archive/path validation
  -> file type/extension validation
  -> content parameter semantic sanitization
  -> residual dangerous-markup check
  -> trusted-library resolution/installation
  -> persistence
```

Requirements:

- never use the default permissive Lumi permission system in production;
- restrict H5P library installation to trusted PFY operators/admins;
- keep library administration routes disabled or strongly protected;
- content authors may create/import content according to explicit permissions but do not automatically gain unrestricted library-code installation rights;
- maintain a narrowed content-file allowlist suitable for the PFY corpus;
- add CSRF/session protections once integrated with real authentication;
- run the H5P surface on an isolated origin where practical;
- pin exact Lumi/core/editor versions;
- treat library packages as executable code, not merely content.

Security regression tests for the import sanitizer are mandatory in production code.

## 12. H5P library/version strategy

During legacy migration, import order must not determine final library patch levels.

Migration should:

1. inventory required libraries;
2. select the highest required patch per `major.minor` compatible set;
3. install/normalize that set;
4. import content;
5. render-verify all migrated activities.

Different major/minor versions may coexist when required by content.

Do not run production against an unreleased Lumi master branch. Pin stable published versions and evaluate major upgrades deliberately.

## 13. Authentication and user migration

Legacy WordPress users are migrated into PFY domain profiles with legacy provenance.

Authentication activation should use the new identity provider rather than requiring continuity of WordPress password storage.

Candidate onboarding pattern:

`legacy user -> PFY profile -> auth identity activation -> magic link/reset/login`

Exact migration workflow remains a dedicated specification.

## 14. Authorization model

Authorization is relationship-aware.

Examples:

### Teacher learning-data access

A teacher may view a student's learning history only when an active authorized teacher-student relationship exists.

### Organization reporting

An organization manager may view learning data only for people within that organization's authorized reporting scope.

### PFY Impact

Learning-data access can be allowed while direct personal identity access is denied.

The application layer computes product authorization decisions; RLS enforces critical row boundaries as defense in depth.

## 15. Licensing and entitlements

The architecture separates commercial origin from access state.

```text
Subscription / Contract / Sponsorship
              |
              v
            License
              |
              v
        License Capacity
              |
              v
         Seat Allocation
              |
              v
          Entitlement
              |
              v
             User
```

Billing providers must integrate into this model rather than become the source of truth for PFY access semantics.

## 16. Storage strategy

### PFY domain data

PostgreSQL.

### General PFY file/media storage

Supabase Storage or another S3-compatible object store.

### H5P content/assets

The production H5P runtime must use persistent storage compatible with independent runtime deployment and backup/restore. The spike filesystem layout is evidence, not the required production persistence implementation.

Temporary H5P files require scheduled cleanup.

## 17. Migration architecture

The legacy WordPress database is a source, not a shared production dependency.

Migration is ETL/import-based:

### Users

`WordPress export/query -> transform -> validate -> PFY user/profile -> reconciliation report`

### H5P

`legacy .h5p export -> library normalization -> sanitize/import -> PFY Activity mapping -> automated render gate`

Historical progress remains optional and must be handled as an independent migration if later approved.

## 18. Observability

Production must distinguish at least:

- application/auth errors;
- H5P runtime errors;
- content import validation failures;
- content rendering failures;
- tracking/xAPI normalization failures;
- attempt token rejections;
- migration reconciliation failures.

Raw H5P/xAPI information may be retained for debugging/audit within a defined retention policy, but is not the business model.

## 19. Infrastructure boundaries

The initial system should avoid unnecessary microservices.

Required deployment separation:

- PFY application process;
- H5P runtime process;
- managed data/storage services.

Other product domains remain modules inside PFY until operational or scaling evidence justifies further separation.

## 20. Legal and compliance gates

### GPL

Lumi packages used by the spike are GPL-3.0-or-later. Process isolation is an engineering decision, but it must not be treated as a definitive legal conclusion about licensing obligations.

**Gate:** legal review before production distribution/deployment decisions are finalized.

### LGPD

PFY Impact requires individual learning monitoring without necessarily exposing civil identity.

**Gate:** define the pseudonymization, identity-resolution, retention, lawful-basis and administrative-access design before the PFY Impact reporting spec becomes implementation-ready.

## 21. Architectural risks

### Medium

- H5P client-reported scoring trust model;
- dependency on a stable but aging Lumi 10.x release until a new major is published and evaluated;
- H5P library patch normalization requirements;
- content-authoring UX needs a PFY wrapper and human validation;
- GPL implications require specialist review.

### Low/managed

- runtime-specific content ID leakage is confined to a required DOM attribute;
- external media references may create availability dependencies;
- current corpus is close to default per-file upload limits for at least one asset.

### Mitigated but must remain covered

- H5P import stored XSS.

## 22. Architectural non-goals

Do not:

- use WordPress as headless backend for the new PFY;
- reproduce MemberPress/plugin-specific models;
- make H5P/Lumi IDs canonical PFY identifiers;
- store only raw xAPI as learning state;
- create separate teacher and student content catalogs;
- introduce microservices for every product domain;
- tie access semantics directly to a payment provider;
- migrate all legacy progress before launch;
- allow AI to auto-publish learning content.

## 23. Architecture acceptance criteria

Architecture v1 is coherent when implementation can demonstrate:

1. PFY identity is independent of legacy WordPress and Lumi.
2. authorization is relationship-aware and protected in database/application layers.
3. Activity remains independent from H5P runtime internals.
4. H5P playback and authoring are isolated behind the PFY adapter.
5. Attempts are append-only and distinguish repeated executions.
6. H5P score provenance is explicit.
7. unscored completion is represented without fabricated score.
8. imported H5P parameters are sanitized before persistence.
9. H5P library installation is privileged.
10. B2C and B2B access reuse License/Allocation/Entitlement semantics.
11. institutional learning visibility and identity visibility can be separately authorized.
12. legacy migration can run without permanent runtime access to the WordPress database.

## 24. Recommended implementation sequence

Dependency-oriented sequence:

1. **Application Foundation & Repository Governance**
2. **Identity & Authentication**
3. **Authorization Foundation**
4. **Learning Content Model & Library**
5. **H5P Runtime Production Integration**
6. **Attempts & Results**
7. **H5P Authoring & Content Workflow**
8. **Teacher-Student Relationships**
9. **Licensing & Entitlements**
10. **Organizations & Institutional Access**
11. **Institutional Reporting / PFY Impact privacy layer**
12. **B2C Billing Integration**
13. **Legacy User Migration**
14. **Legacy H5P Migration**
15. **Optional historical-progress migration**

Exact SPEC numbering should be created in the production repository after its governance baseline exists.

## 25. Evidence reconciliation

The completed H5P spike is valid architecture evidence, not a production source of truth.

References inside the spike to a local/existing `pfy-platform` implementation or Laravel/PHP contracts do not redefine this greenfield architecture. Reusable findings are translated into technology-neutral PFY contracts such as Activity, Attempt, Result, score provenance and the H5P adapter boundary.

## 26. State

**DECISION READY — ARCHITECTURE v1**

The next step is to establish the production repository governance and convert this architecture into bounded implementation specifications.
