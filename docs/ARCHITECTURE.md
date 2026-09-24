# Portuguese for You — Architecture v2

**Status:** DECISION READY — ARCHITECTURE v2
**Date:** 2026-09-18
**Architecture style:** modular web application with isolated H5P runtime
**Supersedes:** Architecture v1 (`docs/ARCHITECTURE_v1.md`, removed; preserved in repository history)
**Related:** `PRODUCT_DEFINITION.md`, `ADR-001-LUMI-H5P-RUNTIME.md`, `ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`

## 1. Objective

Define the target architecture for the greenfield PFY rebuild while preserving the current product contracts and selectively migrating users and learning content from the legacy WordPress platform.

Architecture v2 incorporates the approved composed-Activity model, Syllabus/Percurso, Exercise-level H5P integration and the separation between Exercise Attempts, Activity Progress and Activity Performance.

The architecture deliberately does not reproduce WordPress plugin boundaries.

## 2. Architecture decisions

### Application

- Next.js 16.x + TypeScript for the primary PFY web application and server-side application layer.
- React 19.x through the Next.js runtime.
- Modular-monolith product architecture inside the PFY application.

### Data platform

- PostgreSQL as the system of record for PFY domain data.
- Supabase as the initial managed platform for PostgreSQL, Auth and Storage where applicable.
- Relational modeling for identities, relationships, organizations, licenses, entitlements, Activities, Activity composition, Exercises, Percursos and Attempts.

### Authentication

- Supabase Auth as the v1 identity provider.
- PFY domain users live in application-owned tables linked to authentication identities.
- Legacy WordPress password hashes are not part of the new PFY domain.

The current application implements the identity and authentication foundation through:

- application-owned canonical PFY Users, Profiles and primary login emails;
- optional verified Supabase Auth linkage, including pre-authentication migrated users;
- passwordless Magic Link authentication;
- PKCE callback and SSR session-cookie handling;
- server-side resolution of the authenticated request to one canonical PFY User.

Authentication establishes identity only. Authorization is a separate server-side relational
decision layer, with PostgreSQL RLS as defense in depth; entitlement remains a separate future
domain concern.

### Authorization

- Relationship-aware server-side authorization.
- PostgreSQL RLS as database enforcement for critical boundaries.
- Authorization is not modeled as one global `user.role`.

### Learning content

- Activity is the canonical learning-content unit.
- Activity owns ordered heterogeneous content composition.
- Exercise is the canonical Attempt-producing interactive unit.
- Syllabus is the canonical structured pedagogical sequence.
- Percurso is the user-facing representation of Syllabus.
- Library/Explorar is a discovery surface, not a content entity.

### H5P

- Lumi remains the runtime and H5P authoring engine under ADR-001.
- H5P runs in its own Node process/service.
- PFY owns the H5P Adapter boundary.
- H5P implements Exercises rather than complete PFY Activities.
- Lumi identifiers do not become canonical PFY domain identifiers.

## 3. System context

```text
Browser
   |
   v
PFY Web / Application (Next.js)
   |
   +------> Supabase Auth
   +------> PostgreSQL / RLS
   +------> Object Storage
   |
   | authorized Exercise runtime request
   v
PFY H5P Adapter
   |
   v
PFY H5P Runtime (Node + Lumi)
   |
   +------> H5P libraries
   +------> H5P content/assets
   +------> player/editor models
```

PFY remains responsible for authorization, canonical identity, Activity composition, Exercise identity, Attempts, Activity Progress, Activity Performance and Percurso progress.

## 4. Logical domains

- Identity
- Organizations
- Access & Entitlements
- Learning Library
- Activity Composition
- Percursos / Syllabus
- Learning Progress
- Teacher-Student Relationships
- Authoring
- Institutional Reporting
- Commerce/Billing Integration
- Migration

These are logical product/domain boundaries and are not necessarily independently deployable services.

## 5. Canonical data ownership

### PFY PostgreSQL owns

- users/profiles;
- organization membership;
- teacher-student relationships and invitations;
- contracts/licenses/capacity/allocation/entitlements;
- Activities;
- Activity metadata and lifecycle;
- ordered Activity composition;
- Exercise identities and implementation metadata;
- Syllabus/Percurso;
- ordered Activity membership in Percursos;
- Exercise Attempts/Results;
- Activity Progress;
- Activity Performance or sufficient canonical evidence to derive it;
- Percurso progress or sufficient canonical evidence to derive it;
- reporting policies;
- migration provenance;
- H5P-to-PFY Exercise mapping metadata.

### H5P runtime owns

