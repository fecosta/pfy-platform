# ADR-001 — Adopt Lumi H5P as an isolated PFY runtime and authoring engine

**Status:** Accepted with conditions  
**Date:** 2026-09-13  
**Decision type:** Architecture / Learning Content Runtime

## Context

PFY is being rebuilt as a greenfield application while preserving its existing H5P activity corpus. The new platform must support:

- playback of migrated H5P content;
- creation and editing by non-technical pedagogical consultants;
- attempt/result tracking;
- package import/export portability;
- future AI-assisted authoring;
- independence between the PFY product model and H5P implementation internals.

A dedicated spike was implemented in `fecosta/pfy-h5p-spike` using Lumi H5P Node.js.

The spike repository explicitly describes itself as disposable technical evidence and reports `CONDITIONAL GO`. Its README records 185/185 successful legacy imports, 202/202 browser render checks, automated unit/browser coverage and a package round-trip to WordPress. The repository also implements a dedicated adapter boundary between PFY-domain contracts and Lumi runtime code.

## Decision

PFY will adopt the Lumi H5P Node.js ecosystem as the initial H5P runtime and authoring engine.

Lumi will run in a separate Node process/service and will be consumed through a PFY-owned H5P Adapter.

PFY's canonical Activity identity, Attempt semantics, Result semantics, authorization and access models remain independent of Lumi.

## Boundary

```text
PFY domain
   |
   v
PFY H5P Adapter
   |
   v
Lumi H5P Runtime
```

PFY owns:

- canonical Activity UUID;
- authorization;
- attempt creation and numbering;
- attempt tokens;
- normalized Results;
- score provenance;
- content lifecycle metadata;
- authoring workflow;
- migration provenance.

Lumi owns/runtime-manages:

- H5P content representation;
- H5P libraries;
- player/editor runtime models;
- H5P-specific assets and user-state behavior;
- package import/export machinery.

## Evidence

The spike demonstrated:

- 185/185 real legacy WordPress H5P packages imported successfully;
- 21 distinct main H5P libraries represented in the corpus;
- 202 activities rendered/reloaded with no browser console/network errors in the automated run;
- H5P creation, editing, legacy editing, save/reopen and playback;
- Lumi-to-Lumi export/reimport with scoring preserved;
- Lumi-to-WordPress compatibility in a disposable verifier environment;
- image/audio asset round-trip;
- append-only attempts and multiple-attempt isolation;
- client xAPI normalization into PFY Attempt/Result semantics;
- an AI-friendly structured draft transformed into editable H5P content;
- separation of PFY UUID from Lumi runtime content ID except for a required browser DOM attribute.

## Conditions

### 1. Import sanitization

Lumi 10.0.x package import does not provide the same parameter sanitization as the editor-save path. The production adapter must preserve an equivalent semantic sanitization step before imported content parameters are persisted.

This is a mandatory security invariant and must have regression tests.

### 2. Explicit score provenance

H5P scores are reported from browser execution and are therefore recorded as:

`client_reported`

They must not be mislabeled as server-authoritative.

### 3. Non-scoring content semantics

Some valid H5P content does not produce a score. PFY must preserve:

- nullable score fields;
- nullable pass/fail;
- independent completion state.

Do not convert missing score to zero.

### 4. Separate runtime process

Lumi runs separately from the PFY application process for runtime isolation, replacement flexibility, security containment and independent upgrade lifecycle.

This engineering separation is not treated as a legal conclusion about GPL obligations.

### 5. Controlled library installation

H5P libraries contain executable client code. Library installation and administration are privileged operations restricted to trusted PFY operators/admins.

Content authoring/import permissions do not automatically imply unrestricted library installation rights.

### 6. Version pinning

Production uses exact stable Lumi/core/editor versions. Upgrades, especially major-version changes, require deliberate compatibility and security validation.

### 7. Authoring wrapper

The stock H5P editor is not the final PFY authoring experience. PFY must wrap it with a product-owned workflow covering title, content-type guidance, errors, drafts, preview and publication.

Real pedagogical-consultant usability testing is required before broad authoring rollout.

### 8. Library normalization during migration

Before legacy content import, migration tooling should normalize required library patch versions per compatible major/minor line to remove import-order dependence.

## Consequences

### Positive

- PFY can preserve the existing activity corpus without WordPress.
- H5P remains replaceable behind the adapter boundary.
- PFY can support non-technical authoring without reimplementing dozens of activity editors.
- AI-assisted authoring can be built through deterministic content-type transformers.
- package portability is retained.

### Costs / risks

- PFY owns the adapter and H5P integration security posture;
- H5P scores use a client-reported trust model;
- runtime deployment needs persistent H5P storage and a Node service;
- H5P library version management must be operationalized;
- authoring UX requires a PFY wrapper;
- GPL implications require legal review before production decisions are finalized.

## Rejected alternatives for now

### Continue WordPress H5P as the runtime

Rejected as the target architecture because the new PFY is a greenfield rebuild and WordPress is retained only as a migration/source system.

### Build an H5P-compatible runtime/editor from scratch

Rejected because it would recreate substantial H5P runtime, semantics, editor and library-management complexity without product advantage.

### H5P.com

Not selected for v1 because the Lumi spike retired the principal technical risks of self-hosting. It remains a fallback option if future operational, legal or maintenance constraints materially change.

## Follow-up gates

Before production rollout:

- legal review of GPL implications;
- production-grade import security validation;
- real consultant authoring usability validation;
- persistent storage/backups design;
- authentication/CSRF integration;
- explicit H5P operational upgrade policy.

## Supersession rule

This ADR should be superseded, not silently edited, if PFY changes H5P runtime technology or abandons the isolated-runtime boundary.
