# SPEC-001 — Application Foundation

**Status:** COMPLETED — VALIDATED 2026-09-21
**Depends on:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`  
**Does not depend on:** H5P runtime implementation, billing, organizations, teacher-student relationships, legacy migration  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md` and applicable accepted ADRs

## 1. Objective

Establish the production application foundation for the greenfield Portuguese for You platform.

The outcome is a minimal, deployable and testable application baseline that future PFY specifications can build on without needing to redefine the stack, environment model, Supabase integration or engineering workflow.

This specification intentionally does not implement PFY learning, access, billing or institutional features.

## 2. Current state

The repository currently contains authoritative product and architecture documentation but no production application implementation.

The approved architecture establishes:

- Next.js + TypeScript for the primary PFY application;
- React through the Next.js runtime;
- PostgreSQL as the system of record;
- Supabase as the initial managed platform for PostgreSQL, Auth and Storage where applicable;
- a modular-monolith application architecture;
- a future isolated Lumi H5P Node runtime;
- relationship-aware server authorization and PostgreSQL RLS for critical access boundaries.

The H5P technical spike exists in a separate disposable repository and is evidence only. Production H5P integration is explicitly outside this specification.

## 3. Problem / gap

PFY has an approved product and architecture direction but no production engineering baseline.

Without a bounded foundation, later feature work would need to independently invent application structure, environment handling, Supabase client conventions, validation commands, test baseline, CI expectations, deployment baseline and health/configuration checks.

That would create unnecessary architectural drift before product implementation begins.

## 4. Decision

Create the minimum production foundation required for subsequent PFY specifications.

The foundation must use the approved architecture and must not introduce product behavior that belongs to later specifications.

The foundation should be small enough that its primary purpose remains infrastructure validation rather than feature development.

## 5. Scope

### In scope

#### Application bootstrap

Establish the production Next.js + TypeScript application using a current stable version compatible with the approved architecture.

The project must:

- run locally;
- build successfully;
- expose a minimal application shell;
- use TypeScript with strict settings appropriate for production development;
- establish repository-local package/tooling configuration.

Do not copy the disposable H5P spike application wholesale.

#### Project structure

Establish a minimal structure that supports modular growth without prematurely creating every future domain.

The foundation may create application-level/shared infrastructure boundaries needed now.

Do not pre-create speculative Identity, Organization, Billing, H5P or Learning modules solely because they are expected later.

#### Supabase baseline

Establish the minimum application integration required to connect safely to the target Supabase platform.

This includes:

- server-side Supabase client convention;
- browser/client convention only if needed by the foundation;
- environment variable validation;
- clear distinction between public and server-only credentials;
- local/development configuration documentation.

No production credentials may be committed.

#### PostgreSQL baseline

Establish the database/migration mechanism that subsequent specs will use.

The foundation must be capable of applying version-controlled database migrations.

Only schema required by the foundation itself should be created.

Do not create the future complete PFY domain model in SPEC-001.

#### Authentication infrastructure baseline

The architecture selects Supabase Auth, but full identity/authentication behavior belongs to SPEC-002.

SPEC-001 may establish the integration primitives/configuration needed by later authentication work.

Do not implement the full user onboarding/login/account lifecycle here.

If a minimal technical verification is needed to prove Supabase Auth configuration, keep it clearly non-product and avoid defining future UX contracts.

#### Environment configuration

Establish explicit configuration validation for required environment values.

The application must fail clearly when mandatory server configuration is absent or invalid.

Server secrets must never be exposed through browser-visible configuration.

Provide an example environment file containing names/placeholders only.

#### Health/readiness

Provide a minimal health/readiness mechanism appropriate for deployment verification.

It should confirm application availability and, where appropriate, configuration/platform connectivity without leaking secrets or sensitive infrastructure details.

#### Testing baseline

Establish focused automated test infrastructure suitable for the application.

At minimum:

