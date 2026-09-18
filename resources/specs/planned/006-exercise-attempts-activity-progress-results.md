# SPEC-006 --- Exercise Attempts, Activity Progress & Results

**Status:** PLANNED --- DECISION READY / ACTIVITY PERFORMANCE
AGGREGATION REQUIRED\
**Depends on:** SPEC-004 --- Learning Content Model, Percursos & Shared
Library; SPEC-005 --- H5P Runtime Production Integration\
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`,
`docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md` and
applicable accepted ADRs\
**Technical evidence:** completed `fecosta/pfy-h5p-spike` tracking spike

## 1. Purpose / Objective

Implement canonical PFY learner evidence around Exercises and derive
Activity-level learning state without coupling learning semantics to
H5P.

SPEC-006 establishes:

``` text
Exercise
   ↓
Attempt
   ↓
Result evidence
   ↓
Activity Progress
   +
Activity Performance
```

It must preserve the distinction between:

-   Exercise execution;
-   Exercise completion;
-   Exercise score/success evidence;
-   Activity completion;
-   Activity performance;
-   Percurso progress.

Attempts attach to Exercises, not directly to Activities.

## 2. Current State

SPEC-004 establishes:

-   canonical Activity identity;
-   ordered Activity composition;
-   canonical Exercise identity;
-   Exercises as the interactive units participating in Activity
    completion;
-   all current Exercises as required unless a future optional-exercise
    capability is explicitly introduced.

SPEC-005 establishes:

-   H5P as one Exercise implementation;
-   the `PFY Exercise UUID <-> PFY H5P Adapter <-> Lumi content id`
    boundary;
-   authorized H5P playback;
-   the technical event seam consumed by this SPEC;
-   `client_reported` as the trust classification for H5P browser
    scoring evidence.

The H5P spike demonstrated:

-   server-created attempt context;
-   append-only multiple attempts;
-   attempt isolation;
-   start/completion/score/success/duration capture;
-   reload idempotency;
-   top-level event filtering;
-   sub-content filtering;
-   non-scoring completion;
-   preservation of prior attempts.

The previous SPEC-006 predates the composed Activity model and describes
repetition as repeating an Activity.

That interpretation is stale.

The canonical execution unit is now Exercise.

## 3. Problem / Gap

Playback alone does not create durable PFY learning history.

PFY needs a canonical model that can answer, without relying on Lumi
state:

-   which Exercise a learner executed;
-   how many times it was executed;
-   whether an execution completed;
-   what score/success/duration evidence exists;
-   what the learner's current Exercise performance evidence is;
-   whether an Activity is not started, in progress or completed;
-   whether a completed or in-progress Activity has pedagogical
    attention evidence;
-   what history the learner may see.

Without this specification, runtime events could incorrectly become
Activity-level attempts, previous executions could be overwritten,
non-scoring Exercises could be treated as zero, and Activity completion
could be incorrectly tied to score.

## 4. Authoritative Decision

PFY adopts the following learning-evidence hierarchy:

``` text
Activity
   ↓
Exercise
   ↓
Attempt
   ↓
Result evidence
```

### Attempt

An Attempt represents one learner execution of one Exercise.

Attempts are append-only.

A repeated Exercise creates a new Attempt.

Previous Attempts remain historical evidence.

### Current Exercise evidence

When current Exercise performance is needed, PFY uses the learner's
latest completed Attempt for that Exercise.

An incomplete later Attempt does not erase the latest completed
evidence.

### Activity Progress

Activity Progress is PFY-owned:

``` text
not_started
in_progress
completed
```

Current completion rule:

``` text
Activity completed
=
all required Exercises completed
```

Score does not determine Activity completion.

Editorial/media blocks do not create artificial completion requirements.

### Activity Performance

Activity Performance is separate from Activity Progress.

Current product states are:

``` text
no_score
adequate
attention
needs_review
```

The approved `needs_review` rule is:

``` text
scorable Exercises whose latest completed score is < 50%
---------------------------------------------------------
total scorable Exercises

