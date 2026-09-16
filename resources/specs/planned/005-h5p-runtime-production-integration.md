# SPEC-005 — H5P Runtime Production Integration

**Status:** PLANNED — DECISION READY / CONDITIONAL GO  
**Depends on:** SPEC-004  
**Authority:** Product Definition v1, Architecture v1 and applicable ADRs

## 1. Purpose / Objective

Integrate Lumi H5P as the isolated production playback runtime behind a PFY-owned adapter.

## 2. Current State

The spike proved legacy compatibility and identified identifier, security and library-version constraints. ADR-001 adopts Lumi conditionally.

## 3. Problem / Gap

PFY needs H5P playback without making Lumi the owner of PFY content identity, authorization or learning state.

## 4. Decision

Run Lumi in a separate Node service. PFY owns authorization and the `PFY activity UUID <-> Lumi content id` mapping.

## 5. Scope

### In Scope
- isolated runtime service;
- pinned Lumi/core versions;
- adapter/mapping;
- authorized playback;
- persistent H5P storage;
- cross-origin integration;
- explicit permissions;
- sanitizer regression protection;
- runtime health/observability;
- representative playback tests.

### Out of Scope
- production authoring workflow;
- bulk legacy migration;
- Attempts/Results persistence;
- AI authoring;
- unrestricted library admin.

## 6. Expected Behavior

Authorized users open H5P Activities by PFY UUID; Lumi IDs remain internal except unavoidable runtime DOM usage.

## 7. Constraints
- sanitize imported parameters before persistence;
- libraries are executable code and operator/admin-installed only;
- no permissive default permission system;
- pin stable versions;
- preserve process/origin isolation.

## 8. Impact Surface

Schema/data, server authorization, UI/routes, tests, documentation and operational surfaces directly required by this spec. Adjacent future domains remain unaffected unless explicitly listed above.

## 9. Acceptance Criteria
- [ ] Representative H5P types render via PFY URLs.
- [ ] PFY UUID is canonical externally.
- [ ] Mapping stays adapter-private.
- [ ] Known import-XSS regression is blocked.
- [ ] Library installation is privileged.
- [ ] Persistent storage is production-suitable.
- [ ] Runtime/app deploy independently.
- [ ] Exact versions are pinned.

## 10. Implementation Freedom

Deployment provider and internal adapter API may vary without collapsing the service boundary.

## 11. Knowledge Updates Required

Record actual runtime topology, versions, storage and operational commands.

## 12. Open Questions / Blockers

GPL legal review remains a production gate; engineering process isolation must not be treated as a legal conclusion.
