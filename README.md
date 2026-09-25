# Portuguese for You Platform

Greenfield rebuild of the Portuguese for You (PFY) learning platform.

PFY is a digital platform for teaching and learning Portuguese as a Foreign Language (PLE), supporting teacher-mediated and independent learning as well as institutional and sponsored-access models.

## Project status

**Current lifecycle state:** architecture approved; product/architecture documentation reconciled;
SPEC-001, SPEC-002, SPEC-003 and SPEC-004 completed and validated.

The production codebase is being built from scratch.

The current WordPress platform is treated as a legacy source for selective migration of:

- users and meaningful relationship/access provenance;
- H5P content, libraries and assets;
- Activity composition evidence where needed to reconstruct canonical PFY Activities;
- Syllabus/Percurso content and pedagogical structure where explicitly migrated;
- optional historical learning data if later prioritized.

The WordPress application, plugin architecture and page implementation are not the target architecture for the new platform.

## Authoritative documentation

Start with:

- [`docs/PRODUCT_DEFINITION.md`](docs/PRODUCT_DEFINITION.md) — current product contracts, personas, learning model, Activity/Exercise/Percurso semantics, business/access model, MVP and migration boundaries.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current target architecture, domain boundaries, data ownership, security posture and technical invariants.
- [`docs/ADR-001-LUMI-H5P-RUNTIME.md`](docs/ADR-001-LUMI-H5P-RUNTIME.md) — decision and production conditions for the isolated Lumi H5P runtime.
- [`docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`](docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md) — composed Activity model and Exercise-level H5P boundary.

Implementation work is governed through:

- [`resources/specs/`](resources/specs/) — bounded implementation specifications organized by lifecycle state.
- [`AGENTS.md`](AGENTS.md) — repository rules and authority boundaries for human and AI contributors.

The approved PFY UX prototype is a UX reference only. It does not override product-domain, authorization, security, architecture, migration or data-semantics contracts defined by the authoritative documentation and active SPEC.

The prototype is versioned under [`resources/ux/`](resources/ux/README.md) together with a register of its known conflicts with authoritative documentation ([`resources/ux/PROTOTYPE-CONFLICTS.md`](resources/ux/PROTOTYPE-CONFLICTS.md)).

## Product direction

The approved learning model is:

```text
Percurso / Syllabus
        ↓
      Activity
        ↓
 ordered content blocks
        ↓
     Exercise
        ↓
 H5P implementation
        ↓
     Attempt
```

Key product contracts include:

- Activity is the canonical learning unit.
- Activity is composed from ordered heterogeneous blocks.
- Exercise is the interactive Attempt-producing unit.
- H5P implements Exercises; H5P is not the PFY Activity domain.
- Syllabus is presented to users as Percurso.
- Students and Teachers use the same canonical learning content.
- Activity completion is independent from score.
- Activity performance is separate from completion.
- Percurso progress derives from Activity completion.
- Teacher monitoring reads canonical learner evidence through authorized relationships.

PFY is not modeled as a traditional `Course -> Module -> Lesson` LMS.

## Architecture direction

The approved architecture uses:

- Next.js + TypeScript for the primary PFY application;
- PostgreSQL as the system of record;
- Supabase for PostgreSQL, Auth and Storage where applicable;
- relationship-aware server-side authorization plus PostgreSQL RLS;
- a separate Node/Lumi H5P runtime behind a PFY-owned adapter boundary;
- PFY-owned Exercise identities mapped to Lumi content identities;
- append-only Exercise Attempts and normalized result evidence;
- Activity Progress, Activity Performance and Percurso progress as PFY-owned semantics.

Do not treat this README as a replacement for the authoritative product and architecture documents.

## Specification lifecycle

Specifications live under:

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

Lifecycle meanings:

- `planned/` — accepted future work that is not yet implementation-ready or not yet the active bounded unit.
- `active/` — current implementation-ready work.
- `completed/` — implemented, validated and knowledge-reconciled work.

Only one lifecycle state should describe a spec at a time.

Do not implement directly from `planned/`.

## Foundation status

SPEC-001 is completed and recorded at:

- [`SPEC-001 — Application Foundation`](resources/specs/completed/001-application-foundation.md)

SPEC-001 establishes the technical and engineering foundation only.

SPEC-002 establishes the application-owned identity, passwordless Magic Link authentication,
server-side session/current-user resolution and progressive email-first registration flow. Identity
creation does not imply authorization, entitlement, organization, licensing or learning-domain
behavior.

SPEC-003 establishes the server-side authorization context and deny-by-default decision boundary.
It authorizes only the current own-Profile proof operation, preserves Profile RLS and keeps
service-role access isolated to privileged identity adapters. It does not introduce roles,
relationships, entitlements or authorization schema.

