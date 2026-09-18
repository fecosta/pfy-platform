# SPEC-004 — Learning Content Model, Percursos & Shared Library

**Status:** PLANNED — IMPLEMENTATION READY  
**Depends on:** SPEC-003 — Authorization Foundation  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md` and applicable accepted ADRs  
**UX reference:** approved PFY prototype, subject to the authority boundaries defined in repository governance

## 1. Purpose / Objective

Establish the canonical PFY learning-content foundation required by later H5P, learning-progress, authoring and teacher-monitoring specifications.

SPEC-004 introduces:

- canonical Activity identity and lifecycle;
- ordered heterogeneous Activity composition;
- canonical Exercise identity;
- Syllabus/Percurso;
- ordered Activity membership in Percursos;
- the shared published Activity library used by Students and Teachers.

The objective is to establish the learning-content domain without coupling it to H5P runtime implementation, Attempts, billing or legacy migration.

After SPEC-004, PFY must have a stable content model on which later specifications can safely build:

```text
Syllabus / Percurso
        ↓
ordered Activity membership
        ↓
     Activity
        ↓
ordered ActivityBlocks
        ↓
     Exercise
```

H5P integration begins only in SPEC-005.

Exercise Attempts and derived learner progress begin only in SPEC-006.

## 2. Current State

The authoritative PFY product and architecture define:

- Activity as the canonical learning unit;
- Activity as a composed learning workspace rather than a single H5P object;
- Exercise as the canonical interactive component capable of producing Attempts;
- H5P as an implementation technology for Exercises;
- Syllabus as a first-class pedagogical concept presented to users as Percurso;
- Activities as independently addressable and reusable across Percursos;
- one shared published learning library for Students and Teachers;
- `draft`, `published` and `archived` as the minimum Activity lifecycle;
- PFY-owned UUIDs as canonical identities.

ADR-002 explicitly replaces the earlier implicit one-Activity-to-one-H5P model with:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

SPEC-004 does not implement the adapter or Lumi mapping.

The existing planned SPEC-004 predates these decisions and models `ActivityCollection` and `Textbook` as central learning structures.

That model is no longer authoritative for the current MVP.

## 3. Problem / Gap

Later PFY capabilities require stable learning-content identities and relationships.

Without SPEC-004:

- SPEC-005 has no canonical Exercise identity to map to H5P;
- SPEC-006 has no canonical Exercise identity to attach Attempts to;
- Activity Progress cannot later be derived from Activity Exercise membership;
- SPEC-007 has no canonical Activity composition model to author;
- Percurso cannot reference Activities without duplication;
- the shared library has no canonical published content source;
- teacher monitoring cannot safely refer to the same Activity identities used by Students.

The domain model must therefore be established before runtime, learning evidence and authoring are implemented.

## 4. Authoritative Decision

PFY adopts the following canonical learning-content hierarchy:

```text
Syllabus / Percurso
        ↓
ordered membership
        ↓
     Activity
        ↓
ordered content composition
        ↓
 ActivityBlock
        ↓
     Exercise