- Lumi/H5P runtime identifiers;
- H5P libraries;
- H5P content parameters;
- runtime assets;
- player/editor behavior;
- runtime-specific state;
- temporary import/export state.

PFY must be able to replace H5P without redefining Activity, Exercise, Attempt, Activity Progress, Activity Performance, Percurso or authorization.

## 6. Activity composition

Canonical Activity identity:

```text
activities.uuid
```

An Activity contains ordered content blocks:

```text
Activity
├── metadata
└── ActivityBlock[]
       ├── editorial
       ├── heading
       ├── reflection
       ├── image
       ├── video
       ├── infographic
       ├── embed
       └── Exercise
```

The physical schema remains an implementation/specification decision but must preserve canonical identity, deterministic ordering, typed semantics, referential integrity, authoring/editing and safe rendering.

## 7. Exercise identity

Canonical Exercise identity must be PFY-owned.

An Exercise:

- belongs to an Activity;
- may produce Attempts;
- may be implemented by H5P;
- participates in Activity Completion;
- may produce scorable or non-scorable evidence.

## 8. H5P identity mapping

The authoritative mapping is:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

Legacy migration may retain `legacy_h5p_content_id` for provenance and reconciliation.

No PFY public domain API should require Lumi content IDs.

## 9. Syllabus / Percurso

A Syllabus owns identity, title, objective/description, level, workload metadata and ordered Activity membership.

The user-facing term is `Percurso`.

```text
Syllabus / Percurso
        ↓
ordered Activity membership
        ↓
Activity
        ↓
Exercise
```

One Activity may participate in multiple Percursos without duplication.

## 10. Exercise Attempts

Attempts attach to Exercises.

For each learner and Exercise:

- Attempt numbers are monotonic;
- a new execution creates a new Attempt;
- completed Attempts are not overwritten;
- previous Attempts remain historical evidence.

The server creates the Attempt and issues an unguessable Attempt token/context.

## 11. H5P tracking

H5P xAPI statements originate in the browser.

The adapter normalizes supported top-level completion/scoring statements into PFY Exercise Attempt semantics.

```text
H5P Exercise
      |
      | xAPI
      v
PFY H5P Adapter
      |
      v
Exercise Attempt / Result
```

Sub-content statements must not prematurely complete the parent Exercise Attempt.

For H5P:

```text
score_provenance = client_reported
```

Non-scoring Exercises are valid and missing score must never become zero.

## 12. Activity Progress

Activity Progress is PFY-owned.

```text
not_started
in_progress
completed
```

Current rule:

```text
Activity completed
=
all required Exercises completed
```

Score does not determine Activity completion.

Editorial/media blocks do not create artificial completion requirements.

## 13. Activity Performance

Activity Performance is separate from Activity Progress.

Current states:

```text
no_score
adequate
attention
needs_review
```

Current Exercise evidence uses the latest completed Attempt for each Exercise.

The current `needs_review` rule is:

```text
scorable Exercises with latest completed score < 50%
------------------------------------------------------
total scorable Exercises

>= 50%
```

No Activity Performance state may change Activity completion or block Percurso progression.

Exercise scoreability / assessment semantics and the `adequate`/`attention` aggregation remain `DECISION REQUIRED` (see `PRODUCT_DEFINITION.md` §12).

## 14. Percurso progress

Percurso progress derives from Activity completion:

```text
completed applicable Activities
--------------------------------
total applicable Activities
```

Percurso progress must not be calculated from average Exercise scores.

A `needs_review` Activity remains completed for Percurso progress.

## 15. Learning history

Learning history is composed from distinct layers:

```text
Exercise Attempt history
        ↓
Activity history
        ↓
Percurso progress/history
```

Authorization determines who may view each learner's history.

## 16. Teacher monitoring

An active authorized teacher-student relationship permits the Teacher to access approved learner history.

Teacher-facing information may include Activity completion, Exercise results, previous Attempts where appropriate, Activity Performance, `needs_review` and Percurso progress where applicable.

Teacher monitoring reads canonical learner evidence and does not create duplicate learning records.

## 17. Shared teacher/student learning architecture

Student and Teacher experiences use the same canonical Activities, Exercises, Percursos, library and learning evidence.

Do not create separate teacher-specific Activity or Percurso data solely to support teacher UX.

## 18. H5P authoring architecture

PFY provides an Activity authoring shell.

```text
Content Author
      |
      v
PFY Activity Authoring UI
      |
      +--> Activity metadata
      +--> editorial/media blocks
      +--> H5P Exercise block
                |
                v
          PFY H5P Adapter
                |
                v
          Lumi H5P Editor
```

Lumi owns H5P-specific editing semantics inside an H5P-backed Exercise.

The stock H5P editor is not the complete Activity authoring environment.