H5P production integration, Attempts, authoring, teacher-student relationships, licensing, organizations, reporting, billing and migrations remain future bounded specifications. SPEC-004 establishes the canonical Activity, Exercise, Percurso, shared published-library content foundation and separates safe catalog discovery from authenticated content access. No later specification is active until explicitly promoted.

## Application development

SPEC-001 provides the initial Next.js application baseline. SPEC-002 provides the server-side
Magic Link/session foundation and the progressive email-first registration experience.

The bounded authentication surfaces are `/login`, `/auth/callback`, `/protected`, and the
server-side logout/request-link/register handlers under `/api/auth/`. Runtime identity reconciliation
requires the server-only `PFY_SUPABASE_SERVICE_ROLE_KEY`; it must never be exposed through a
`NEXT_PUBLIC_*` variable. Unknown emails progressively reveal first and last name fields and are
not provisioned until registration is submitted in the same `/login` flow.

The explicit live Phase 2 browser gate is `npm run test:auth:e2e`. It requires
`PFY_SUPABASE_URL`, `PFY_SUPABASE_ANON_KEY`, `PFY_SUPABASE_SERVICE_ROLE_KEY`, and
`PFY_SUPABASE_INBUCKET_URL`, which must point to the local email-capture HTTP API. The general
`npm run test:e2e` suite may skip the live auth test when those variables are absent. The request-link
boundary applies bounded process-local defense-in-depth throttling keyed by hashed email and client
signal; distributed deployments must also configure shared edge/platform abuse controls. Local
Supabase ports are environment-specific and are not repository contracts.

### Requirements

- Node.js 22.x
- npm 10.x or newer
- A Supabase project for runtime checks that use the server client

### Setup and run

```sh
npm ci
cp .env.example .env.local
# replace the two placeholders in .env.local with the Supabase project URL and anon key
npm run dev
```

Open `http://localhost:3000`. The health endpoint is available at
`http://localhost:3000/api/health`; it returns `503` when required configuration is absent and
never includes credential values in its response.

### Validation

```sh
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The live SPEC-002 identity/RLS suite is an explicit local gate and requires a running local
Supabase instance plus `PFY_SUPABASE_URL`, `PFY_SUPABASE_ANON_KEY` and the server-only
`PFY_SUPABASE_SERVICE_ROLE_KEY` environment variables:

```sh
npm run test:identity:integration
```

Do not expose the service-role key to browser code or `NEXT_PUBLIC_*` variables.

The E2E command requires the Playwright browser installation (`npx playwright install chromium`)
on a new machine. CI installs Chromium and runs the browser check alongside the deterministic
static checks, unit tests and production build without requiring Supabase credentials.

### Database and deployment

The repository uses the official Supabase CLI workflow under `supabase/`. OrbStack or Docker
Desktop must provide a working Docker-compatible runtime, and the Supabase CLI must be installed.

```sh
npm run supabase:start
supabase status
npm run supabase:reset
npm run supabase:stop
```

`supabase db reset --local` recreates the local database and applies every migration from zero.
The current migrations include the SPEC-002 identity/profile foundation and the SPEC-004 learning
content foundation. The content migration owns Activities, ordered Activity blocks, Exercise
identities, Syllabus/Percurso records and ordered Activity membership. Seed loading is disabled
because these bounded phases define no seed data.

For local application use, copy the API URL and anon/publishable key emitted by `supabase status`
into the ignored `.env.local` using the names in `.env.example`. Never copy the local service-role
or secret key into committed files or browser-visible configuration. Stop the stack when it is not
needed with `npm run supabase:stop`.

The Next.js app can be deployed to Vercel or an equivalent Next.js platform. Configure
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment environment. Do
not configure a Supabase service-role key in this application baseline or expose one to a browser.

## Source-of-truth principle

For intended product behavior, use:

```text
approved product decisions
        ↓
docs/PRODUCT_DEFINITION.md
        ↓
accepted ADRs / docs/ARCHITECTURE.md
        ↓
active SPEC
        ↓
implementation prompt
        ↓
approved UX prototype
        ↓
implementation convenience
```

Current implementation and tests remain authoritative for claims about what actually exists now.

If these sources conflict, surface the contradiction.

Do not silently choose whichever interpretation is easiest to implement.

## Development principle

Implementation must serve the approved PFY product and architecture contracts.

If implementation discovers a technical constraint that would require changing an approved product contract, data meaning, authorization rule, migration boundary or architecture decision, stop and return:

`BLOCKED / DECISION REQUIRED`

Do not silently redefine the product in code.
