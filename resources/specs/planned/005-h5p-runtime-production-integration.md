# SPEC-005 — H5P Runtime Production Integration

**Status:** PLANNED — IMPLEMENTATION READY / PRODUCTION LEGAL GATE  
**Depends on:** SPEC-004 — Learning Content Model, Percursos & Shared Library  
**Authority:** `docs/PRODUCT_DEFINITION.md`, `docs/ARCHITECTURE.md`, `docs/ADR-001-LUMI-H5P-RUNTIME.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md` and applicable accepted ADRs  
**Technical evidence:** completed `fecosta/pfy-h5p-spike` technical spike — `CONDITIONAL GO`

## 1. Purpose / Objective

Integrate Lumi H5P as the isolated production playback runtime for H5P-backed PFY Exercises behind a PFY-owned H5P Adapter.

SPEC-005 establishes the production boundary:

```text
PFY Activity
      ↓
PFY Exercise
      ↓
PFY H5P Adapter
      ↓
Lumi H5P Runtime
```

The objective is to allow an authorized PFY experience to render H5P-backed Exercises while preserving:

- PFY-owned Exercise identity;
- PFY-owned authorization;
- Activity composition outside Lumi;
- runtime isolation;
- secure H5P package/content handling;
- explicit library governance;
- runtime replaceability.

SPEC-005 does not implement learner Attempt or Result persistence.

Those semantics belong to SPEC-006.

---

## 2. Current State

The completed H5P technical spike demonstrated that Lumi can support the existing PFY H5P corpus outside WordPress.

Verified spike evidence includes:

- 185/185 legacy WordPress H5P packages imported successfully;
- 21 main H5P content/library types represented;
- 202 rendered Activities/fixtures validated in browser automation without console errors in the verified run;
- legacy playback compatibility;
- creation/editing/reopening through the Lumi editor;
- cross-origin embedding;
- package export/reimport;
- media asset handling;
- xAPI capture;
- attempt isolation;
- non-scoring content;
- score provenance;
- WordPress round-trip verification.

The spike result is `CONDITIONAL GO`.

ADR-001 accepts Lumi as the initial H5P runtime subject to mandatory production controls.

ADR-002 subsequently clarifies the product boundary:

```text
PFY Activity != Lumi content
```

and establishes:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

SPEC-004 establishes the canonical Exercise identity consumed by this specification.

---

## 3. Problem / Gap

PFY requires production H5P playback without allowing Lumi to become the owner of:

- PFY Activity identity;
- PFY Exercise identity;
- Activity composition;
- authorization;
- learning-history semantics;
- Activity Progress;
- Activity Performance;
- Percurso progress.

Without a production adapter/runtime integration:

- H5P-backed Exercise blocks cannot render;
- PFY would risk exposing Lumi identifiers as product identifiers;
- browser requests could bypass application authorization;
- runtime upgrades/library installation could become uncontrolled;
- imported content could bypass required sanitization;
- H5P storage would remain disposable rather than production-suitable.

The integration must therefore make Lumi operational while preserving PFY domain ownership.

---

## 4. Authoritative Decision

PFY uses Lumi H5P as an isolated runtime service behind a PFY-owned adapter.

The canonical runtime mapping is:

```text
PFY Exercise UUID
        ↕
PFY H5P Adapter
        ↕
Lumi content id
```

The following mapping is prohibited as a PFY domain contract:

```text
PFY Activity UUID
        ↕
Lumi content id
```

An Activity may contain:

- zero H5P Exercises;
- one H5P Exercise;
- multiple H5P Exercises.

Each H5P-backed Exercise has its own runtime mapping.

Lumi content identifiers remain implementation details.

---

## 5. Runtime Boundary

### PFY application owns

PFY owns:

- Activity identity;
- Activity composition;
- Exercise identity;
- Exercise-to-Activity relationship;
- content lifecycle;
- content visibility;
- authorization;
- user/session context;
- future Attempt and Result semantics.

### PFY H5P Adapter owns

The adapter owns:

- PFY Exercise UUID ↔ Lumi content id mapping;
- authorized playback orchestration;
- runtime URL/model resolution;
- runtime-specific translation;
- package ingestion boundary where applicable;
- security/sanitization enforcement;
- future event-channel integration boundary.

### Lumi owns

Lumi owns/runtime-manages:

- H5P content parameters;
- H5P libraries;
- player runtime models;
- H5P assets;
- runtime content IDs;
- runtime-specific state;
- H5P package mechanics.

Lumi does not own PFY domain identity or authorization.

---

## 6. Scope

### 6.1 In Scope — isolated runtime service

