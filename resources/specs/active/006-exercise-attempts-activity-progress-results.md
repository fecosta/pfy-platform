# SPEC-006 --- Exercise Attempts, Activity Progress & Results

**Status:** ACTIVE --- IMPLEMENTATION READY\
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

### Assessment mode and scoring policy

Each Exercise carries two Exercise-owned configuration properties, never
inferred from learner Attempt evidence (`docs/PRODUCT_DEFINITION.md`
§4.3a):

``` text
assessment_mode: automatic | manual | none
scoring_policy:  required | optional | none
```

`automatic` evaluation/result evidence comes from the Exercise's
runtime/interactive implementation (H5P for MVP). `manual` evaluation
requires an authorized human reviewer; the Exercise may complete/submit
before evaluation exists. `none` requires no pedagogical evaluation.

`scoring_policy` is independent of `assessment_mode`: `required` expects
a score on valid evaluation, `optional` allows evaluation with or
without a score, `none` means the Exercise is not scored.

### Manual Evaluation

For `manual`-assessment Exercises, a learner's Attempt/submission
evidence is evaluated by a separate `Evaluation` record
(`docs/PRODUCT_DEFINITION.md` §10a):

``` text
Exercise
   ↓
Attempt (learner submission/evidence)
   ↓
Evaluation (evaluator identity, feedback, optional score, timestamp)
```

Evaluation is never merged into or used to mutate learner-authored
Attempt content. A manually assigned score is never labeled
`client_reported`. An Attempt has at most one current Evaluation for
MVP; re-review/correction workflows are not defined by this SPEC.

Evaluator feedback tied to an Attempt is durable canonical learner
history: the learner may later see it.

