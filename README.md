# Portuguese for You Platform

Greenfield rebuild of the Portuguese for You (PFY) learning platform.

PFY is a digital platform for teaching and learning Portuguese as a Foreign Language (PLE), supporting individual teachers and students as well as institutional and sponsored-access models.

## Project status

**Current lifecycle state:** architecture approved, implementation not yet started.

The production codebase is being built from scratch. The current WordPress platform is treated as a legacy source for selective migration of:

- users;
- H5P activities and required assets/libraries;
- optional historical learning data if later prioritized.

The WordPress application and plugin architecture are not the target architecture for the new platform.

## Authoritative documentation

Start with:

- [`docs/PRODUCT_DEFINITION_v1.md`](docs/PRODUCT_DEFINITION_v1.md) — product contracts, personas, learning model, business/access model, MVP and migration boundaries.
- [`docs/ARCHITECTURE_v1.md`](docs/ARCHITECTURE_v1.md) — approved target architecture and technical boundaries.
- [`docs/ADR-001-LUMI-H5P-RUNTIME.md`](docs/ADR-001-LUMI-H5P-RUNTIME.md) — decision and conditions for Lumi H5P.

Implementation work is governed through:

- [`resources/specs/`](resources/specs/) — implementation specifications organized by lifecycle state.
- [`AGENTS.md`](AGENTS.md) — repository rules for human and AI contributors.

## Architecture direction

The approved architecture uses:

- Next.js + TypeScript for the primary PFY application;
- PostgreSQL as the system of record;
- Supabase for PostgreSQL, Auth and Storage where applicable;
- relationship-aware server-side authorization plus PostgreSQL RLS;
- a separate Node/Lumi H5P runtime behind a PFY-owned adapter boundary;
- append-only learning attempts and normalized results.

Do not treat this README as a replacement for the authoritative architecture and product documents.

## Specification lifecycle

Specifications live under:

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

Lifecycle meanings:

- `planned/` — accepted future work that is not yet implementation-ready.
- `active/` — current implementation-ready work.
- `completed/` — implemented, validated and reconciled work.

Only one state should describe a spec at a time.

## Current implementation target

The first active specification is:

- [`SPEC-001 — Application Foundation`](resources/specs/active/001-application-foundation.md)

It establishes the technical foundation only. Product features such as H5P, teacher-student relationships, licensing, organizations, billing and legacy migration are intentionally outside its scope.

## Development principle

Implementation must serve the approved PFY product and architecture contracts.

If implementation discovers a technical constraint that would require changing an approved product contract, data meaning, authorization rule, migration boundary or architecture decision, stop and return:

`BLOCKED / DECISION REQUIRED`

Do not silently redefine the product in code.