Establish a production-capable Node/Lumi runtime that is independently deployable from the primary PFY Next.js application.

The runtime must:

- run as a separate process/service;
- have explicit environment configuration;
- provide runtime health/readiness behavior;
- use persistent production-suitable storage;
- support the required player resources;
- support cross-origin integration with the PFY application.

Do not collapse Lumi into the primary Next.js process.

### 6.2 In Scope — H5P Exercise mapping

Implement persistent mapping between:

```text
PFY Exercise UUID
↔
Lumi content id
```

The mapping must:

- reference canonical PFY Exercise identity;
- remain behind the adapter boundary;
- support one Lumi content identity per H5P-backed Exercise for the current model;
- never redefine Activity identity;
- preserve stable PFY identity if runtime implementation details change.

A Lumi content ID may appear in runtime-specific browser/DOM usage when technically required.

It must not become a canonical public PFY domain identifier.

### 6.3 In Scope — authorized playback

Implement the minimum application/runtime flow required for authorized users to render an H5P-backed Exercise.

Conceptually:

```text
User
 ↓
PFY Activity Workspace
 ↓
Exercise block
 ↓
PFY authorization
 ↓
H5P Adapter
 ↓
Lumi player/runtime
```

The runtime must not expose arbitrary PFY learning content merely because a browser knows or guesses a Lumi content ID.

Authorization must remain owned by PFY.

SPEC-005 must reuse the content-visibility and authorization foundations established by SPEC-003/SPEC-004.

Do not introduce future licensing/entitlement rules from SPEC-009.

### 6.4 In Scope — Activity Workspace integration

The Activity renderer introduced by SPEC-004 must be capable of rendering an H5P-backed Exercise block.

Multiple Exercise blocks in one Activity must be possible.

The runtime integration must not assume:

```text
one Activity = one H5P
```

Each Exercise renders independently inside the Activity composition.

### 6.5 In Scope — persistent runtime storage

Configure production-suitable persistence for:

- H5P content;
- H5P libraries;
- H5P assets;
- runtime-required metadata.

Storage must survive ordinary application/runtime restarts and deployment cycles.

Backup/recovery requirements must be documented sufficiently for production operations.

The exact provider/storage mechanism is implementation freedom if it preserves the runtime boundary and durability requirements.

### 6.6 In Scope — package ingestion security foundation

Any H5P package-ingestion path introduced or required by SPEC-005 must enforce the ADR-001 security pipeline before untrusted imported parameters are persisted.

Conceptually:

```text
package
   ↓
archive/path validation
   ↓
file/extension validation
   ↓
semantic parameter sanitization
   ↓
residual dangerous-markup validation
   ↓
trusted library resolution
   ↓
persistence
```

This does not mean bulk legacy migration is in scope.

SPEC-014 owns bulk migration.

SPEC-005 only establishes the secure runtime ingestion boundary required by production H5P infrastructure.

### 6.7 In Scope — library governance

H5P libraries are executable client code.

Library installation/upgrade must therefore be restricted to explicitly trusted PFY operator/admin capabilities.

Ordinary:

- Students;
- Teachers;
- Content Authors

must not gain unrestricted library installation merely because they can access or later author content.

Do not use Lumi's permissive default permission model as production authorization.

### 6.8 In Scope — version governance

Use explicit pinned stable versions for the Lumi/H5P runtime stack.

Do not depend on floating production versions.

The implemented exact versions must be recorded during completion reconciliation.

Major or security-relevant upgrades require deliberate compatibility/security validation.

### 6.9 In Scope — representative compatibility validation

Validate representative H5P content types required to demonstrate the production integration.

Validation must include:

- rendering;
- assets/media;
- reload;
- Activity containing an H5P Exercise;
- Activity capable of containing more than one H5P Exercise;
- non-scoring H5P content;
- cross-origin runtime behavior.

SPEC-005 does not need to re-run the full bulk migration.

Bulk corpus validation belongs to SPEC-014.

### 6.10 In Scope — future tracking integration seam

Preserve a clear event/adapter boundary through which SPEC-006 can later attach PFY Attempt context and normalized Exercise result evidence.

SPEC-005 may prove the technical event channel if needed.

It must not define or persist production PFY Attempts/Results.

---

## 7. Out of Scope

SPEC-005 must not implement:

- Activity identity/schema;
- Activity composition model;
- Syllabus/Percurso;
- Exercise identity creation semantics;
- Exercise Attempts;
- Results persistence;
- Activity Progress;
- Activity Performance;
- `needs_review`;
- Percurso Progress;
- learner history;
- teacher monitoring;
- production Activity authoring workflow;
- Content Author workflow;
- formal assignments;
- AI-assisted authoring;
- bulk legacy H5P migration;
- legacy Activity reconstruction;
- legacy Syllabus migration;
- historical learning-data migration;
- licensing/content subset policy;
- billing;
- organizations;
- institutional reporting;
- unrestricted H5P library administration.