Evaluation authorization (who may evaluate a given learner's submission)
is owned by SPEC-008's Teacher-Student relationship boundary. SPEC-006
defines only the minimal seam needed to persist Evaluation safely --
see Section 10a.

### Activity Performance

Activity Performance is separate from Activity Progress.

Current product states are:

``` text
no_score
adequate
attention
needs_review
```

An Exercise enters the Activity Performance denominator (an "evaluable
scored Exercise") when `scoring_policy` is `required` or `optional` AND
current valid score evidence exists -- the latest completed Attempt's
score for `automatic` Exercises, or the current Evaluation's score for
`manual` Exercises. `scoring_policy = none` Exercises, and
`required`/`optional` Exercises without current valid score (e.g.
awaiting manual review, or reviewed without a score), are excluded from
the denominator without being treated as scored zero
(`docs/PRODUCT_DEFINITION.md` §12).

The approved deterministic aggregation rule is:

``` text
proportion = (evaluable scored Exercises with current score < 50%)
           / (total evaluable scored Exercises)

no evaluable scored Exercise -> no_score
proportion >= 50%            -> needs_review
0% < proportion < 50%        -> attention
proportion == 0%             -> adequate
```

Do not use average score, highest score, lowest score, Exercise count
or prototype mock data. Do not introduce a 70% threshold.

`needs_review` does not:

-   make the Activity incomplete;
-   represent automatic failure;
-   block Percurso progression;
-   assign remediation;
-   change learner level;
-   establish CEFR mastery.

A `manual`-assessment Exercise counts as completed for Activity Progress
at learner submission, not at evaluation (see Section 5.10a); Activity
Performance never delays or blocks Activity completion.

## 5. Scope

### 5.0 Exercise assessment configuration

Implement persistence for the Exercise-owned `assessment_mode`
(`automatic`/`manual`/`none`) and `scoring_policy`
(`required`/`optional`/`none`) defined in Section 4. This is new Exercise
configuration; SPEC-004's `exercises` table exists but does not yet carry
this contract (Section 13 lists the resulting schema change). H5P
content/library metadata may seed an authoring-time default but is never
authoritative over the persisted configuration.

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

### 5.6a Manual Exercise submission and Evaluation persistence

For `manual`-assessment Exercises, implement:

-   persistence of the learner's submission/evidence on the Attempt
    (content/body field; size bound and sanitization required for any
    free-text/HTML learner content -- see Section 10);
-   a distinct `Evaluation` record referencing the Attempt, carrying
    evaluator identity, feedback, optional score (per `scoring_policy`),
    evaluation timestamp and provenance;
-   a minimal status distinguishing at least: submitted/awaiting review,
    and reviewed. Exact naming (e.g. `assessment_status`) is
    implementation freedom; the product semantics required are:
    completed/submitted, awaiting manual review, reviewed with score,
    reviewed without score.
-   the smallest authorization primitive necessary to let an authorized
    evaluator write an Evaluation for a given learner's Attempt safely
    (server-side check plus RLS), without implementing SPEC-008's
    invitation/relationship lifecycle. Where SPEC-008 has not yet
    established the relationship table, the evaluator-authorization
    check is a documented seam/dependency, not a full implementation
    (Section 10).

Evaluation must never mutate or overwrite the learner's Attempt/
submission content.

### 5.7 Score provenance

H5P scoring evidence originates from browser execution.

Store:

``` text
score_provenance = client_reported
```

Do not label H5P score as server-authoritative.

A manually assigned score carries a distinct provenance value
representing human evaluator origin (e.g. `evaluator_reported`; exact
naming is implementation freedom). It must never be stored as
`client_reported`.

The schema may support future provenance values, but SPEC-006 must not
invent unsupported trust semantics beyond `client_reported` and the
manual-evaluator provenance defined here.

### 5.8 Non-scoring Exercises

A valid Exercise may complete without a score.

For non-scoring completed evidence:

-   score remains null;
-   success/pass may remain null;
-   completion remains valid.

Missing score must never be converted to zero.

### 5.9 Latest completed Attempt / current Evaluation

Current Exercise evidence uses the latest completed Attempt for
`automatic` Exercises. For `manual` Exercises, current score evidence
(if any) comes from the current Evaluation of the latest completed
Attempt; the Attempt is still "current" once submitted, independent of
whether it has been evaluated.

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
Attempt. For `manual`-assessment Exercises, "completed" means the
learner has submitted, regardless of evaluation state -- Activity
Progress must not wait for manual review (Section 4, Manual Evaluation).

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

Implement the full approved Activity Performance contract:

-   `no_score`, `adequate`, `attention`, `needs_review`;
-   the evaluable-scored-Exercise denominator (Section 4, Activity
    Performance) -- `scoring_policy` in (`required`, `optional`) AND
    current valid score evidence exists;
-   use of latest completed Attempt (`automatic`) or current Evaluation
    (`manual`) per Exercise;
-   separation from Activity Progress.

Deterministic rule (proportion = evaluable scored Exercises with
current score < 50% / total evaluable scored Exercises):

``` text
no evaluable scored Exercise -> no_score
proportion >= 50%            -> needs_review
0% < proportion < 50%        -> attention
proportion == 0%             -> adequate
```

Do not use average/highest/lowest score, Exercise count or prototype
mock data. Do not introduce a 70% threshold.

### 5.12a Historical assessment/scoring configuration changes

Attempts and Evaluations remain historical evidence. Changing an
Exercise's `assessment_mode`/`scoring_policy` must never rewrite prior
Attempt/submission/Evaluation records. Current Activity Performance is a
live view computed from the Exercise's **current** configuration applied
to current valid score evidence -- it is not a replay of historical
configuration.

If implementation evidence surfaces a configuration-change scenario this
SPEC does not resolve (e.g. reclassifying already-scored historical
evidence under a newly `scoring_policy = none` Exercise), return
`DECISION REQUIRED — HISTORICAL ASSESSMENT CONFIGURATION SEMANTICS`
rather than inventing a resolution. This must not block the rest of
SPEC-006's implementation.

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
-   latest completed Exercise evidence, including any current Evaluation
    (feedback and/or score) for `manual` Exercises;
-   Activity Progress;
-   Activity Performance, fully defined per Section 5.12.

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

### Completion / review / score separation invariant

Completion, manual review and score are three distinct concepts
(`docs/PRODUCT_DEFINITION.md` §10a). A learner may complete/submit a
`manual` Exercise before review exists. A review may exist without a
score. Implementation must not collapse these into one status.

### Score nullability invariant

No score means `null`, not `0`.

### Provenance invariant

H5P browser score evidence is `client_reported`. Manually assigned score
evidence carries a distinct evaluator-origin provenance and must never
be stored as `client_reported`.

### Evaluation immutability invariant

Evaluation is a record distinct from the Attempt/submission it evaluates
and must never mutate or overwrite learner-authored Attempt content.

### Scoreability invariant

`assessment_mode` and `scoring_policy` are Exercise-owned configuration,
never inferred from the presence or absence of scores in existing
Attempts. An unattempted Exercise has known assessment/scoring
semantics.

### Latest-evidence invariant

Current Exercise performance uses the latest completed Attempt
(`automatic`) or the current Evaluation of the latest completed Attempt
(`manual`).

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

For manual Evaluation (minimal seam only -- full lifecycle is SPEC-008):

-   the learner owns their submission/Attempt content and cannot alter
    an Evaluation of it;
-   one learner must not read another learner's submission or
    Evaluation;
-   evaluator identity is not exposed beyond what the product contract
    permits;
-   writing an Evaluation requires an explicit authorization check tied
    to the evaluator's relationship to the learner. Until SPEC-008
    exists, this SPEC must implement the smallest server-side/RLS
    primitive sufficient to prevent an arbitrary authenticated user from
    writing an Evaluation for an arbitrary learner's Attempt (e.g.
    restricting Evaluation writes to a privileged/service-role context
    invoked by a bounded internal action), and must document the
    dependency on SPEC-008 replacing that primitive with real
    relationship-scoped authorization;
-   service-role shortcuts must not become the general authorization
    model -- they are acceptable only as the documented minimal seam
    above.
-   free-text learner submission content and evaluator feedback require
    sanitization/size bounds consistent with the platform's existing
    user-generated-content handling to avoid stored-XSS and unbounded
    storage; do not render either as trusted HTML without sanitization.

Teacher access lifecycle (invitation, acceptance, revocation, listing)
is not introduced here.

Institutional access is not introduced here.

## 11. Activity Performance Decision Record (resolved)

This section previously blocked activation. Both decisions below are now
approved and reconciled into `docs/PRODUCT_DEFINITION.md` §4.3a/§12 and
`docs/ARCHITECTURE.md` §7/§13.

### Exercise scoreability / assessment semantics -- RESOLVED

Scoreability is defined by two Exercise-owned configuration properties,
never inferred from Attempt evidence:

``` text
assessment_mode: automatic | manual | none
scoring_policy:  required | optional | none
```

This addresses the open questions from the prior gate:

-   **where scoreability is defined:** on the PFY Exercise, not on H5P
    content/library metadata. H5P metadata may seed an authoring-time
    default only;
-   **H5P content that completes without a score or reports a maximum
    score of zero:** modeled as `scoring_policy = none` (or `optional`
    with no score produced), not as a zero score;
-   **content types whose scoring depends on configuration:** the PFY
    Exercise configuration is authoritative regardless of the
    implementation technology's own configurability;
-   **scoreability changing after Attempts exist:** history is
    preserved (Section 5.12a); current Activity Performance uses current
    configuration; an unresolved historical-interpretation scenario
    returns `DECISION REQUIRED — HISTORICAL ASSESSMENT CONFIGURATION
    SEMANTICS` rather than inventing behavior.

This affects SPEC-004 (Exercise model gains `assessment_mode`/
`scoring_policy`) -- see Section 13.

### Activity Performance adequate/attention aggregation -- RESOLVED

``` text
proportion = (evaluable scored Exercises with current score < 50%)
           / (total evaluable scored Exercises)

no evaluable scored Exercise -> no_score
proportion >= 50%            -> needs_review
0% < proportion < 50%        -> attention
proportion == 0%             -> adequate
```

An "evaluable scored Exercise" is defined in Section 5.12. This is not
average, highest, lowest score, Exercise count or prototype mock data.

### UX prototype input -- superseded

The UX prototype's per-Exercise `>= 70%` adequate / `>= 50%` attention /
`< 50%` needs_review bands (`resources/ux/PROTOTYPE-CONFLICTS.md`,
UXC-13) were recorded only as input and are **not** the approved rule.
The approved rule above is Activity-level, uses no 70% threshold, and
`needs_review` remains an Activity-level state, never an Exercise label.
UXC-12 and UXC-13 have been updated to reflect this resolution.

### Gate state

Both decisions are resolved and reconciled into authoritative
documentation. This gate no longer blocks activation.

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
18. `needs_review` follows the approved evaluable-scored-Exercise rule
    (Section 5.12);
19. Activity Performance does not block Percurso progression;
20. learner own-history is authorization-safe;
21. a `manual`-assessment Exercise completes the Activity at learner
    submission, before any Evaluation exists;
22. an Evaluation never mutates the learner's Attempt/submission
    content;
23. a manually assigned score is never stored as `client_reported`;
24. an Exercise with `scoring_policy = optional` reviewed without a
    score is excluded from the Activity Performance denominator without
    being treated as a zero score;
25. Activity Performance deterministically resolves to `adequate`,
    `attention`, `needs_review` or `no_score` per the rule in Section
    5.12.

## 13. Impact Surface

### Directly affected

-   PostgreSQL learning-evidence schema/migrations, including a new
    `exercises.assessment_mode`/`scoring_policy` configuration (additive
    migration on the SPEC-004 `exercises` table -- see Section 13a);
-   Exercise Attempt domain/application layer;
-   manual submission storage (Attempt content/body) and Evaluation
    domain/application layer;
-   H5P tracking adapter/event ingestion;
-   Attempt token/context mechanism;
-   Activity Progress derivation/persistence;
-   Activity Performance derivation/persistence;
-   learner history APIs/read models, including Evaluation retrieval;
-   learner result/completion UI required by this SPEC;
-   RLS/server authorization, including the minimal Evaluation-write
    authorization seam;
-   tests;
-   documentation.

### Explicitly unaffected

-   Activity composition;
-   Exercise identity ownership;
-   H5P content/runtime mapping;
-   Activity authoring;
-   teacher-student relationship lifecycle (invitation/acceptance/
    revocation) -- SPEC-006 implements only the minimal Evaluation-write
    authorization seam, not the relationship model;
-   teacher monitoring UI/workflow;
-   institutional reporting;
-   licensing/billing;
-   legacy migration strategy.

### 13a. Exercise model schema impact (SPEC-004 surface)

This SPEC requires an additive migration adding `assessment_mode` and
`scoring_policy` columns/constraints to the existing SPEC-004
`exercises` table (`supabase/migrations/
20260924000000_learning_content_foundation.sql`). `implementation_metadata`
remains a free-form jsonb placeholder today with no defined fields; this
SPEC does not require reusing it -- typed columns are preferred for an
invariant this important. No existing data needs backfill beyond a safe
default (implementation freedom), since no Exercises or Attempts exist
in production yet.

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
-   [ ] `needs_review`/`attention`/`adequate` use current Exercise
    evidence (latest completed Attempt for `automatic`, current
    Evaluation for `manual`).
-   [ ] `needs_review` triggers when \>= 50% of evaluable scored
    Exercises have current score \< 50%.
-   [ ] `attention` triggers when \> 0% and \< 50% of evaluable scored
    Exercises have current score \< 50%.
-   [ ] `adequate` triggers when 0% of evaluable scored Exercises have
    current score \< 50% (at least one evaluable scored Exercise
    exists).
-   [ ] Exercises with `scoring_policy = none`, and `optional`/
    `required` Exercises without current valid score, are excluded from
    the denominator and not treated as scored zero.
-   [ ] `needs_review` does not make Activity incomplete.
-   [ ] `needs_review` does not block Percurso progression.
-   [ ] No unsupported average/mastery metric is introduced.
-   [ ] No 70% threshold is introduced.

### Manual Evaluation

-   [ ] `manual`-assessment Exercise completes the Activity at learner
    submission, independent of review state.
-   [ ] Evaluation never mutates learner Attempt/submission content.
-   [ ] Manually assigned score provenance is distinct from
    `client_reported`.
-   [ ] `scoring_policy = optional` reviewed without score is valid and
    excluded from the Activity Performance denominator.
-   [ ] `scoring_policy = required` Exercise without current valid score
    is excluded from the denominator (not scored zero).
-   [ ] Evaluation write requires the minimal authorization seam
    (Section 10); an arbitrary authenticated user cannot write an
    Evaluation for an arbitrary learner's Attempt.
-   [ ] Free-text submission/feedback content is sanitized/size-bounded.

### Learner history

-   [ ] Learner can retrieve own Exercise Attempt history.
-   [ ] Learner can retrieve own current Activity Progress.
-   [ ] Learner can retrieve deterministically defined Activity
    Performance.
-   [ ] Learner can retrieve any current Evaluation (feedback/score) on
    their own Attempts.
-   [ ] Learner cannot retrieve another learner's history.

### Validation

-   [ ] Relevant database tests pass.
-   [ ] Relevant unit/integration tests pass.
-   [ ] H5P tracking tests pass.
-   [ ] Concurrency tests cover Attempt numbering.
-   [ ] Browser/E2E tests cover completion and repetition behavior.
-   [ ] Browser/E2E tests cover scoring and non-scoring Exercises.
-   [ ] Browser/E2E tests cover an Activity with multiple Exercises.
-   [ ] Tests cover a `manual`-assessment Exercise: submission,
    Activity completion before review, Evaluation with score, Evaluation
    without score (`scoring_policy = optional`).
-   [ ] Tests cover Activity Performance resolving to each of
    `no_score`/`adequate`/`attention`/`needs_review` for a mixed
    automatic+manual Activity.
-   [ ] Negative authorization tests cover Evaluation write/read
    boundaries (Section 10).
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
-   the approved `no_score`/`adequate`/`attention`/`needs_review` rule;
-   the completion/review/score separation (Section 4, Manual
    Evaluation);
-   Evaluation as a record distinct from Attempt/submission content;
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

### Teacher-Student relationship lifecycle

Invitation, acceptance, revocation and relationship listing remain
SPEC-008. SPEC-006 implements only the minimal Evaluation-write
authorization seam described in Section 10.

### Re-review / Evaluation correction workflow

Not defined by MVP. One current Evaluation per Attempt is sufficient.

## 17. Knowledge Updates Required

At completion:

1.  document the verified Attempt/Result/Evaluation physical schema;
2.  document concurrency strategy for attempt numbering;
3.  document attempt-context/token flow;
4.  document supported H5P event-normalization behavior;
5.  document score provenance and null semantics, including the
    evaluator-origin provenance value used for manual scores;
6.  document Activity Progress derivation/persistence;
7.  document the implemented Activity Performance aggregation;
8.  document the minimal Evaluation-write authorization seam and its
    replacement dependency on SPEC-008;
9.  update `docs/ARCHITECTURE.md` only if verified implementation
    establishes a durable architecture clarification;
10. update `resources/specs/README.md`;
11. reconcile SPEC-008, SPEC-011 and SPEC-015 against the implemented
    canonical evidence model;
12. move this SPEC to `completed/` only after implementation, validation
    and durable knowledge reconciliation.

## 18. Open Questions / Blockers

### Blocking before activation

None. Both prior gates (`ACTIVITY PERFORMANCE ADEQUATE/ATTENTION
AGGREGATION` and `EXERCISE SCOREABILITY / ASSESSMENT SEMANTICS`) are
resolved -- see Section 11.

### Non-blocking

`RAW XAPI RETENTION`

No decision is needed if raw xAPI is not durably retained.

`CURRENT PERCURSO SEMANTICS`

The UX prototype shows a learner's "current Percurso"
(`resources/ux/PROTOTYPE-CONFLICTS.md`, UXC-14). This is undefined and
must not be implemented from the prototype. Percurso progress itself
remains derived from Activity completion.

`HISTORICAL ASSESSMENT CONFIGURATION SEMANTICS`

Non-blocking for activation; may surface during implementation per
Section 5.12a if an unresolved historical-interpretation scenario is
encountered. Return `DECISION REQUIRED — HISTORICAL ASSESSMENT
CONFIGURATION SEMANTICS` at that point rather than inventing behavior.

`EVALUATION AUTHORIZATION SEAM`

Non-blocking: Section 10 defines the smallest safe primitive pending
SPEC-008. This is a documented implementation dependency, not an
activation blocker.

## 19. Activation Gate

This SPEC is:

**ACTIVE --- IMPLEMENTATION READY**

Both prior blocking decisions are resolved and reconciled into
`docs/PRODUCT_DEFINITION.md` and `docs/ARCHITECTURE.md`:

``` text
SPEC-005 completed (final re-review remediation closed)
+ Activity Performance adequate/attention rule approved (Section 11)
+ Exercise scoreability/assessment semantics approved (Section 11)
+ manual Evaluation semantics explicit (Section 4, 5.6a, 5.12a)
+ authoritative documentation updated
+ repository state revalidated
+ no remaining blocking contradiction
= ACTIVE — IMPLEMENTATION READY
```

## 20. Completion Gate

Passing tracking tests alone does not complete SPEC-006.

Completion requires:

``` text
append-only Exercise Attempts
+ concurrency-safe numbering
+ secure attempt-bound H5P normalization
+ scoring/non-scoring semantics
+ manual Evaluation semantics (submission, review, optional score)
+ latest completed Attempt / current Evaluation semantics
+ Activity Progress
+ complete approved Activity Performance
+ learner own-history including Evaluation retrieval
+ authorization/RLS verification, including Evaluation seam
+ browser validation
+ documentation reconciliation
= completed
```

At that point:

-   change status to `COMPLETED — COHERENCE VERIFIED`;
-   move the file to `resources/specs/completed/`;
-   update `resources/specs/README.md`;
-   identify the next eligible planned SPEC for activation.