## 19. Activity lifecycle

Minimum lifecycle:

```text
draft
published
archived
```

Draft and archived visibility requires explicit authorization.

Publishing is an explicit authorized action.

## 20. H5P security invariants

ADR-001 security invariants remain mandatory:

- imported parameters require sanitization;
- library installation remains privileged;
- runtime versions remain pinned;
- H5P should use isolated origin where practical;
- library packages are executable code;
- sanitizer regression tests are mandatory.

## 21. H5P library/version strategy

Legacy migration should:

1. inventory required libraries;
2. determine compatible patch sets;
3. normalize/install approved libraries;
4. import H5P content;
5. map content to canonical PFY Exercises;
6. render-verify migrated Exercises;
7. reconcile Activity composition separately.

## 22. Authentication and user migration

Legacy WordPress users migrate into PFY domain profiles with legacy provenance and activate new Supabase Auth identities through the approved flow.

## 23. Authorization model

Authorization remains relationship-aware.

- learners access their own permitted data;
- teachers require active authorized teacher-student relationships;
- organization managers act only within authorized organization scope;
- authoring capability is explicit and contextual;
- PFY Admin capability must be explicitly defined.

## 24. Organizations and entitlements

Users may belong to multiple Organizations.

Access remains separated conceptually:

```text
License
   ↓
Capacity
   ↓
Allocation
   ↓
Entitlement
   ↓
User access
```

Teacher-student relationships survive entitlement suspension unless explicitly revoked.

## 25. Institutional reporting

Institutional reporting must derive from canonical PFY learning evidence.

Learning-data visibility and civil-identity visibility remain independently authorized.

Unsupported analytics such as CEFR mastery percentages require separate future definitions.

## 26. Legacy Activity migration

H5P migration and Activity migration are related but not equivalent.

Legacy WordPress Activities may combine editorial content, media, one or more H5P packages and ordering/context.

Migrating H5P packages alone does not necessarily reconstruct a complete PFY Activity.

The strategy remains:

`DECISION REQUIRED — LEGACY ACTIVITY COMPOSITION MIGRATION`

## 27. Legacy Syllabus migration

Legacy Syllabus pages contain pedagogical structure that may map to PFY Syllabus/Percurso.

A dedicated migration decision/specification must define extraction, Activity association, ordering, workload, level, pedagogical metadata and reconciliation.

## 28. Deployment topology

```text
PFY Web / Application
Next.js
      |
      +--> Supabase Auth
      +--> PostgreSQL
      +--> Storage
      |
      +--> isolated H5P Runtime
              Node + Lumi
              persistent/object storage
```

PFY Web and H5P Runtime must remain independently deployable.

## 29. Operational boundaries

Do not introduce without demonstrated need:

- premature microservices;
- message queues;
- complex distributed caching;
- container orchestration;
- dedicated analytics warehouse.

Prefer the smallest coherent architecture.

## 30. UX architecture

The approved PFY prototype is a UX reference.

Current Student information architecture:

```text
Início
Explorar
Percursos
Minha biblioteca
Meu progresso
```

Teacher learning architecture uses the same content universe.

The prototype does not own database, authorization, migration or domain invariants.

## 31. Architecture invariants

Implementation must preserve:

1. Activity is the canonical learning unit.
2. Activity is composed from ordered heterogeneous blocks.
3. Exercise is the Attempt-producing interactive unit.
4. H5P implements Exercises, not complete Activities.
5. PFY Exercise identity is canonical over Lumi identity.
6. Attempts are append-only.
7. Activity Completion is independent of score.
8. Activity Performance is independent of completion.
9. Percurso progress derives from Activity completion.
10. Teachers and Students share canonical learning content.
11. Teacher monitoring reads canonical learner evidence.
12. Relationships and entitlements remain separate.
13. Learning-data and identity permissions remain separate.
14. Lumi remains isolated behind a PFY-owned adapter.
15. Legacy WordPress architecture is migration input, not target architecture.

## 32. Source-of-truth hierarchy

```text
approved product decisions
        ↓
authoritative Product Definition
        ↓
accepted ADRs / Architecture
        ↓
active implementation SPEC
        ↓
implementation prompt
        ↓
approved UX prototype
        ↓
implementation convenience
```

Current implementation and tests remain authoritative for claims about what has actually been implemented.

If sources conflict, surface the contradiction.

## 33. Current state

**DECISION READY — ARCHITECTURE v2**

Before implementation of affected learning domains, the planned specifications must be reconciled with this architecture.

If implementation discovers a technical constraint requiring a change to an architecture invariant, return:

`BLOCKED / DECISION REQUIRED`