- a unit/integration testing baseline;
- a browser/E2E testing baseline if justified by the initial shell;
- stable commands for local validation.

Tests must prove the foundation rather than produce artificial coverage.

#### Static validation

Establish repository commands for the relevant checks, such as:

- formatting;
- linting;
- TypeScript validation;
- tests;
- production build.

Use tools appropriate to the actual chosen bootstrap. Do not add redundant tooling merely to increase the tool count.

#### CI baseline

Add a minimal CI workflow that runs the authoritative validation commands for pushes/pull requests as appropriate.

CI must not require production credentials.

If external Supabase connectivity is not suitable for generic CI, structure tests so core validation remains deterministic without it.

#### Deployment baseline

Make the primary Next.js application deployable to the approved initial hosting model, with Vercel or an equivalent Next.js platform remaining appropriate.

Do not deploy the production H5P runtime in this spec.

Document the minimum deployment/environment requirements.

#### Documentation

Update repository documentation so a new contributor can:

- install dependencies;
- configure local environment;
- run the application;
- run validation;
- understand what SPEC-001 established;
- understand what remains deliberately unimplemented.

### Out of scope

Do not implement:

- H5P runtime;
- H5P adapter;
- H5P authoring;
- H5P migration;
- Activity/Library product behavior;
- Attempt/Result behavior;
- teacher-student invitations or relationships;
- organizations;
- institutional reporting;
- licenses;
- seat allocation;
- entitlements;
- billing/payment integration;
- legacy WordPress user migration;
- legacy learning-history migration;
- final PFY visual design;
- production content administration;
- AI-assisted authoring;
- certificates;
- assignments;
- personal collections/favorites.

Do not create placeholder production implementations for these domains.

## 6. Expected behavior

After SPEC-001:

1. a contributor can clone the repository and understand the supported development workflow;
2. dependencies install deterministically;
3. the PFY application runs locally;
4. the application has a minimal, non-final shell/page showing that the platform is operational;
5. configuration errors fail clearly;
6. Supabase infrastructure integration is established without exposing secrets;
7. version-controlled database migrations can be applied;
8. the application can be validated with documented commands;
9. CI runs the agreed checks;
10. the application can be built for the target deployment environment;
11. no future PFY product domain is silently defined by the foundation.

## 7. Constraints

### Product constraints

The foundation must not alter or reinterpret the approved Product Definition.

The implementation must not introduce a global role model that would conflict with future relationship-based authorization.

### Architecture constraints

Preserve:

- Next.js + TypeScript;
- PostgreSQL/Supabase;
- modular-monolith application approach;
- future isolated H5P runtime boundary;
- application-owned domain data separate from Supabase Auth internal schemas.

Do not introduce another primary database, authentication provider or backend framework without a new architecture decision.

### Security constraints

- no credentials committed;
- no service-role credential exposed to the browser;
- public environment variables must be intentionally classified;
- health endpoints must not leak secrets;
- development conveniences must not weaken the production security model;
- do not disable RLS globally as a convenience pattern for future work.

### Operational constraints

The baseline should remain simple and low-maintenance.

Avoid premature microservices, message queues, background-worker architecture, caching layers, observability platforms or container orchestration.

These may be added later if actual requirements justify them.

## 8. Impact surface

### Directly affected

- repository root/tooling;
- Next.js application;
- environment configuration;
- Supabase integration primitives;
- migration infrastructure;
- automated tests;
- CI;
- development/deployment documentation.

### Explicitly unaffected

- approved product behavior;
- business model;
- H5P architecture decision;
- migration semantics;
- teacher/student permissions;
- organization/reporting rules;
- billing rules.

## 9. Acceptance criteria

SPEC-001 is complete only when all applicable criteria are evidenced.

### Repository/application

- [x] Production application exists in the repository.
- [x] Next.js and TypeScript versions are explicit and locked through the package manager lockfile.
- [x] Application runs locally using documented steps.
- [x] Production build succeeds.

