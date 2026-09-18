# ADR-002 — Activity Composition and H5P Exercise Boundary

**Status:** ACCEPTED  
**Date:** 2026-09-18  
**Decision type:** Product-domain / architecture boundary  
**Related:** `ADR-001-LUMI-H5P-RUNTIME.md`, `PRODUCT_DEFINITION.md`, `ARCHITECTURE.md`

## Context

The original PFY architecture established `Activity` as the fundamental learning-content unit and adopted Lumi H5P as an isolated runtime.

The initial architecture used:

```text
PFY Activity UUID
        ↕
Lumi content id
```

The H5P spike proved import, rendering, authoring and tracking outside WordPress, but later product definition established that a real PFY Activity may contain editorial content, media and multiple H5P interactions.

Therefore:

> A PFY Activity is not equivalent to one H5P content object.

## Decision

PFY adopts a composed Activity model.

`Activity` remains the fundamental PFY learning unit.

An Activity owns an ordered sequence of content blocks.

Interactive blocks that produce learner execution evidence are represented through canonical PFY `Exercise` identity.

H5P is one implementation technology for an Exercise.

```text
Activity
├── Editorial Block
├── Media Block
├── Exercise
│      └── H5P
├── Editorial Block
└── Exercise
       └── H5P
```

The H5P Adapter mapping therefore becomes:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

The canonical Activity identity remains `activities.uuid`.

Each Exercise has its own canonical PFY identity.

Lumi identifiers remain internal runtime identifiers.

## Domain boundary

### PFY Activity owns

- Activity identity;
- title;
- summary;
- cover;
- pedagogical metadata;
- publication lifecycle;
- ordered block composition;
- Exercise membership;
- Activity Progress;
- Activity Performance;
- Percurso membership.

### PFY Exercise owns

- Exercise identity;
- Activity association;
- ordering through Activity composition;
- required-for-completion semantics;
- implementation type;
- learner Attempt association.

### H5P Adapter owns

- mapping between PFY Exercise identity and Lumi content identity;
- authorized runtime model retrieval;
- H5P event normalization;
- attempt-bound communication;
- runtime-specific integration behavior.

### Lumi owns

- H5P content parameters;
- H5P libraries;
- runtime content identity;
- runtime assets;
- player/editor runtime behavior;
- H5P-specific runtime state.

Lumi does not own PFY Activity identity, Activity composition, Activity completion, Activity performance, Percurso progress or teacher-student authorization.

## Attempt boundary

Attempts attach to Exercises, not directly to Activities.

```text
Activity
    ↓
Exercise
    ↓
Attempt
    ↓
Result evidence
```

Attempts remain append-only.

Repeating one Exercise creates a new Attempt for that Exercise without replacing historical Attempts.

## Activity completion

Activity completion is PFY-derived:

```text
Activity completed
=
all required Exercises completed
```

Editorial/media blocks do not generate artificial completion requirements.

Exercise score does not determine Activity completion.

## Activity performance

Activity performance is derived above the Exercise Attempt layer.

Current states:

```text
no_score
adequate
attention
needs_review
```

Current Exercise performance uses the latest completed Attempt for each Exercise.

The approved `needs_review` rule is:

> `needs_review` when 50% or more of the Activity's scorable Exercises have a latest completed score below 50%.

This rule belongs to PFY, not Lumi.

## Percurso boundary

A Syllabus/Percurso contains ordered references to canonical PFY Activities.

```text
Percurso
   ↓
Activity
   ↓
Exercise
   ↓
H5P implementation
```

Percurso progress derives from Activity completion, not H5P score aggregation.

## Authoring consequence

The Lumi editor remains the H5P editor.

It is not the complete PFY Activity editor.

PFY authoring requires a composition layer capable of managing:

- Activity metadata;
- ordered content blocks;
- editorial/media content;
- one or multiple H5P Exercise blocks;
- lifecycle;
- preview and publication.

## Migration consequence

Legacy H5P packages no longer map directly to complete canonical PFY Activities by definition.

A legacy H5P package maps naturally to an H5P-backed PFY Exercise.

Reconstructing a complete legacy Activity may additionally require migration or editorial reconstruction of WordPress editorial content, images, videos, embeds, ordering and metadata.

The strategy remains:

`DECISION REQUIRED — LEGACY ACTIVITY COMPOSITION MIGRATION`

## Security consequences

ADR-001 security invariants remain unchanged.

In particular:

- H5P runs in an isolated Node service;
- imported parameters require sanitization;
- H5P libraries are executable code;
- library installation remains privileged;
- runtime versions remain pinned;
- the browser cannot choose arbitrary PFY Attempt identifiers;
- PFY authorization remains outside Lumi.

## Rejected alternative: Activity equals H5P content

Rejected because it conflicts with verified PFY Activity composition and unnecessarily couples the domain model to H5P.

## Rejected alternative: One Activity per H5P plus external page composition

Rejected as the canonical domain model because it would reproduce the legacy implementation boundary rather than the intended PFY product.

## Rejected alternative: Make every content block an Attempt-producing entity

Rejected for the current product contract.

Editorial text, images, video and other media do not require artificial completion tracking.

Attempt semantics belong to Exercises.

## Consequences

### Positive

- Activity remains pedagogically meaningful and technology-independent.
- One Activity can contain multiple H5P Exercises.
- H5P can later be replaced or supplemented without redefining Activity.
- Attempt semantics become more precise.
- Activity Completion and Performance can be derived consistently.
- Percurso progress remains independent of runtime technology.

### Costs

- The domain model requires Activity composition and Exercise identity.
- H5P mapping becomes more granular.
- Attempt/Result specifications must reference Exercise rather than Activity.
- Legacy migration requires reconstruction beyond `.h5p` import.
- Authoring requires a PFY composition shell around the H5P editor.

These costs are accepted because they represent actual product semantics.

## Relationship to ADR-001

ADR-001 remains accepted.

ADR-002 does not replace the decision to use Lumi or the isolated H5P runtime.

It supersedes only the earlier implicit one-Activity-to-one-Lumi assumption.

Current interpretation:

```text
PFY Exercise UUID <-> Lumi content id
```

through the PFY H5P Adapter.

## Implementation gate

No implementation specification may restore Activity-to-Lumi 1:1 coupling for implementation convenience.

If a technical limitation in Lumi makes the approved Exercise mapping impractical, return:

`BLOCKED / DECISION REQUIRED`
