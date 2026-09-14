# AGENTS.md

Instructions for human contributors and AI development agents working in `fecosta/pfy-platform`.

## 1. Read before changing code

Before implementation, read the smallest relevant authoritative set.

Always begin with:

1. `README.md`
2. `docs/PRODUCT_DEFINITION_v1.md`
3. `docs/ARCHITECTURE_v1.md`
4. relevant ADRs under `docs/`
5. the active specification under `resources/specs/active/`

As the repository grows, also inspect the relevant schema, migrations, security rules, tests and module-level documentation before editing.

Do not rely on conversation history when the repository contains current authoritative guidance.

## 2. Source-of-truth hierarchy

Use the following hierarchy:

- current implementation and tests describe what exists now;
- approved product documentation describes intended product behavior;
- accepted ADRs describe architecture decisions;
- active specifications define bounded implementation work;
- completed specifications preserve implementation history;
- planned specifications are future work and must not be treated as current behavior.

If these conflict, surface the contradiction. Do not silently choose whichever is easiest to implement.

## 3. Product coherence

PFY is a greenfield rebuild.

Do not recreate WordPress/plugin architecture unless a specification explicitly requires compatibility behavior.

Preserve these approved product principles:

- Activity is the fundamental learning-content unit.
- Student and teacher share the same library with different permissions.
- Teacher-student relationships are independent from payment lifecycle.
- Access is represented through entitlements rather than by coupling learning directly to billing.
- Users may belong to multiple organizations.
- Authorization is relationship-aware and must not depend solely on a global role.
- H5P is an implementation of Activity, not the PFY product domain.
- Learning Attempts are append-only.
- Non-scoring activity completion is valid and must not be represented as score zero.
- H5P scores are `client_reported`, not server-authoritative.
- Identity visibility and learning-data visibility are distinct permissions.

## 4. Architecture constraints

The approved architecture is described in `docs/ARCHITECTURE_v1.md`.

Key constraints include:

- Next.js + TypeScript for the primary application;
- PostgreSQL/Supabase as the system of record/platform;
- Supabase Auth linked to application-owned user/profile tables;
- server-side relational authorization plus RLS for critical database boundaries;
- Lumi H5P in a separate Node process/service;
- PFY-owned H5P adapter between the product domain and Lumi;
- PFY UUIDs remain canonical identifiers;
- Lumi content IDs remain runtime/internal identifiers;
- imported H5P content must pass the required security/sanitization pipeline;
- H5P library installation is a privileged operator/admin action.

Do not collapse the H5P runtime into the main PFY application process without an explicit architecture decision superseding ADR-001.

## 5. Specification workflow

Specifications live at:

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

A spec moves:

```text
planned -> active -> completed
```

Do not implement work directly from `planned/`.

A spec should move to `active/` only when it is implementation-ready and does not require the coding agent to invent product behavior.

After implementation and validation:

1. reconcile authoritative documentation;
2. ensure no current-state docs are stale;
3. move the spec to `completed/`;
4. update the spec status and closure evidence;
5. correct stale references in `resources/specs/README.md` or other project indexes.

A merged change is not automatically complete if durable project knowledge remains inconsistent.

## 6. Scope discipline

Implement the active spec, not adjacent future work.

Do not opportunistically add:

- unrelated refactors;
- speculative abstractions;
- future-spec functionality;
- billing logic before its spec;
- H5P integration before its spec;
- organization/access behavior not authorized by the current spec.

Prefer the smallest coherent implementation.

If a technical issue requires changing an approved product or architecture contract, stop and report:

`BLOCKED / DECISION REQUIRED`

Include the verified constraint, affected contract, options, recommended decision and implementation impact.

## 7. Security

Security rules are product contracts where they affect access or privacy.

At minimum:

- do not bypass RLS or authorization merely to make tests pass;
- do not expose service-role credentials to the browser;
- do not trust client-provided user/attempt identifiers for authorization;
- do not weaken H5P import sanitization;
- treat H5P libraries as executable code;
- do not expose institutional identity data when the reporting policy permits only pseudonymous learning data;
- never commit secrets, credentials, tokens or production data.

Security-sensitive changes require focused tests.

## 8. Data and migrations

Database changes must be explicit, reviewable and reversible where reasonably possible.

For migrations:

- preserve current data semantics;
- add database constraints when an invariant belongs at the database layer;
- use RLS for database access boundaries where architecture requires it;
- avoid destructive migrations without a migration/rollback plan;
- do not silently reinterpret legacy identifiers or data.

Legacy WordPress data is migration input, not the new PFY data model.

## 9. Testing and validation

Discover and use the repository's actual validation commands.

For each implementation:

- add focused tests for changed behavior;
- run relevant broader checks when practical;
- run formatting/lint/type-check/build checks established by the repository;
- do not claim a check was run if it was not;
- distinguish automated validation from manual validation.

Browser-visible behavior should receive browser-level validation when appropriate.

Authorization and RLS changes require explicit positive and negative access tests.

## 10. Git and authorship

Use Conventional Commits:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`

Use the repository's configured Git user as the sole author.

Do not add `Co-Authored-By` metadata for Claude, ChatGPT or any other AI agent.

Do not force-push, rewrite shared history, reset destructive state or bypass repository protections unless explicitly requested and understood.

Preserve unrelated work.

## 11. Final implementation report

When completing a bounded implementation, report:

1. starting branch/HEAD;
2. summary of what changed;
3. important design decisions;
4. files changed;
5. migrations or schema changes;
6. security/authorization implications;
7. tests/checks actually run and results;
8. checks not run;
9. unresolved risks;
10. documentation/spec reconciliation performed;
11. recommended next step.

Do not mark work complete solely because code compiles or tests pass.