### Configuration

- [x] Required environment variables are documented.
- [x] An example environment file contains no secrets.
- [x] Mandatory configuration is validated.
- [x] Server-only secrets cannot be imported/exposed accidentally through the client path.

### Supabase/database

- [x] Application has an established server-side Supabase integration convention.
- [x] Database migrations are version-controlled.
- [x] A clean local/development database can apply the migration baseline successfully. Evidence: `supabase db reset --local` passed twice on 2026-09-21 using OrbStack and Supabase CLI 2.100.1.
- [x] No speculative future-domain schema has been added.

### Quality

- [x] Formatting/linting command succeeds.
- [x] Type-check command succeeds.
- [x] Automated tests for the implemented foundation pass.
- [x] Production build passes.
- [x] CI runs the authoritative validation commands.

### Security

- [x] No secrets or production credentials are committed.
- [x] Service-role credentials are server-only if used.
- [x] Health/readiness output does not expose sensitive information.
- [x] No broad authorization bypass is introduced for future work.

### Documentation

- [x] Root README documents setup/run/validation.
- [x] Architecture documentation remains accurate.
- [x] SPEC-001 implementation choices that materially affect future specs are documented.
- [x] No approved product or architecture contract was silently changed.

### Deployment

- [x] Application is deployable using the documented target baseline.
- [x] Required environment configuration for deployment is documented.
- [x] Deployment does not require the H5P runtime yet.

## 10. Implementation freedom

Implementation may choose reversible details such as:

- exact package manager, if not already established;
- test runner;
- lint/format tooling;
- directory naming within the Next.js app;
- local Supabase workflow;
- CI workflow details;
- health endpoint naming;
- exact deployment configuration format.

The implementation may not silently change:

- primary framework;
- database platform;
- authentication provider decision;
- H5P isolation decision;
- product-domain semantics;
- authorization model;
- source-of-truth documentation hierarchy.

If a technical discovery requires one of those changes, return:

`BLOCKED / DECISION REQUIRED`

before implementing the deviation.

## 11. Knowledge updates required

At completion:

1. update root `README.md` with actual setup and validation commands;
2. update `docs/ARCHITECTURE.md` only if implementation establishes a durable architecture detail that materially changes or clarifies the authoritative current architecture;
3. do not create a new ADR for ordinary foundation choices unless a material architecture decision is required;
4. update `resources/specs/README.md`;
5. change this spec status to completed and move it to `resources/specs/completed/` only after validation and documentation reconciliation.

Do not maintain duplicated setup instructions in multiple competing files.

## 12. Open questions / blockers

There are no known product blockers to begin SPEC-001.

Implementation should verify current stable package versions and compatibility at execution time rather than relying on stale assumptions.

If the chosen Next.js/Supabase baseline exposes a material conflict with `docs/ARCHITECTURE.md` or an accepted ADR, stop and return `BLOCKED / DECISION REQUIRED`.

## Completion gate

Passing automated checks alone does not complete SPEC-001.

Completion requires:

```text
implementation
+ validation
+ deployment/build evidence
+ documentation reconciliation
= completed
```

## Closure evidence

- Local runtime: OrbStack Docker context, Docker Engine 29.4.0.
- Supabase CLI: 2.100.1.
- Migration command: `supabase db reset --local`, passed twice from a clean local database.
- Applied migration: `20260919000000_foundation_baseline.sql`.
- Resulting PFY schema: no tables in `public`; `pgcrypto` is installed intentionally. Supabase-managed Auth, Storage, Realtime and supporting schemas are created by the local platform stack.
- Local API connectivity: `GET http://127.0.0.1:54321/rest/v1/` returned HTTP 200 with the generated local public key.
- Application verification: Next.js running with `.env.local` returned `{"status":"ok","service":"pfy-web"}` from `/api/health`.
- No production credentials, legacy schema or PFY future-domain tables were introduced.
