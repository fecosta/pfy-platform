# SPEC-004 — Learning Content Model & Shared Library

**Status:** PLANNED — DECISION READY  
**Depends on:** SPEC-003  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Implement canonical Activity, ActivityCollection and Textbook models plus the shared published library.

## 2. Current State

Product Definition v1 makes Activity the fundamental learning unit. H5P is an implementation, not the domain.

## 3. Problem / Gap

PFY needs canonical content identity and discoverability before runtime and learning history can attach safely.

## 4. Decision

Activities use PFY UUIDs, remain independently addressable and may participate in multiple editorial structures. Teachers and students share one catalog.

## 5. Scope

### In Scope
- Activity metadata/type/lifecycle;
- `draft`, `published`, `archived`;
- collections and ordered membership;
- textbooks/editorial structure;
- published shared-library browsing;
- basic MVP search/filter metadata;
- draft visibility for authorized content users.

### Out of Scope
- H5P playback/editor;
- Attempts/Results;
- assignments;
- favorites;
- personal teacher collections;
- AI authoring.

## 6. Expected Behavior

Published activities can be found/opened independently; draft/archived content is excluded from ordinary learner browsing.

## 7. Constraints
- Lumi IDs never become canonical PFY IDs.
- Collection/textbook membership does not change Activity identity.
- Do not duplicate teacher/student catalogs.
- Editorial ordering is deterministic.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Activity has PFY UUID.
- [ ] Activity exists independently of collections/textbooks.
- [ ] Shared published library serves teachers/students.
- [ ] Draft/archived visibility is authorized.
- [ ] Ordering is stable.
- [ ] No Lumi ID leaks into public PFY domain contracts.

## 10. Implementation Freedom

Search implementation, metadata fields and UI layout may evolve while preserving semantics.

## 11. Knowledge Updates Required

Document verified content schema, lifecycle and library behavior.

## 12. Open Questions / Blockers

Before activation define minimum launch metadata/filter taxonomy and decide whether v1 licenses can restrict content subsets.
