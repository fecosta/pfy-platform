# AGENTS.md

Instructions for human contributors and AI development agents working in `fecosta/pfy-platform`.

## 1. Read before changing code

Before implementation, read the smallest relevant authoritative set.

Always begin with:

1. `README.md`
2. `docs/PRODUCT_DEFINITION.md`
3. `docs/ARCHITECTURE.md`
4. relevant accepted ADRs under `docs/`
5. the active specification under `resources/specs/active/`

For learning/H5P work, explicitly include:

- `docs/ADR-001-LUMI-H5P-RUNTIME.md`
- `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`

As the repository grows, also inspect the relevant schema, migrations, security rules, tests and module-level documentation before editing.

Do not rely on conversation history when the repository contains current authoritative guidance.

## 2. Source-of-truth hierarchy

For intended product behavior, use this hierarchy:

```text
approved product decisions
        ↓
docs/PRODUCT_DEFINITION.md
        ↓
accepted ADRs / docs/ARCHITECTURE.md
        ↓
active specification
        ↓
implementation prompt
        ↓
approved UX prototype
        ↓
implementation convenience
```

Current implementation and tests remain authoritative for claims about what actually exists now.

Completed specifications preserve implementation history.

Planned specifications describe future bounded work and must not be treated as current behavior or direct implementation instructions.

If sources conflict, surface the contradiction.

Do not silently choose whichever interpretation is easiest to implement.

## 3. Prototype authority boundary

The approved PFY prototype is a UX/UI reference.

It is versioned under `resources/ux/prototype/`. Before using it, read `resources/ux/README.md` and `resources/ux/PROTOTYPE-CONFLICTS.md`. Do not implement prototype concepts that the register classifies as `CONFLICT`, `UNDEFINED` or `DECISION REQUIRED`, and treat items classified as `PROPOSAL` as input to a pending decision only.

It may guide:

- visual direction;
- information hierarchy;
- navigation;
- interaction intent;
- represented user-facing states.

It does not define:

- database schema;
- authorization;
- security;
- domain invariants;
- migration semantics;
- API contracts;
- exact metric formulas beyond approved product contracts;
- unrepresented edge cases.

Mock data does not establish product semantics.

If the prototype conflicts with authoritative documentation or the active SPEC, do not implement the prototype contradiction.

If resolving the conflict requires changing an approved product contract, return:

`BLOCKED / DECISION REQUIRED`

## 4. Product coherence

PFY is a greenfield rebuild.

Do not recreate WordPress/plugin architecture unless a specification explicitly requires compatibility or migration behavior.

Preserve these approved product principles:

- Activity is the canonical learning-content unit.
- Activity is composed from ordered heterogeneous content blocks.
- Exercise is the interactive Attempt-producing unit.
- H5P implements Exercises; H5P is not the PFY Activity domain model.
- PFY Exercise UUIDs remain canonical over Lumi content IDs.
- Syllabus is a first-class pedagogical concept presented to users as Percurso.
- Activity can exist independently and may participate in multiple Percursos without duplication.
- Students and Teachers share the same canonical learning content.
- Teacher-mediated synchronous learning and independent learning use the same Activity Learning Workspace.
- Teacher-student relationships are independent from payment lifecycle.
- Access is represented through entitlements rather than coupling learning directly to billing.
- Users may belong to multiple organizations.
- Authorization is relationship-aware and must not depend solely on a global role.
- Exercise Attempts are append-only.
- Missing score is never converted to zero.
- Activity Completion is independent from score.
- Activity Performance is separate from Activity Completion.
- `needs_review` is pedagogical attention, not failure, blocking or automatic remediation.
- Percurso progress derives from Activity completion, not score averages.
- H5P scores are `client_reported`, not server-authoritative.
- Identity visibility and learning-data visibility are distinct permissions.
- Formal assignments, CEFR mastery metrics and advanced competency analytics are not current MVP contracts unless a later SPEC explicitly promotes them.

## 5. Learning semantics

### Activity composition

Do not hardcode one global Activity content sequence.

An Activity may contain an ordered combination of editorial, reflection, image, video, infographic, embed and Exercise blocks.

Pedagogical patterns such as “Bora entender?” are content patterns, not mandatory system stages.

### Exercise and H5P

H5P-backed interactive content belongs to a canonical PFY Exercise.

Do not restore a direct one-to-one domain mapping:

```text
PFY Activity UUID <-> Lumi content id
```

The current boundary is:

```text
PFY Exercise UUID <-> Lumi content id
```

through the PFY H5P Adapter.

### Attempts

Attempts attach to Exercises.

A new learner execution creates a new Attempt.

Do not overwrite previous completed Attempts to represent repetition.

### Activity completion

Current rule:

