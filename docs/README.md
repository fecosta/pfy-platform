# Portuguese for You — Authoritative Documentation

**Status:** CURRENT  
**Last reconciled:** 2026-09-19

This directory contains the durable product and architecture knowledge for the greenfield Portuguese for You (PFY) rebuild.

The documents in this directory define current product intent and architecture. Repository history preserves previous versions; canonical documents use stable filenames rather than version suffixes.

## Authoritative documents

### `PRODUCT_DEFINITION.md`

Owns current product intent, including:

- personas;
- Activity, Exercise and Percurso semantics;
- teacher-mediated and independent learning flows;
- Activity Completion and Activity Performance;
- teacher attention / `needs_review`;
- shared Teacher/Student learning architecture;
- business/access model;
- institutional model;
- MVP boundary;
- migration boundaries;
- UX-reference authority.

### `ARCHITECTURE.md`

Owns current architecture intent, including:

- application/platform decisions;
- logical domains;
- canonical data ownership;
- Activity composition;
- Exercise identity;
- Attempt boundary;
- Activity/Percurso progress semantics;
- H5P adapter/runtime boundary;
- authorization model;
- security invariants;
- migration architecture;
- deployment topology.

### `ADR-001-LUMI-H5P-RUNTIME.md`

Records the decision to use Lumi H5P as an isolated runtime and H5P authoring engine, subject to the documented production gates and security invariants.

ADR-001 remains accepted.

### `ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`

Clarifies that:

- Activity is a composed PFY learning unit;
- H5P is not equivalent to Activity;
- Exercise is the Attempt-producing interactive unit;
- the H5P adapter maps PFY Exercise identity to Lumi content identity;
- Activity Completion, Activity Performance and Percurso Progress remain PFY-owned semantics.

Where older evidence refers to:

```text
PFY Activity UUID <-> Lumi content id
```

the current authoritative boundary is:

```text
PFY Exercise UUID <-> Lumi content id
```

through the PFY H5P Adapter.

## Evidence basis

Current product and architecture decisions are based on:

1. PFY product discovery and approved product decisions;
2. the current legacy WordPress product behavior and content structure;
3. the legacy WordPress database structure as migration evidence;
4. the completed `fecosta/pfy-h5p-spike` technical spike;
5. the `CONDITIONAL GO` result for Lumi H5P;
6. the approved PFY UX prototype, used as UX/UI reference rather than domain authority.

The H5P spike repository is evidence, not the production codebase.

The UX prototype is a UX reference, not a replacement for product or architecture documentation.

## Knowledge states

### DECISION

Current decisions include:

- greenfield rebuild;
- Next.js + TypeScript;
- PostgreSQL/Supabase;
- Supabase Auth;
- relationship-aware authorization plus RLS;
- Activity as canonical learning unit;
- block-based Activity composition;
- Exercise as interactive Attempt-producing unit;
- Syllabus/Percurso as first-class pedagogical sequence;
- Lumi H5P in a separate Node runtime;
- PFY-owned H5P adapter;
- PFY Exercise UUID mapped to Lumi content id;
- append-only Exercise Attempts;
- client-reported H5P score provenance;
- Activity Completion independent from score;
- Activity Performance independent from completion;
- `needs_review` when at least 50% of scorable Exercises have a latest completed score below 50%;
- Percurso progress based on Activity completion;
- teacher and student use the same canonical learning content;
- PFY Activity authoring wraps editorial/media composition and H5P Exercise editing.

### PLANNED

Planned work includes:

- physical database schema per active SPEC;
- production H5P deployment configuration;
- payment provider integration;
- Activity authoring usability validation;
- migration tooling;
- legacy Activity-composition migration strategy;
- legacy Syllabus/Percurso migration strategy.

### FUTURE VISION

Future vision includes:

- AI-assisted authoring;
- advanced institutional analytics;
- certificates;
- formal assignments;
- personal teacher collections;
- advanced competency/mastery analytics;
- automatic remediation/recommendations.

These must not be treated as current implementation scope without a new product decision and applicable SPEC.

### REVIEW / DECISION REQUIRED

Still requiring explicit resolution before applicable implementation:

- GPL implications before production H5P distribution/deployment;
- LGPD implementation details for pseudonymous institutional reporting;
- B2C downgrade allocation policy;
- payment provider and billing lifecycle rules;
- legacy Activity composition migration strategy;
- legacy Syllabus/Percurso migration strategy;
- raw xAPI retention if raw statements are retained;
- Exercise scoreability / assessment semantics (how an Exercise is determined to be scorable; must not be inferred from existing Attempts);
- Activity Performance `adequate`/`attention` aggregation rule;
- product decisions surfaced by the UX prototype, recorded in `resources/ux/PROTOTYPE-CONFLICTS.md`.

## UX reference rule

The approved prototype is authoritative for:

- visual direction;
- information architecture;
- navigation;
- page composition;
- represented interaction intent and user-facing states.

It is not authoritative for:

- database schema;
- authorization;
- security;
- domain invariants;
- migration behavior;
- exact metric calculation beyond approved contracts;
- all possible edge cases.

Absence or simplification in the prototype does not remove a product contract defined in authoritative documentation or an active SPEC.

UX references apply only where they do not conflict with authoritative documents. Unsupported prototype concepts do not become requirements automatically.

The current prototype, its authority rules and the register of its known conflicts are versioned under `resources/ux/` (see `resources/ux/README.md` and `resources/ux/PROTOTYPE-CONFLICTS.md`).

## Source-of-truth hierarchy

For intended product behavior:

```text
approved product decisions
        ↓
PRODUCT_DEFINITION.md
        ↓
accepted ADRs / ARCHITECTURE.md
        ↓
active SPEC
        ↓
implementation prompt
        ↓
approved UX prototype
        ↓
implementation convenience
```

For current-state claims, actual implementation and tests describe what exists now.

If durable sources conflict, surface and reconcile the contradiction rather than silently choosing one.

## Specification governance

Implementation specifications live under:

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

A planned SPEC must not be implemented directly.

Only promote a SPEC to `active/` once dependencies, product contracts, data semantics, security constraints and acceptance criteria are sufficiently explicit that the implementation agent does not need to invent product behavior.

## Current implementation state

SPEC-001 — Application Foundation is the current active bounded implementation unit.

The learning-domain SPECs remain planned and must be reconciled with `PRODUCT_DEFINITION.md`, `ARCHITECTURE.md` and ADR-002 before activation.