Do not create placeholder implementations for later specifications.

---

## 8. Expected Behavior

After SPEC-005:

1. PFY has an independently deployable H5P runtime service.
2. An H5P-backed Exercise can be rendered from an Activity Learning Workspace.
3. Rendering is initiated using canonical PFY Exercise identity.
4. The adapter resolves the corresponding Lumi content identity internally.
5. Lumi content IDs do not replace PFY Exercise IDs in domain contracts.
6. One Activity can contain multiple independently mapped H5P Exercises.
7. PFY authorization is evaluated before protected playback is granted.
8. Knowing a Lumi content ID alone does not grant PFY content access.
9. Runtime content/assets/libraries use persistent production-suitable storage.
10. Package ingestion introduced by the runtime follows mandatory sanitization controls.
11. Library installation is restricted to trusted operator/admin capability.
12. Runtime versions are pinned.
13. PFY application and H5P runtime can deploy independently.
14. Non-scoring H5P content renders without requiring fake score semantics.
15. The runtime exposes a clean integration seam for SPEC-006 without persisting PFY Attempts.

---

## 9. Identity and Mapping Invariants

### PFY Exercise identity is canonical

All PFY-facing Exercise operations begin from PFY Exercise identity.

### Lumi identity is internal

Lumi content ID:

- may exist in adapter/runtime persistence;
- may be emitted where Lumi browser components technically require it;
- must not become the user-facing/canonical PFY identity.

### Activity identity remains independent

A single Activity may resolve multiple H5P mappings through its Exercise blocks.

No Activity-to-Lumi 1:1 constraint may exist.

### Mapping integrity

An H5P mapping must reference a valid H5P-backed PFY Exercise.

Deleting/archiving/changing Activity content must not accidentally orphan runtime content without an explicit lifecycle strategy.

The exact cleanup strategy is implementation freedom, but dangling or ambiguous mappings must be detectable.

---

## 10. Authorization Constraints

SPEC-005 must use the existing PFY authorization foundation.

At minimum:

- runtime playback requests are tied to authorized PFY content access;
- direct Lumi knowledge is not sufficient authorization;
- the runtime must not trust arbitrary client claims of Activity/Exercise ownership;
- service-to-service trust must use explicitly controlled credentials/mechanisms;
- privileged runtime/admin/library routes are not exposed as ordinary learner routes;
- service-role or privileged runtime credentials must never reach the browser.

Content access in this SPEC follows the currently available content visibility model.

Future license/entitlement restrictions must not be invented here.

---

## 11. H5P Security Invariants

The following ADR-001 conditions are mandatory.

### Import sanitization

Imported content parameters must receive equivalent semantic sanitization to the trusted editor-save path before persistence.

A regression test must cover the previously identified unsafe import path.

### Archive/path safety

Package extraction must reject unsafe archive paths/path traversal.

### File policy

The production runtime must use an intentionally defined content-file/extension policy appropriate for the supported H5P corpus.

### Library trust

H5P libraries are executable code.

Only trusted operator/admin contexts may install/update libraries.

### Permissions

Do not deploy Lumi's default permissive permission implementation as PFY production authorization.

### Runtime isolation

Lumi remains a separate process/service and, where practical, an isolated origin.

### Secrets

Runtime/service credentials remain server-side.

### Version pinning

Exact runtime/core/editor versions must be pinned.

### Sanitizer regression

Security tests must ensure future runtime upgrades do not silently remove required import sanitization.

---

## 12. Score and Learning Semantics Boundary

H5P may emit xAPI/scoring/completion events during playback.

SPEC-005 must not turn these directly into Activity-level semantics.

The following belong to SPEC-006:

- Attempt creation;
- Attempt numbering;
- Attempt persistence;
- completion persistence;
- score persistence;
- success persistence;
- duration persistence;
- latest completed Attempt;
- Activity Progress;
- Activity Performance;
- `needs_review`.

Where H5P scoring evidence is technically observed during SPEC-005 validation, it must remain consistent with the architectural rule:

```text
score_provenance = client_reported
```

Missing score must not be interpreted as zero.

---

## 13. Operational Requirements

The H5P runtime must have sufficient production-operational behavior to support later rollout.

At minimum document and verify:

- startup procedure;
- configuration requirements;
- persistent storage requirements;
- health/readiness behavior;
- deployment boundary;
- relevant logs/errors;
- backup considerations;
- upgrade procedure or upgrade policy;
- pinned versions.

