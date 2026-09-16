# SPEC-007 — H5P Authoring & Content Workflow

**Status:** PLANNED — DECISION READY / USABILITY GATE REQUIRED  
**Depends on:** SPEC-004, SPEC-005, SPEC-006  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Provide authorized non-technical pedagogical authors a PFY-managed H5P create/edit/preview/publish workflow.

## 2. Current State

The spike proved Lumi editor authoring and legacy round-trip but found UX friction for non-technical consultants.

## 3. Problem / Gap

Technical editor functionality alone is insufficient for PFY official-content governance and usability.

## 4. Decision

Wrap Lumi editor with PFY-owned metadata, lifecycle, permissions, preview and publish controls.

## 5. Scope

### In Scope
- Content Author capability;
- create/edit H5P Activity;
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

Before activation decide whether MVP is direct draft->publish or requires a separate review/approval role.