```text
Activity completed
=
all required Exercises completed
```

Score does not determine completion.

Do not create artificial completion requirements for passive editorial/media blocks.

### Activity performance

Use the latest completed Attempt for current Exercise performance.

Current approved Activity attention rule:

```text
needs_review
=
50% or more of scorable Exercises
have latest completed score < 50%
```

`needs_review` must not:

- make the Activity incomplete;
- block Percurso progress;
- change learner level;
- automatically assign remediation;
- become an Activity grade.

### Percurso progress

Current rule:

```text
completed applicable Activities
/
total applicable Activities
```

Do not derive Percurso progress from Exercise score averages.

## 6. Architecture constraints

The approved architecture is described in `docs/ARCHITECTURE.md`.

Key constraints include:

- Next.js + TypeScript for the primary application;
- PostgreSQL/Supabase as system of record/platform;
- Supabase Auth linked to application-owned user/profile tables;
- server-side relational authorization plus RLS for critical database boundaries;
- Lumi H5P in a separate Node process/service;
- PFY-owned H5P adapter between Exercise domain state and Lumi;
- PFY UUIDs remain canonical identifiers;
- Lumi content IDs remain runtime/internal identifiers;
- imported H5P content must pass the required sanitization/security pipeline;
- H5P library installation is a privileged operator/admin action.

Do not collapse the H5P runtime into the main PFY application process without an explicit architecture decision superseding ADR-001.

Do not collapse Activity composition into the H5P runtime.

## 7. Specification workflow

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

A SPEC should move to `active/` only when it is implementation-ready and does not require the coding agent to invent product behavior.

Before activation, verify that the SPEC is reconciled with the current:

- Product Definition;
- Architecture;
- ADRs;
- dependency state;
- relevant UX reference.

After implementation and validation:

1. reconcile authoritative documentation;
2. ensure no current-state docs are stale;
3. move the SPEC to `completed/`;
4. update status and closure evidence;
5. correct stale references in `resources/specs/README.md` and other indexes.

A merged change is not automatically complete if durable project knowledge remains inconsistent.

## 8. Scope discipline

Implement the active SPEC, not adjacent future work.

Do not opportunistically add:

- unrelated refactors;
- speculative abstractions;
- future-spec functionality;
- billing logic before its SPEC;
- H5P integration before its SPEC;
- organizations/access behavior not authorized by the current SPEC;
- formal assignment workflows unless explicitly in scope;
- CEFR mastery or unsupported competency metrics;
- AI recommendations/remediation without an explicit product decision.

Prefer the smallest coherent implementation.

If a technical issue requires changing an approved product or architecture contract, stop and report:

`BLOCKED / DECISION REQUIRED`

Include:

- verified constraint;
- affected contract;
- options;
- recommended decision;
- implementation impact.

## 9. Security

Security rules are product contracts where they affect access or privacy.

At minimum:

- do not bypass RLS or authorization merely to make tests pass;
- do not expose service-role credentials to the browser;
- do not trust client-provided user/Attempt identifiers for authorization;
- do not weaken H5P import sanitization;
- treat H5P libraries as executable code;
- do not expose institutional identity data when policy permits only pseudonymous learning data;
- never commit secrets, credentials, tokens or production data.

Security-sensitive changes require focused tests.

## 10. Data and migrations

Database changes must be explicit, reviewable and reversible where reasonably possible.

For migrations:

- preserve current data semantics;
- add database constraints when an invariant belongs at the database layer;
- use RLS for database access boundaries where architecture requires it;
- avoid destructive migrations without a migration/rollback plan;
- do not silently reinterpret legacy identifiers or data.

Legacy WordPress data is migration input, not the new PFY data model.

Do not assume migrating `.h5p` packages alone reconstructs complete PFY Activities.

The legacy Activity-composition migration strategy remains a decision gate until explicitly resolved.

Legacy Syllabus/Percurso migration also requires explicit mapping/reconciliation.

## 11. Testing and validation

Discover and use the repository's actual validation commands.

For each implementation:

- add focused tests for changed behavior;
- run relevant broader checks when practical;
- run established formatting/lint/type-check/build checks;
- do not claim a check was run if it was not;
- distinguish automated validation from manual validation.

Browser-visible behavior should receive browser-level validation when appropriate.

Authorization and RLS changes require explicit positive and negative access tests.

Learning semantics require focused tests when applicable, including:

- append-only Attempt behavior;
- non-scoring completion;
- Activity completion derivation;
- Activity Performance calculation;
- Percurso progress derivation;
- relationship-scoped teacher access.

## 12. Git and authorship

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

## 13. Final implementation report

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
10. documentation/SPEC reconciliation performed;
11. recommended next step.

Do not mark work complete solely because code compiles or tests pass.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
