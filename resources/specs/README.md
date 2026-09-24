# PFY Specifications

This directory contains bounded implementation specifications for the greenfield Portuguese for You platform.

## Structure

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

## Authority

Specifications implement bounded slices of the current product and architecture contracts.

The roadmap does not override:

- `docs/PRODUCT_DEFINITION.md`;
- `docs/ARCHITECTURE.md`;
- accepted ADRs.

A SPEC must be reconciled with current authoritative documentation before activation.

The approved UX prototype may guide implementation of visual/interaction intent but does not override the active SPEC or authoritative domain/architecture contracts.

The prototype is versioned under `resources/ux/`. Its known conflicts and the product decisions it surfaces are recorded in `resources/ux/PROTOTYPE-CONFLICTS.md` and must not become requirements automatically.

## Lifecycle

### Planned

`planned/` contains accepted future bounded work that is not currently active.

A planned item may still require:

- product decisions;
- architecture decisions;
- data-contract clarification;
- authorization/security design;
- migration investigation;
- acceptance criteria;
- dependency completion.

Do not implement directly from a planned SPEC.

### Active

`active/` contains current implementation-ready work.

An active SPEC must provide enough clarity that the implementation agent does not need to invent product behavior.

At minimum it should define:

- objective;
- current state and gap;
- authoritative decision;
- in-scope and out-of-scope boundaries;
- expected behavior;
- meaningful constraints;
- impact surface;
- observable acceptance criteria;
- implementation freedom;
- required knowledge updates;
- unresolved blockers.

Prefer one primary active implementation unit at a time unless parallel work is intentionally independent.

### Completed

`completed/` contains implemented work whose implementation, validation and durable project knowledge have been reconciled.

Moving a SPEC to completed requires more than code merge.

Verify:

- acceptance criteria;
- tests/checks;
- security/data implications;
- authoritative documentation;
- lifecycle/status references;
- current-state accuracy.

## Current state

### Completed

- **SPEC-001 — Application Foundation**
  - `completed/001-application-foundation.md`
  - Establish the initial application and engineering foundation.
  - Does not implement PFY learning-domain behavior.

- **SPEC-002 — Identity & Authentication**
  - `completed/002-identity-authentication.md`
  - Establishes canonical PFY identity, passwordless Magic Link authentication, SSR sessions,
    verified identity linking and progressive email-first registration.

- **SPEC-003 — Authorization Foundation**
  - `completed/003-authorization-foundation.md`
  - Establishes the verified canonical-user authorization context, explicit deny-by-default
    decisions, own-Profile enforcement and service-role isolation convention.

### Active

- **SPEC-004 — Learning Content Model, Percursos & Shared Library**
  - `active/004-learning-content-model-percursos-shared-library.md`
  - Establishes canonical Activity, Exercise, Percurso and shared-library foundations.
  - State: ACTIVE — IMPLEMENTATION READY.

### Planned roadmap

The dependency-oriented planned roadmap after the completed foundation and identity work is:



1. **SPEC-005 — H5P Runtime Production Integration**
2. **SPEC-006 — Exercise Attempts, Activity Progress & Results**
3. **SPEC-007 — Activity Authoring & H5P Content Workflow**
4. **SPEC-008 — Teacher–Student Relationships & Monitoring**
5. **SPEC-009 — Licensing, Capacity, Allocation & Entitlements**
6. **SPEC-010 — Organizations & Institutional Access**
7. **SPEC-011 — Institutional Reporting & PFY Impact Privacy Layer**
8. **SPEC-012 — B2C Billing Integration**
9. **SPEC-013 — Legacy User Migration**
10. **SPEC-014 — Legacy Learning Content Migration**
11. **SPEC-015 — Optional Historical Learning Data Migration**

SPEC-001, SPEC-002 and SPEC-003 are completed. SPEC-004 is the current active implementation unit.

Planned SPEC filenames may retain their current names until individually reconciled; this index defines the intended current roadmap semantics.

## Learning-domain reconciliation required before activation

Several planned learning-domain SPECs were drafted before the composed Activity model was finalized.

### Reconciliation status (2026-09-19)

