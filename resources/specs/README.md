# PFY Specifications

This directory contains bounded implementation specifications for the greenfield Portuguese for You platform.

## Structure

```text
resources/specs/
├── active/
├── completed/
└── planned/
```

## Lifecycle

### Planned

`planned/` contains accepted future work that is not yet ready for implementation.

A planned item may still need product decisions, architecture decisions, data-contract clarification, authorization/security design, migration investigation, acceptance criteria, or dependency completion.

Do not implement directly from a planned spec.

### Active

`active/` contains current implementation-ready work.

An active spec must provide enough clarity that the implementation agent does not need to invent product behavior.

At minimum it should define objective, current state, decision, scope, constraints, expected behavior, acceptance criteria, implementation freedom, required knowledge updates, and blockers if any.

Prefer one primary active implementation unit at a time unless parallel work is intentionally independent.

### Completed

`completed/` contains implemented work whose implementation, validation and project knowledge have been reconciled.

Moving a spec to completed requires more than code merge. Verify acceptance criteria, tests/checks, security/data implications, authoritative documentation and lifecycle/status references.

## Current state

### Active

- `001-application-foundation.md` — establish the initial application and engineering foundation.

### Planned roadmap

The current roadmap is provisional and may change as implementation evidence emerges:

- SPEC-002 — Identity & Authentication
- SPEC-003 — Authorization Foundation
- SPEC-004 — Learning Content Model & Library
- SPEC-005 — H5P Runtime Integration
- SPEC-006 — H5P Authoring
- SPEC-007 — Attempts & Results
- SPEC-008 — Teacher-Student Relationship
- SPEC-009 — Licensing & Entitlements
- SPEC-010 — Organizations & Institutional Access
- SPEC-011 — B2C Billing
- SPEC-012 — Legacy User Migration
- SPEC-013 — Legacy H5P Migration

Only SPEC-001 is currently implementation-ready.

The roadmap does not override `docs/PRODUCT_DEFINITION_v1.md`, `docs/ARCHITECTURE_v1.md` or accepted ADRs.