```

### Activity

Activity is the fundamental PFY learning unit.

It owns:

- canonical PFY identity;
- learner-facing identity;
- title and summary;
- cover/illustrative metadata where applicable;
- discovery/pedagogical metadata;
- publication lifecycle;
- ordered content composition.

An Activity exists independently of any Percurso.

### ActivityBlock

ActivityBlock represents one ordered component in an Activity composition.

Supported block semantics may include:

- editorial content;
- heading;
- reflection/prompt;
- image;
- video;
- infographic;
- external/embed content;
- Exercise.

The implementation must preserve deterministic ordering and typed block semantics.

The platform must not impose one universal pedagogical sequence.

### Exercise

Exercise is the canonical PFY interactive component.

An Exercise:

- has its own PFY identity;
- belongs to one Activity;
- participates in Activity composition;
- is required for Activity completion under the current product contract;
- may later produce Attempts;
- may later be implemented by H5P or another supported interactive technology.

SPEC-004 establishes Exercise identity and membership only.

It does not implement H5P playback or Attempt persistence.

### Syllabus / Percurso

Syllabus is the canonical domain concept.

Percurso is its ordinary user-facing product term.

A Percurso:

- has canonical PFY identity;
- has descriptive/pedagogical metadata;
- contains an ordered sequence of references to canonical Activities;
- does not duplicate Activities.

One Activity may belong to zero, one or multiple Percursos.

### Shared Library

PFY has one canonical published Activity catalog.

Students and Teachers use the same canonical published Activities.

Role/context differences may affect actions and supplementary information, but must not create duplicate content catalogs.

`Explorar` is a discovery surface over this shared content.

It is not a content entity.

## 5. Scope

### 5.1 In Scope — Activity

Implement canonical Activity persistence and application behavior sufficient to represent:

- PFY UUID;
- title;
- summary;
- lifecycle;
- basic discovery/pedagogical metadata;
- optional cover/illustrative asset reference where required by the current UX;
- created/updated timestamps as appropriate;
- deterministic Activity composition.

Minimum lifecycle:

```text
draft
published
archived
```

Activity identity must remain stable across lifecycle changes and Percurso membership.

### 5.2 In Scope — Activity composition

Implement a representation for ordered heterogeneous Activity blocks.

The model must support at minimum the currently approved semantic categories needed to represent:

- editorial text/content;
- headings;
- reflection/prompts;
- images;
- videos;
- infographics;
- external/embed content;
- Exercises.

The physical representation is implementation freedom provided that:

- block type is explicit;
- order is deterministic;
- malformed/unsupported block state is rejected safely;
- rendering does not require interpreting arbitrary untrusted structure;
- Exercise references preserve referential integrity.

Do not encode pedagogical labels such as `Bora entender?` as mandatory system stages.

They may be represented through ordinary Activity content.

### 5.3 In Scope — Exercise identity

Implement canonical PFY Exercise identity and its association with Activity composition.

An Exercise must:

- have a PFY UUID;
- belong to exactly one Activity;
- be distinguishable from passive/editorial blocks;
- support future interactive implementation metadata without requiring Lumi identity now;
- remain stable as Attempts are added in SPEC-006.

For the current product contract, Exercises in an Activity are considered required for future Activity completion.

Do not introduce optional Exercise semantics in SPEC-004.

### 5.4 In Scope — Syllabus/Percurso

Implement canonical Syllabus/Percurso persistence sufficient to represent:

- PFY UUID;
- title;
- description/objective;
- level where applicable;
- expected workload where applicable;
- publication/lifecycle state sufficient for safe user exposure;
- ordered Activity membership;
- pedagogical metadata associated with the Percurso or Activity membership where required.

Relevant pedagogical metadata may include:

- gêneros discursivos;
- propósitos;
- recursos léxico-gramaticais;
- sugestão de lição de casa.

The implementation must preserve the distinction between metadata belonging to the Activity itself and metadata describing the Activity's pedagogical use within a specific Percurso.

### 5.5 In Scope — Activity reuse

The same Activity may participate in multiple Percursos.

Membership must reference the canonical Activity.

Do not copy Activity content into a Percurso membership record.

Changing ordering in one Percurso must not change ordering in another Percurso.

### 5.6 In Scope — Shared published library

Provide the minimum application behavior required to browse/open published Activities from one shared catalog.

Published Activities must be independently addressable.

Ordinary Student and Teacher discovery must exclude:

- drafts;
- archived Activities.

Authorized content-management contexts may access non-published content according to SPEC-003 authorization foundations and later authoring requirements.

### 5.7 In Scope — Percurso browsing

Provide the minimum read behavior required for authorized users to:

- discover/view published Percursos;
- inspect their ordered Activity sequence;
- open a published Activity from a Percurso.

Opening an Activity from a Percurso must use the same canonical Activity identity/workspace as opening it independently.

### 5.8 In Scope — basic discovery metadata

SPEC-004 may establish the minimum structured metadata necessary for useful Activity/Percurso discovery.

The physical taxonomy and search implementation remain flexible.

Do not establish unsupported mastery, competency or learner-performance metrics as discovery metadata.

## 6. Out of Scope

SPEC-004 must not implement:

- Lumi runtime;
- H5P playback;
- H5P adapter;
- Lumi content mapping;
- H5P authoring;
- Exercise Attempts;
- Results;
- xAPI ingestion;
- Activity Progress;
- Activity Performance;
- `needs_review`;
- learner progress percentages;
- Percurso completion calculation;
- teacher-student invitation;
- teacher monitoring;
- formal assignments;
- due dates;
- personal teacher collections;
- favorites;
- certificates;
- gamification;
- AI-assisted authoring;
- CEFR mastery scoring;
- competency/category scoring;
- licenses;
- content-subset licensing;
- entitlements;
- billing;
- organization administration;
- institutional reporting;
- legacy WordPress migration;
- legacy H5P migration;
- legacy Syllabus migration.

Do not implement placeholder behavior for these domains.

## 7. Explicit Non-Entities

The following must not be introduced as current canonical PFY learning entities by SPEC-004:

- Course / Curso;
- Module / Módulo;
- Lesson / Lição;
- Unit / Unidade;
- Track;
- Program;
- Certificate;
- Textbook as the central current learning structure;
- ActivityCollection as the central current learning structure.

This does not prohibit future product decisions introducing additional structures.

It prevents implementation convenience or legacy terminology from silently redefining the current PFY learning model.

`Lição de casa` remains valid pedagogical metadata and does not create a `Lesson` or `Assignment` entity.

## 8. Expected Behavior

After SPEC-004:

1. PFY can persist canonical Activities.
2. Every Activity has a stable PFY identity.
3. An Activity can contain an ordered heterogeneous composition.
4. Exercise blocks reference canonical PFY Exercises.
5. Exercises have stable PFY identities independent from H5P/Lumi.
6. Published Activities can be discovered from the shared library.
7. Students and Teachers access the same canonical published Activity records.
8. Draft and archived Activities are not exposed through ordinary published-library access.
9. PFY can persist Syllabus/Percurso.
10. A Percurso can reference an ordered sequence of Activities.
11. One Activity can participate in multiple Percursos without duplication.
12. Opening an Activity through a Percurso resolves to the same canonical Activity as opening it independently.
13. Percurso-specific pedagogical metadata does not mutate canonical Activity content.
14. No Attempt or learner-performance behavior is implied by the content model.
15. No Lumi identifier is required to identify an Activity or Exercise.

## 9. Data Semantics and Invariants

### Activity identity

PFY Activity UUID is canonical.

Changing lifecycle, metadata, composition or Percurso membership must not replace Activity identity.

### Exercise identity

PFY Exercise UUID is canonical.

Exercise identity must not depend on:

- Lumi content id;
- H5P library id;
- Percurso;
- learner;
- Attempt.

### Exercise ownership

An Exercise belongs to exactly one Activity.

If future requirements require reusable Exercises across Activities, that is a product-model change and requires a separate decision.

Do not generalize for it in SPEC-004.

### Activity block ordering

Activity block ordering must be deterministic.

The implementation must prevent ambiguous duplicate ordering within the same Activity.

### Percurso ordering

Activity ordering inside a Percurso must be deterministic.

The implementation must prevent ambiguous duplicate ordering within the same Percurso.

### Activity reuse

Percurso membership references canonical Activity identity.

Membership does not own a copy of Activity content.

### Lifecycle visibility

Only published content is available through ordinary Student/Teacher discovery surfaces.

Draft/archived access requires explicit authorization.

### H5P boundary

SPEC-004 must not require Lumi IDs.

Future H5P association belongs to the Exercise boundary established by ADR-002.

## 10. Authorization and Security Constraints

SPEC-004 depends on SPEC-003 for authorization foundations.

Content operations must follow deny-by-default conventions.

At minimum:

- ordinary Student/Teacher browsing reads published content only;
- draft/archived access requires an explicit authorized content capability;
- client-supplied lifecycle state must not bypass server authorization;
- publication state must be enforced server-side;
- database/RLS protections must follow established SPEC-003 conventions where applicable;
- public content reads must not expose private authoring/admin fields merely because the Activity itself is published.

Do not create a global `teacher`, `student` or `author` role shortcut that bypasses contextual authorization.

Content Author remains a capability/context, not automatically a global role.

## 11. UI / UX Constraints

The approved prototype may guide:

- visual treatment;
- navigation;
- `Explorar`;
- Percursos;
- Activity presentation;
- responsive behavior.

The implementation must preserve domain semantics even where prototype mock data is simplified.

In particular:

- do not introduce `Course`;
- do not infer a Percurso from level, class or teacher relationship;
- do not display an invented generic learner-progress percentage;
- do not make Activity completion dependent on navigating through passive blocks;
- do not duplicate Activities for different entry points.

SPEC-004 does not need to implement final learning-progress UI because learner progress belongs to SPEC-006.

## 12. Impact Surface

### Directly affected

- PostgreSQL schema/migrations;
- learning-content domain/application layer;
- authorization/RLS for content reads and lifecycle visibility;
- Activity routes/read models;
- Activity composition rendering;
- Exercise identity foundation;
- Percurso routes/read models;
- shared library/Explorar;
- tests;
- repository documentation.

### Downstream dependencies

SPEC-004 establishes contracts consumed by:

- SPEC-005 — H5P Runtime Production Integration;
- SPEC-006 — Exercise Attempts, Activity Progress & Results;
- SPEC-007 — Activity Authoring & H5P Content Workflow;
- SPEC-008 — Teacher–Student Relationships & Monitoring;
- SPEC-011 — Institutional Reporting & PFY Impact Privacy Layer;
- SPEC-014 — Legacy Learning Content Migration;
- SPEC-015 — Optional Historical Learning Data Migration.

Downstream SPECs must not redefine Activity, Exercise or Percurso identity.

## 13. Acceptance Criteria

### Activity identity and lifecycle

- [ ] Activity has a canonical PFY UUID.
- [ ] Activity supports `draft`, `published` and `archived`.
- [ ] Lifecycle transitions do not replace Activity identity.
- [ ] Ordinary published-library access excludes draft and archived Activities.
- [ ] Authorized non-public content access follows the established authorization foundation.

### Activity composition

- [ ] Activity supports ordered heterogeneous content blocks.
- [ ] Block ordering is deterministic.
- [ ] At least the approved MVP block semantics can be represented without a rigid pedagogical sequence.
- [ ] Passive/editorial/media blocks are distinguishable from Exercises.
- [ ] Invalid or unsupported block state fails safely.
- [ ] `Bora entender?` or similar pedagogical labels are not hardcoded as mandatory workflow stages.

### Exercise

- [ ] Exercise has a canonical PFY UUID.
- [ ] Exercise belongs to exactly one Activity.
- [ ] Exercise participates in Activity composition.
- [ ] Exercise identity does not require Lumi/H5P identity.
- [ ] No Attempt/Result persistence is introduced by this SPEC.
- [ ] No optional-Exercise behavior is introduced.

### Syllabus/Percurso

- [ ] Syllabus/Percurso has canonical PFY identity.
- [ ] Published Percursos can expose ordered Activity membership.
- [ ] Activity ordering inside a Percurso is deterministic.
- [ ] The same Activity can belong to multiple Percursos.
- [ ] Percurso membership does not duplicate Activity content.
- [ ] Percurso-specific pedagogical metadata can be represented without mutating canonical Activity content.
- [ ] Opening an Activity from a Percurso resolves to the same canonical Activity identity used elsewhere.

### Shared library

- [ ] One canonical published Activity catalog serves Students and Teachers.
- [ ] Published Activities are independently addressable.
- [ ] Ordinary discovery does not expose draft/archived content.
- [ ] Teacher and Student access does not require duplicate Activity records.
- [ ] Basic discovery metadata is structured enough to support the current shared-library UX without defining unsupported analytics.

### Domain boundaries

- [ ] No `Course`, `Module`, `Lesson` or `Unit` entity is introduced.
- [ ] `ActivityCollection` and `Textbook` are not introduced as central MVP learning structures.
- [ ] No Lumi content id appears as canonical Activity or Exercise identity.
- [ ] No H5P runtime integration is implemented.
- [ ] No learner Attempt/progress/performance semantics are implemented.
- [ ] No licensing/content-subset behavior is introduced.

### Security

- [ ] Positive and negative tests cover published versus non-published content visibility.
- [ ] Unauthorized lifecycle/content-management access is denied.
- [ ] Server-side authorization is not replaced by client-visible state.
- [ ] Relevant RLS behavior follows SPEC-003 conventions.

### Validation

- [ ] Relevant unit/integration tests pass.
- [ ] Relevant database/RLS tests pass.
- [ ] Relevant browser-level tests for library/Percurso/Activity read flows pass.
- [ ] Type-check/lint/build validation passes according to repository commands.
- [ ] No authoritative product or architecture contract was silently changed.

## 14. Implementation Freedom

Implementation may choose reversible technical details including:

- physical ActivityBlock schema shape;
- normalized tables versus appropriately typed structured fields where architecture permits;
- ordering implementation;
- slug strategy in addition to canonical UUID;
- internal route structure;
- query implementation;
- basic search implementation;
- exact basic discovery metadata fields;
- component boundaries;
- caching strategy if actually needed and contract-preserving.

Implementation freedom does not include changing:

- Activity as canonical learning unit;
- ordered heterogeneous Activity composition;
- Exercise as canonical interactive unit;
- one-Activity ownership of an Exercise;
- Syllabus/Percurso semantics;
- Activity reuse across Percursos;
- shared Teacher/Student catalog;
- lifecycle visibility semantics;
- H5P boundary;
- canonical PFY identity;
- source-of-truth hierarchy.

If implementation evidence shows one of these contracts is technically impractical, return:

`BLOCKED / DECISION REQUIRED`

before changing the contract.

## 15. Deliberately Deferred Decisions

### H5P runtime mapping

Defined by ADR-002 and implemented in SPEC-005.

```text
PFY Exercise UUID <-> Lumi content id
```

through the PFY H5P Adapter.

### Exercise Attempts and Activity Progress

Implemented in SPEC-006.

### Activity authoring UX

Implemented in SPEC-007.

SPEC-004 establishes the content model that authoring will manipulate.

### Content-subset licensing

Whether future licenses restrict subsets of content belongs to licensing/entitlement design.

Do not encode that policy into the content model in SPEC-004.

### Advanced search/filter taxonomy

The complete future taxonomy does not need to be fixed now.

SPEC-004 establishes only sufficient structured metadata for current discovery and later evolution.

### Legacy Activity composition migration

Remains:

`DECISION REQUIRED — LEGACY ACTIVITY COMPOSITION MIGRATION`

This belongs to migration planning/SPEC-014 and does not block creation of the canonical new content model.

### Legacy Syllabus migration

Also belongs to migration planning/SPEC-014.

### Personal collections/favorites

Remain outside current SPEC-004 scope.

## 16. Knowledge Updates Required

At completion:

1. document the verified physical content schema and key invariants in the appropriate architecture/current-state documentation;
2. record any material architecture decision only if implementation required a genuine durable architecture choice;
3. update `resources/specs/README.md` with verified SPEC-004 state;
4. reconcile downstream planned SPECs if implementation evidence changes a technical assumption without changing product semantics;
5. move this SPEC to `resources/specs/completed/` only after implementation, validation and knowledge reconciliation;
6. ensure no current documentation still describes ActivityCollection/Textbook as the current central learning model;
7. preserve implementation-specific schema details as current-state knowledge rather than silently promoting them to product semantics.

## 17. Open Questions / Blockers

There are no known product blockers inside the SPEC-004 bounded scope.

Activation remains dependent on:

- completion and coherence verification of SPEC-003;
- confirmation that repository current state still matches the assumptions in this specification at activation time.

The following are explicitly **not blockers** for SPEC-004:

- production Lumi deployment;
- GPL review;
- Attempt semantics implementation;
- final Activity Performance aggregation beyond already approved contracts;
- complete discovery taxonomy;
- content-subset licensing;
- payment provider;
- legacy migration strategy.

If activation-time repository evidence contradicts an authoritative contract, stop and reconcile before implementation.

## 18. Activation Gate

This SPEC is:

**PLANNED — IMPLEMENTATION READY**

It must remain under `resources/specs/planned/` while its dependency chain is incomplete or another primary bounded implementation unit remains active.

Do not implement directly from `planned/`.

Promote to `active/` only when:

```text
SPEC-003 completed and coherence verified
+ repository state revalidated
+ authoritative documentation still aligned
+ no new blocking decision
= ACTIVE — IMPLEMENTATION READY
```

## 19. Completion Gate

Passing tests alone does not complete SPEC-004.

Completion requires:

```text
canonical Activity model implemented
+ ordered Activity composition implemented
+ canonical Exercise identity implemented
+ Syllabus/Percurso implemented
+ shared published library implemented
+ authorization/RLS verified
+ browser behavior validated
+ downstream contracts preserved
+ documentation reconciled
= completed
```

At that point:

- change status to `COMPLETED — COHERENCE VERIFIED`;
- move the file to `resources/specs/completed/`;
- update `resources/specs/README.md`;
- identify the next eligible planned SPEC for activation.