| SPEC | State |
|---|---|
| SPEC-004 | Reconciled with ADR-002 in its planned file; open decisions listed in its §17 (including Exercise scoreability) must be re-checked at activation. |
| SPEC-005 | Reconciled with ADR-002 in its planned file. |
| SPEC-006 | Reconciled with ADR-002 in its planned file; activation blocked by `DECISION REQUIRED` items (Activity Performance `adequate`/`attention` aggregation; Exercise scoreability / assessment semantics). |
| SPEC-007 | Stale one-Activity-to-one-H5P wording corrected; full reconciliation still required. |
| SPEC-008 | Learning-history wording aligned with canonical evidence layers; full reconciliation still required. |
| SPEC-014 | Stale H5P-to-Activity mapping corrected to H5P-to-Exercise; full reconciliation still required; Activity-composition and Syllabus/Percurso migration remain `DECISION REQUIRED`. |

SPEC-002 was fully reconciled, implemented, independently reviewed, validated and closed.
SPEC-003 was implemented, validated and closed with no schema or migration changes.

The remaining planned SPECs (009–013, 015) have not yet received equivalent activation-level reconciliation.

Before activation, the contracts below must hold:

### SPEC-004

Must own:

- canonical Activity identity;
- ordered Activity composition;
- Exercise identity;
- Syllabus/Percurso;
- ordered Activity membership;
- shared library behavior;
- content lifecycle and basic discovery metadata.

It must not treat `ActivityCollection`/`Textbook` as the central MVP pedagogical model unless explicitly re-approved.

### SPEC-005

Must integrate H5P as an Exercise implementation.

Authoritative mapping:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

It must not restore one Activity = one H5P content.

### SPEC-006

Must move Attempts from Activity-level execution to Exercise-level execution and define:

- append-only Exercise Attempts;
- Result semantics;
- Activity Progress;
- Activity Completion;
- Activity Performance;
- `needs_review`;
- learner own-history;
- relevant derived summaries.

### SPEC-007

Must treat authoring as composed Activity authoring.

Lumi remains the editor for H5P-backed Exercise blocks rather than the full Activity editor.

### SPEC-008

Must preserve relationship authorization while exposing canonical learning history, including Activity completion, Exercise evidence, Activity Performance and Percurso progress where applicable.

Formal assignments remain out of scope unless separately approved.

### SPEC-014

Must no longer assume migrating an H5P package creates a complete PFY Activity.

It must distinguish:

- H5P/Exercise migration;
- Activity-composition migration;
- Syllabus/Percurso migration.

Legacy Activity-composition migration remains a product/technical decision gate.

## Known decision gates

The roadmap contains known unresolved gates, including:

- GPL production implications for Lumi;
- raw xAPI retention if retained;
- Activity Performance `adequate`/`attention` aggregation;
- Exercise scoreability / assessment semantics (must not be inferred from existing Attempts);
- authoring review/approval workflow and editing of published content with existing Attempts;
- Activity-authoring usability validation;
- B2C downgrade allocation policy;
- PFY Admin organization-management minimum capability;
- institutional reporting metrics/privacy details;
- payment provider and billing lifecycle rules;
- legacy user source inventory;
- legacy Activity-composition migration strategy;
- legacy Syllabus/Percurso migration strategy;
- optional historical-learning migration value/cost decision;
- product decisions surfaced by the UX prototype (independent learner entitlement/access model, learner level, written reflection input, "Minha biblioteca" semantics, current Percurso semantics, teacher student grouping and teacher information architecture), recorded in `resources/ux/PROTOTYPE-CONFLICTS.md`.

A downstream implementation agent must not resolve these silently.

## Source-of-truth rule

If a planned SPEC conflicts with current authoritative product or architecture documentation, the planned SPEC is stale and must be reconciled before activation.

Do not implement the stale interpretation.

If reconciliation requires a new product decision, keep the SPEC planned and mark:

`DECISION REQUIRED`

If a technical investigation is needed before the contract can be finalized, mark:

`TECHNICAL INVESTIGATION REQUIRED`

## Lifecycle transition gate

A SPEC may move from planned to active only when:

```text
dependencies satisfied
+ product decisions explicit
+ architecture coherent
+ security/authorization constraints explicit
+ data semantics explicit
+ acceptance criteria observable
+ implementation freedom bounded
+ no unresolved blocker that would require implementation invention
= IMPLEMENTATION READY
```

A SPEC may move to completed only when:

```text
implementation
+ validation
+ security/data verification
+ documentation reconciliation
+ lifecycle/index reconciliation
= completed
```