Do not add a large observability platform solely for SPEC-005.

Use the smallest operational surface appropriate to the runtime.

---

## 14. UX Constraints

SPEC-005 must preserve the Activity Learning Workspace architecture.

The user opens an Activity, not a standalone “H5P Activity Player” product entity.

H5P-backed Exercises render inside the Activity composition.

Do not reintroduce:

```text
Activity Detail
→ Start
→ H5P Player
```

as a mandatory PFY product flow.

The UX prototype may guide visual placement.

The domain and runtime rules in authoritative documentation remain controlling.

---

## 15. Impact Surface

### Directly affected

- H5P runtime service;
- runtime deployment/configuration;
- persistent H5P storage;
- PFY H5P Adapter;
- Exercise-to-Lumi mapping persistence;
- authorized playback APIs/routes;
- Activity Exercise rendering;
- security/sanitization pipeline;
- library permissions/governance;
- cross-origin configuration;
- tests;
- operational documentation.

### Explicitly unaffected

- canonical Activity model;
- canonical Exercise ownership;
- Syllabus/Percurso model;
- learner Attempt semantics;
- Activity Progress/Performance;
- teacher-student relationship semantics;
- licensing;
- organizations;
- billing;
- migration strategy.

### Downstream dependencies

SPEC-005 establishes infrastructure consumed by:

- SPEC-006 — Exercise Attempts, Activity Progress & Results;
- SPEC-007 — Activity Authoring & H5P Content Workflow;
- SPEC-014 — Legacy Learning Content Migration;
- SPEC-015 — Optional Historical Learning Data Migration.

---

## 16. Acceptance Criteria

### Runtime topology

- [ ] Lumi runs in a process/service separate from the primary PFY application.
- [ ] PFY application and H5P runtime can be deployed independently.
- [ ] Runtime health/readiness behavior exists.
- [ ] Runtime configuration is documented.
- [ ] Exact production runtime versions are pinned.

### Exercise mapping

- [ ] A canonical PFY Exercise UUID can resolve an H5P-backed runtime content identity.
- [ ] Mapping persists independently from browser state.
- [ ] No Activity-to-Lumi 1:1 domain mapping is introduced.
- [ ] One Activity can contain multiple H5P-backed Exercises.
- [ ] Lumi content IDs remain adapter/runtime details except unavoidable runtime DOM usage.

### Playback

- [ ] An authorized user can render an H5P-backed Exercise inside the Activity Learning Workspace.
- [ ] A published Activity containing an H5P-backed Exercise renders correctly.
- [ ] Multiple H5P Exercise blocks can be represented/rendered within one Activity without identity collision.
- [ ] Representative scoring and non-scoring H5P content render correctly.
- [ ] Media/assets required by representative content render correctly.
- [ ] Reload preserves runtime content availability.
- [ ] Cross-origin integration works without weakening authorization.

### Authorization

- [ ] PFY authorization occurs before protected playback access is granted.
- [ ] Knowing/guessing a Lumi content ID does not independently grant content access.
- [ ] Privileged runtime/library administration is not exposed to ordinary users.
- [ ] Browser clients do not receive service/operator credentials.
- [ ] Negative authorization tests cover unauthorized runtime access.

### Import security

- [ ] Unsafe archive/path traversal is rejected.
- [ ] Imported H5P parameters pass the required sanitization step before persistence.
- [ ] Regression coverage exists for the known unsafe import/XSS class.
- [ ] File/extension policy is explicitly configured.
- [ ] Unsupported/dangerous package content fails safely.

### Library governance

- [ ] Library installation/update requires trusted operator/admin capability.
- [ ] Ordinary Student/Teacher/Content Author access does not imply library installation.
- [ ] Lumi's permissive default permissions are not used as production authorization.

### Persistence/operations

- [ ] H5P content survives ordinary runtime restart/redeployment according to the chosen storage topology.
- [ ] H5P libraries/assets use production-suitable persistence.
- [ ] Backup/recovery considerations are documented.
- [ ] Relevant runtime errors are observable without exposing secrets.

### Learning-boundary protection

- [ ] SPEC-005 does not persist production PFY Attempts or Results.
- [ ] SPEC-005 does not derive Activity Progress.
- [ ] SPEC-005 does not derive Activity Performance or `needs_review`.
- [ ] Non-scoring content does not receive an artificial zero score.
- [ ] Any observed H5P score evidence remains classified as `client_reported`.

### Validation