>= 50%
```

`needs_review` does not:

-   make the Activity incomplete;
-   represent automatic failure;
-   block Percurso progression;
-   assign remediation;
-   change learner level;
-   establish CEFR mastery.

The authoritative documents do not yet define a complete deterministic
Activity-level aggregation rule distinguishing `adequate` from
`attention` in every remaining scored case.

That missing rule is preserved as an explicit decision gate in this SPEC
rather than invented by implementation.

## 5. Scope

### 5.1 Exercise Attempt persistence

Implement canonical Attempt persistence sufficient to represent:

-   PFY Attempt identity;
-   learner identity;
-   canonical PFY Exercise identity;
-   monotonic attempt number for learner + Exercise;
-   start timestamp;
-   completion timestamp when applicable;
-   completion state;
-   score where available;
-   maximum/denominator where required to interpret score;
-   normalized score/percentage where the approved model requires it;
-   success/pass evidence where available;
-   duration where available;
-   score provenance;
-   created/updated technical timestamps where appropriate.

Attempt identity must not depend on Lumi content identity.

### 5.2 Server-created Attempt context

The server must create Attempts.

The browser must not choose arbitrary PFY Attempt IDs.

For H5P-backed Exercises, PFY must issue an unguessable attempt-bound
context/token sufficient to associate accepted runtime evidence with the
correct:

-   learner;
-   Exercise;
-   Attempt.

The exact token format is implementation freedom.

### 5.3 Monotonic attempt numbering

Attempt numbering is scoped to:

``` text
learner + Exercise
```

A new execution receives the next attempt number.

Attempt-number allocation must be concurrency-safe.

Two concurrent starts must not receive the same attempt number.

### 5.4 Append-only history

Starting a new Attempt must not overwrite previous Attempts.

Completed historical Attempts must remain immutable learning evidence
except for explicitly bounded technical corrections that preserve
auditability.

Implementation must not use an upsert pattern that collapses repeated
executions into one row.

### 5.5 Attempt lifecycle

The minimum Attempt lifecycle must support:

``` text
started
completed
```

An Attempt may remain started/incomplete.

Completion must be idempotent.

Repeated delivery of the same completion evidence must not create
duplicate completed Attempts or corrupt historical evidence.

Do not invent abandonment/failure lifecycle semantics unless technically
necessary and contract-preserving.

### 5.6 H5P event normalization

For H5P-backed Exercises, normalize supported top-level runtime evidence
into the current Attempt.

Relevant evidence may include:

-   started/execution context;
-   completion;
-   score;
-   success/pass;
-   duration.

Only events belonging to the intended top-level Exercise execution may
complete/update the parent Attempt.

Sub-content statements must not prematurely complete the Exercise
Attempt.

### 5.7 Score provenance

H5P scoring evidence originates from browser execution.

Store:

``` text
score_provenance = client_reported
```

Do not label H5P score as server-authoritative.

The schema may support future provenance values, but SPEC-006 must not
invent unsupported trust semantics.

### 5.8 Non-scoring Exercises

A valid Exercise may complete without a score.

For non-scoring completed evidence:

-   score remains null;
-   success/pass may remain null;
-   completion remains valid.

Missing score must never be converted to zero.

### 5.9 Latest completed Attempt

Current Exercise evidence uses the latest completed Attempt.

Examples:

``` text
Attempt 1 = completed, 80%
Attempt 2 = started, incomplete

current completed evidence = Attempt 1
```

``` text
Attempt 1 = completed, 40%
Attempt 2 = completed, 75%

