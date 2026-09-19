# SPEC-007 — Activity Authoring & H5P Content Workflow

**Status:** PLANNED — DECISION READY / USABILITY GATE REQUIRED / RECONCILIATION REQUIRED
**Depends on:** SPEC-004, SPEC-005, SPEC-006
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, `docs/ADR-001-LUMI-H5P-RUNTIME.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md` and applicable accepted ADRs

> **Reconciliation note (2026-09-19):** wording that equated an Activity with one H5P object was corrected to the ADR-002 boundary. The rest of this SPEC predates the composed Activity model and still requires full reconciliation before activation (see `resources/specs/README.md`).

## 1. Purpose / Objective

Provide authorized non-technical pedagogical authors a PFY-managed create/edit/preview/publish workflow for composed Activities, including H5P-backed Exercise blocks.

## 2. Current State

The spike proved Lumi editor authoring and legacy round-trip but found UX friction for non-technical consultants.

## 3. Problem / Gap

Technical editor functionality alone is insufficient for PFY official-content governance and usability.

## 4. Decision

Provide a PFY-owned Activity authoring shell with metadata, ordered content blocks, lifecycle, permissions, preview and publish controls. The Lumi editor remains the editor for H5P-backed Exercise blocks only; it is not the complete Activity editor (ADR-002, "Authoring consequence").

## 5. Scope

### In Scope
- Content Author capability;
- create/edit composed Activity (metadata and ordered content blocks);
- create/edit H5P-backed Exercise blocks through the Lumi editor;
- title/metadata;
- draft save;
- preview;
- publish/archive;
- edit migrated content;
- Portuguese errors;
- export/import where authorized;
- author provenance.

### Out of Scope
- AI-assisted authoring;
- teacher personal content;
- assignments;
- unrestricted library installation.

## 6. Expected Behavior

Authorized content authors can create/edit/preview/save/publish without runtime-admin access.

## 7. Constraints
- Content Author is contextual capability, not every Teacher.
- Imports are sanitized.
- Publishing is explicit human action.
- Library installation remains privileged.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Authorized author can create/edit/preview/save/publish.
- [ ] Unauthorized user cannot author.
- [ ] Teacher capability alone does not grant official authoring.
- [ ] Published content appears in library; drafts do not.
- [ ] Migrated H5P can be edited.
- [ ] PFY wrapper provides usable Portuguese controls/errors.
- [ ] Real non-technical consultant validates critical flow before rollout.

## 10. Implementation Freedom

Visual design and editor embedding may evolve while lifecycle and permission contracts remain intact.

## 11. Knowledge Updates Required

Document authoring workflow, capability and usability-validation evidence.

## 12. Open Questions / Blockers

`DECISION REQUIRED — AUTHORING REVIEW/APPROVAL WORKFLOW`: before activation decide whether MVP is direct draft->publish or requires a separate review/approval role.

`DECISION REQUIRED — EDITING PUBLISHED CONTENT WITH EXISTING ATTEMPTS`: the effect of editing a published Activity or Exercise that already has learner Attempts (for example, adding an Exercise to an Activity learners have completed, or changing an Exercise's scoring) on Attempt evidence, Activity Progress and Activity Performance is not defined. It must be decided before activation and must not be resolved by implementation.

The UX prototype does not cover authoring surfaces (`resources/ux/PROTOTYPE-CONFLICTS.md`, "Coverage gaps").