- [ ] Relevant unit/integration tests pass.
- [ ] Relevant browser/E2E playback tests pass.
- [ ] Security regression tests pass.
- [ ] Type-check/lint/build checks applicable to affected services pass.
- [ ] Deployment/runtime validation is documented.
- [ ] No authoritative PFY product or architecture contract was silently changed.

---

## 17. Implementation Freedom

Implementation may choose reversible technical details including:

- runtime hosting provider;
- exact service URL topology;
- internal adapter API structure;
- internal mapping-table naming;
- storage provider/driver;
- health endpoint naming;
- service authentication mechanism;
- cache behavior where contract-preserving;
- test fixture selection;
- runtime logging implementation.

Implementation freedom does not include changing:

- separate runtime process/service;
- PFY Exercise identity as canonical;
- Exercise ↔ Lumi mapping boundary;
- PFY-owned authorization;
- mandatory import sanitization;
- privileged library installation;
- pinned version policy;
- `client_reported` trust model;
- non-scoring null semantics;
- Activity composition boundary.

If a verified Lumi constraint requires one of these to change, return:

`BLOCKED / DECISION REQUIRED`

before implementing the deviation.

---

## 18. Deliberately Deferred Work

### Exercise Attempts / Results

SPEC-006.

### Activity Completion / Performance

SPEC-006.

### xAPI normalization into production PFY learning records

SPEC-006.

### Activity/H5P authoring workflow

SPEC-007.

The runtime/editor capability may exist technically, but the PFY authoring product workflow is not introduced here.

### Bulk legacy H5P migration

SPEC-014.

### Legacy Activity composition reconstruction

SPEC-014 and its unresolved migration decision.

### Historical xAPI/Attempt migration

SPEC-015.

### License-based content subsets

SPEC-009 or later applicable entitlement specification.

---

## 19. Knowledge Updates Required

At completion:

1. record actual runtime topology and deployment model;
2. record exact Lumi/core/editor package versions used;
3. document persistent storage implementation and operational requirements;
4. document the implemented PFY Exercise ↔ Lumi mapping;
5. document runtime authorization/service-authentication behavior;
6. document import-sanitization and library-administration controls;
7. document relevant runtime validation commands;
8. update `resources/specs/README.md`;
9. reconcile SPEC-006, SPEC-007 and SPEC-014 if verified implementation evidence changes a technical assumption without altering product semantics;
10. move this SPEC to `completed/` only after implementation, validation and durable knowledge reconciliation.

Do not rewrite ADR-001 or ADR-002 merely to record reversible implementation choices.

Create/supersede an ADR only if implementation requires a material architecture decision.

---

## 20. Open Questions / Gates

### Production legal gate

ADR-001 identifies GPL implications as requiring legal review before production rollout decisions are finalized.

Engineering process/service isolation is not a legal conclusion.

Therefore:

- implementation and technical validation may proceed once SPEC dependencies are satisfied;
- production rollout remains gated by the applicable GPL/legal review.

This gate must not be silently marked resolved by the implementation agent.

### Storage provider

Exact provider is not a product blocker.

Choose a production-suitable implementation consistent with the approved deployment architecture.

### Raw xAPI retention

Not decided in SPEC-005.

SPEC-006 owns the learning-event/Attempt persistence contract.

### Authoring usability

Does not block playback integration.

Broad Content Author rollout belongs to SPEC-007 and requires its own usability validation.

---

## 21. Activation Gate

This SPEC is:

**PLANNED — IMPLEMENTATION READY / PRODUCTION LEGAL GATE**

It remains under `resources/specs/planned/` until dependencies are satisfied and it becomes the selected bounded implementation unit.

Promote to `active/` only when:

```text
SPEC-004 completed and coherence verified
+ repository state revalidated
+ ADR-001/ADR-002 still current
+ no new technical blocker
= ACTIVE — IMPLEMENTATION READY / PRODUCTION LEGAL GATE
```

The unresolved production legal gate does not authorize production rollout.

---

## 22. Completion Gate

Technical completion requires:

```text
isolated Lumi runtime implemented
+ Exercise-to-Lumi mapping implemented
+ authorized Exercise playback implemented
+ Activity Workspace integration verified
+ persistent storage verified
+ import security regression protection verified
+ privileged library governance verified
+ runtime operations documented
+ product-domain boundaries preserved
+ documentation reconciled
= implementation technically complete
```

If the production legal gate is still unresolved at that point, report:

**`IMPLEMENTED / PRODUCTION LEGAL GATE OPEN`**

Do not label the runtime production-rollout ready until the applicable legal gate has been resolved.

Once implementation, validation, knowledge reconciliation and required production gate resolution are complete, the SPEC may be marked:

**`COMPLETED — COHERENCE VERIFIED`**