current completed evidence = Attempt 2
```

Historical Attempts remain available independently.

### 5.10 Activity Progress

Implement Activity Progress derived from Exercise evidence.

States:

``` text
not_started
in_progress
completed
```

Minimum semantics:

#### `not_started`

No Exercise in the Activity has learner Attempt evidence.

#### `in_progress`

At least one Exercise has been started or completed, but not all
required Exercises are completed.

#### `completed`

Every required Exercise in the Activity has at least one completed
Attempt.

The current product contract treats all Exercises in an Activity as
required.

SPEC-006 must not introduce optional Exercises.

Activity Progress may be materialized or derived according to
implementation needs, provided canonical evidence remains coherent and
concurrency-safe.

### 5.11 Activity completion timestamp

If PFY persists an Activity completion timestamp, it must represent the
transition at which the Activity first satisfied the completion rule.

Repeating Exercises after Activity completion must not make the Activity
incomplete or erase the original completion history.

The exact persistence/derivation strategy is implementation freedom
provided historical meaning is preserved.

### 5.12 Activity Performance

Implement the authoritative portions of Activity Performance:

-   `no_score`;
-   `needs_review`;
-   use of latest completed Attempt per Exercise;
-   separation from Activity Progress.

`no_score` applies when there is no applicable scorable completed
Exercise evidence from which Activity performance can be evaluated.

`needs_review` applies when 50% or more of the Activity's scorable
Exercises have a latest completed score below 50%.

The implementation must not invent the unresolved Activity-level
distinction between `adequate` and `attention`.

That distinction must be resolved before this SPEC is promoted to
`ACTIVE — IMPLEMENTATION READY`.

### 5.13 Learner feedback contract

PFY must present Activity completion and Activity performance
separately.

The learner must be able to understand that an Activity may be completed
even when review is recommended.

For `needs_review`, supportive wording may communicate that the Activity
was completed while recommending review.

Do not use failure/mastery language unless supported by a separate
explicit contract.

### 5.14 Learner own history

An authenticated learner may access their own authorized learning
history.

At minimum, the model/API must support retrieval of:

-   Exercise Attempt history;
-   latest completed Exercise evidence;
-   Activity Progress;
-   Activity Performance where deterministically defined.

The learner must not gain access to another learner's Attempt history
through identifiers or query manipulation.

Teacher monitoring belongs to SPEC-008.

### 5.15 Percurso progress integration seam

SPEC-006 establishes Activity completion evidence that later/current
Percurso progress can consume.

The canonical rule remains:

``` text
completed applicable Activities
--------------------------------
total applicable Activities
```

SPEC-006 must not calculate Percurso progress from average Exercise
scores.

Whether Percurso progress is physically materialized in this SPEC is
implementation freedom only if required by the existing read model and
does not expand product scope.

## 6. Out of Scope

SPEC-006 must not implement:

-   H5P runtime deployment;
-   H5P content mapping;
-   H5P authoring;
-   Activity composition authoring;
-   teacher-student invitations;
-   teacher monitoring;
-   institutional reporting;
-   PFY Impact reporting;
-   formal assignments;
-   automatic remediation;
-   AI recommendations;
-   predictive learner-risk classification;
-   CEFR mastery;
-   competency/category mastery scores;
-   generic learner progress percentages without a defined denominator;
-   certificates;
-   gamification;
-   historical WordPress learning-data migration;
-   raw legacy xAPI migration;
-   licensing;
-   entitlements;
-   billing;
-   organization administration.

## 7. Data Semantics and Invariants

### Attempt ownership

Each Attempt belongs to exactly:

-   one learner;
-   one Exercise.

An Attempt does not belong directly to an Activity as its execution
unit.

Activity association is derived through Exercise ownership.

### Append-only invariant

A new execution creates a new Attempt.

Historical completed Attempt evidence is never replaced by a later
execution.

### Attempt number invariant

For a learner + Exercise pair:

``` text
1, 2, 3, ...
```

Numbers are monotonic and concurrency-safe.

### Completion invariant

Exercise completion is independent from score.

### Score nullability invariant

No score means `null`, not `0`.

### Provenance invariant

H5P browser score evidence is `client_reported`.

### Latest-evidence invariant

Current Exercise performance uses the latest completed Attempt.

### Activity completion invariant

Activity completion depends on required Exercise completion, not score.

### Activity performance invariant

Activity Performance cannot alter Activity Progress.

### Percurso invariant

Activity Performance cannot remove a completed Activity from Percurso
completion.

## 8. H5P Tracking Boundary

For H5P-backed Exercises:

``` text
H5P browser runtime
        ↓
attempt-bound event channel
        ↓
PFY H5P Adapter
        ↓
validation/filtering
        ↓
