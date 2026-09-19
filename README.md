# Portuguese for You Platform

Greenfield rebuild of the Portuguese for You (PFY) learning platform.

PFY is a digital platform for teaching and learning Portuguese as a Foreign Language (PLE), supporting teacher-mediated and independent learning as well as institutional and sponsored-access models.

## Project status

**Current lifecycle state:** architecture approved; product/architecture documentation reconciled; application foundation is the active implementation target.

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

## Current implementation target

The current active specification is:

- [`SPEC-001 — Application Foundation`](resources/specs/active/001-application-foundation.md)

SPEC-001 establishes the technical and engineering foundation only.

Learning content, H5P production integration, Attempts, authoring, teacher-student relationships, licensing, organizations, reporting, billing and migrations belong to later bounded specifications.

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