Exercise Attempt evidence
```

PFY must validate:

-   attempt context/token;
-   authenticated/authorized learner context;
-   Exercise association;
-   accepted top-level event semantics;
-   idempotency.

The browser must not be trusted to choose:

-   learner identity;
-   arbitrary Attempt identity;
-   arbitrary Exercise ownership.

Lumi runtime identity must not replace PFY Exercise identity in learning
records.

## 9. Raw xAPI Retention

Raw xAPI retention is not required for canonical PFY learning semantics.

Canonical Attempt/Result evidence must not depend on indefinite raw
statement retention.

If implementation proposes retaining raw xAPI statements beyond
short-lived technical processing/debugging, return:

`DECISION REQUIRED — RAW XAPI RETENTION`

before establishing a durable retention policy.

The decision must address:

-   purpose;
-   retention period;
-   access;
-   privacy;
-   deletion;
-   operational cost.

Absence of a raw-retention decision must not block normalized
Attempt/Result implementation.

## 10. Authorization and Privacy

SPEC-006 depends on the established authentication/authorization
foundation.

At minimum:

-   learner may read their own authorized learning evidence;
-   learner cannot read another learner's Attempts;
-   learner cannot submit evidence for another learner;
-   client-supplied learner IDs are not trusted as authorization;
-   service credentials remain server-side;
-   Attempt creation/update routes enforce authenticated context;
-   direct database access is protected by applicable RLS/server
    authorization conventions.

Teacher access is not introduced here.

Institutional access is not introduced here.

## 11. Activity Performance Decision Gate

Before activation, PFY must define the remaining deterministic
Activity-level aggregation rule for:

``` text
adequate
attention
```

The existing authoritative contracts already define:

-   `no_score`;
-   `needs_review`;
-   Exercise-level low evidence for the `needs_review` rule as score
    `< 50%`;
-   latest completed Attempt as current Exercise evidence.

They do not currently define how every scored Activity that does **not**
satisfy `needs_review` is divided between `adequate` and `attention`.

Implementation must not infer this from:

-   average score;
-   highest score;
-   lowest score;
-   number of Exercises;
-   prototype mock data;
-   implementation convenience.

Until this rule is approved and added to authoritative product
documentation, this SPEC remains:

**PLANNED --- DECISION READY / ACTIVITY PERFORMANCE AGGREGATION
REQUIRED**

## 12. Expected Behavior

After implementation:

1.  starting an Exercise creates a server-owned Attempt;
2.  repeating the same Exercise creates a distinct Attempt;
3.  previous Attempts remain intact;
4.  Attempt numbering is monotonic per learner + Exercise;
5.  H5P evidence is bound to the correct Attempt;
6.  invalid/expired/mismatched attempt context cannot update another
    Attempt;
7.  sub-content events cannot complete the parent Exercise Attempt;
8.  duplicate completion delivery is idempotent;
9.  a non-scoring Exercise can complete with null score/success;
10. H5P score provenance is `client_reported`;
11. latest completed Attempt supplies current Exercise performance
    evidence;
12. an incomplete newer Attempt does not erase previous completed
    evidence;
13. Activity becomes `in_progress` when applicable Exercise work begins;
14. Activity becomes `completed` when all required Exercises complete;
15. score never determines Activity completion;
16. a completed Activity remains completed when an Exercise is repeated;
17. `needs_review` can coexist with `completed`;
18. `needs_review` follows the approved 50%-of-scorable-Exercises rule;
19. Activity Performance does not block Percurso progression;
20. learner own-history is authorization-safe.

## 13. Impact Surface

### Directly affected

-   PostgreSQL learning-evidence schema/migrations;
-   Exercise Attempt domain/application layer;
-   H5P tracking adapter/event ingestion;
-   Attempt token/context mechanism;
-   Activity Progress derivation/persistence;
-   Activity Performance derivation/persistence;
-   learner history APIs/read models;
-   learner result/completion UI required by this SPEC;
-   RLS/server authorization;
-   tests;
-   documentation.

### Explicitly unaffected

-   Activity composition;
-   Exercise identity ownership;
-   H5P content/runtime mapping;
-   Activity authoring;
-   teacher-student relationship model;
-   teacher monitoring;
-   institutional reporting;
-   licensing/billing;
-   legacy migration strategy.

### Downstream dependencies

SPEC-006 establishes canonical learning evidence consumed by:

-   SPEC-008 --- Teacher--Student Relationships & Monitoring;
-   SPEC-011 --- Institutional Reporting & PFY Impact Privacy Layer;
-   SPEC-015 --- Optional Historical Learning Data Migration.

## 14. Acceptance Criteria

### Attempt creation/history

-   [ ] Attempt has canonical PFY identity.
-   [ ] Attempt references canonical PFY Exercise identity.
-   [ ] Attempt references the authenticated learner.
-   [ ] Server creates Attempt identity/context.
-   [ ] Repeating an Exercise creates a distinct Attempt.
-   [ ] Previous completed Attempts remain unchanged.
-   [ ] Attempt numbering is monotonic per learner + Exercise.
-   [ ] Concurrent Attempt starts cannot allocate duplicate attempt
    numbers.

### Attempt security

-   [ ] Browser cannot choose arbitrary Attempt IDs.
-   [ ] Invalid attempt context/token cannot update an Attempt.
-   [ ] Attempt context for one Exercise cannot update another Exercise.
-   [ ] One learner cannot submit evidence for another learner.
-   [ ] Relevant negative authorization/RLS tests pass.

### H5P normalization

-   [ ] Supported top-level H5P completion/scoring evidence normalizes
    into the bound Exercise Attempt.
-   [ ] Sub-content events do not complete the parent Attempt.
-   [ ] Duplicate completion is handled idempotently.
-   [ ] H5P score provenance is stored as `client_reported`.
-   [ ] Lumi content identity does not become canonical learning-record
    identity.

### Non-scoring semantics

-   [ ] Exercise may complete without score.
-   [ ] Missing score remains null.
-   [ ] Missing success/pass remains null where no evidence exists.
-   [ ] Missing score is never converted to zero.

### Latest completed evidence

-   [ ] Latest completed Attempt is deterministically identifiable.
-   [ ] An incomplete newer Attempt does not replace latest completed
    evidence.
-   [ ] Completing a newer Attempt updates current Exercise evidence
    without deleting history.

### Activity Progress

-   [ ] Activity supports `not_started`, `in_progress`, `completed`.
-   [ ] No Exercise evidence yields `not_started`.
-   [ ] Partial Exercise work yields `in_progress`.
-   [ ] All required Exercises completed yields `completed`.
-   [ ] Score does not affect Activity completion.
-   [ ] Editorial/media blocks do not create artificial completion
    requirements.
-   [ ] Repeating an Exercise after Activity completion does not revert
    Activity completion.

### Activity Performance

-   [ ] Activity Performance is independent from Activity Progress.
-   [ ] `no_score` behavior follows the authoritative contract.
-   [ ] `needs_review` uses latest completed Attempt evidence.
-   [ ] `needs_review` triggers when \>= 50% of scorable Exercises have
    latest completed score \< 50%.
-   [ ] Non-scoring Exercises are excluded from the `needs_review`
    denominator.
-   [ ] `needs_review` does not make Activity incomplete.
-   [ ] `needs_review` does not block Percurso progression.
-   [ ] No unsupported average/mastery metric is introduced.
-   [ ] `adequate`/`attention` aggregation is implemented only after the
    decision gate in Section 11 is resolved.

### Learner history

-   [ ] Learner can retrieve own Exercise Attempt history.
-   [ ] Learner can retrieve own current Activity Progress.
-   [ ] Learner can retrieve deterministically defined Activity
    Performance.
-   [ ] Learner cannot retrieve another learner's history.

### Validation

-   [ ] Relevant database tests pass.
-   [ ] Relevant unit/integration tests pass.
-   [ ] H5P tracking tests pass.
-   [ ] Concurrency tests cover Attempt numbering.
-   [ ] Browser/E2E tests cover completion and repetition behavior.
-   [ ] Browser/E2E tests cover scoring and non-scoring Exercises.
-   [ ] Browser/E2E tests cover an Activity with multiple Exercises.
-   [ ] Type-check/lint/build checks pass.
-   [ ] No authoritative product/architecture contract was silently
    changed.

## 15. Implementation Freedom

Implementation may choose reversible technical details including:

-   Attempt table naming;
-   Result fields colocated with Attempt versus a related normalized
    record;
-   token format and signing mechanism;
-   derived versus materialized Activity Progress;
-   derived versus materialized Activity Performance;
-   internal event-normalization structure;
-   transaction/locking strategy;
-   indexes;
-   learner-history route/read-model structure;
-   short-lived technical event buffering.

Implementation freedom does not include changing:

-   Exercise as Attempt-producing unit;
-   append-only Attempts;
-   learner + Exercise attempt numbering;
-   server-created Attempt context;
-   latest completed Attempt semantics;
-   score nullability;
-   `client_reported` H5P score provenance;
-   Activity completion rule;
-   separation of Activity Progress and Performance;
-   approved `needs_review` rule;
-   authorization boundaries.

If implementation evidence requires changing one of these contracts,
return:

`BLOCKED / DECISION REQUIRED`

## 16. Deliberately Deferred Work

### Teacher monitoring

SPEC-008.

### Institutional reporting

SPEC-011.

### Historical learning migration

SPEC-015.

### Raw xAPI durable retention

Requires a separate explicit decision only if proposed.

### Optional Exercises

Not part of the current product contract.

### Automatic remediation

Future vision.

### CEFR/category/competency mastery

Not currently defined.

### Generic learner progress percentage

Not currently defined outside explicit denominators such as Percurso
completed Activities / total Activities.

## 17. Knowledge Updates Required

At completion:

1.  document the verified Attempt/Result physical schema;
2.  document concurrency strategy for attempt numbering;
3.  document attempt-context/token flow;
4.  document supported H5P event-normalization behavior;
5.  document score provenance and null semantics;
6.  document Activity Progress derivation/persistence;
7.  document the final approved Activity Performance aggregation;
8.  update `docs/ARCHITECTURE.md` only if verified implementation
    establishes a durable architecture clarification;
9.  update `resources/specs/README.md`;
10. reconcile SPEC-008, SPEC-011 and SPEC-015 against the implemented
    canonical evidence model;
11. move this SPEC to `completed/` only after implementation, validation
    and durable knowledge reconciliation.

## 18. Open Questions / Blockers

### Blocking before activation

`DECISION REQUIRED — ACTIVITY PERFORMANCE ADEQUATE/ATTENTION AGGREGATION`

PFY must define how a scored Activity that does not satisfy
`needs_review` is deterministically classified as `adequate` versus
`attention`.

### Non-blocking

`RAW XAPI RETENTION`

No decision is needed if raw xAPI is not durably retained.

## 19. Activation Gate

This SPEC remains:

**PLANNED --- DECISION READY / ACTIVITY PERFORMANCE AGGREGATION
REQUIRED**

Promote to `ACTIVE — IMPLEMENTATION READY` only when:

``` text
SPEC-005 completed/coherence state sufficient for tracking integration
+ Activity Performance adequate/attention rule approved
+ authoritative documentation updated
+ repository state revalidated
+ no new blocking contradiction
= ACTIVE — IMPLEMENTATION READY
```

Do not implement from `planned/`.

## 20. Completion Gate

Passing tracking tests alone does not complete SPEC-006.

Completion requires:

``` text
append-only Exercise Attempts
+ concurrency-safe numbering
+ secure attempt-bound H5P normalization
+ scoring/non-scoring semantics
+ latest completed Attempt semantics
+ Activity Progress
+ complete approved Activity Performance
+ learner own-history
+ authorization/RLS verification
+ browser validation
+ documentation reconciliation
= completed
```

At that point:

-   change status to `COMPLETED — COHERENCE VERIFIED`;
-   move the file to `resources/specs/completed/`;
-   update `resources/specs/README.md`;
-   identify the next eligible planned SPEC for activation.
