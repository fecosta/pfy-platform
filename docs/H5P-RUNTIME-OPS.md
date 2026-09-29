# PFY H5P Runtime Operations

**Status:** REMEDIATED — SEE SPEC-005 RE-REVIEW / PRODUCTION LEGAL GATE OPEN
**Related:** `docs/ADR-001-LUMI-H5P-RUNTIME.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`, `docs/ARCHITECTURE.md`

This document was rewritten during SPEC-005 remediation after an independent
security review rejected the initial implementation. It reflects the current,
verified runtime behavior — not the original (partially broken) implementation.

## Topology

```text
PFY Web / Next.js
        |
        +--> PFY H5P Adapter (src/lib/h5p/)
                |
                +--> signed, content-scoped runtime token
                        |
                        v
        PFY H5P Runtime (services/h5p-runtime/)
                        |
                        +--> Lumi H5P Server 10.0.4
                        +--> filesystem / persistent storage
```

The runtime is an isolated Node process. It does not connect to the PFY
PostgreSQL database; it trusts short-lived, content-scoped signed runtime
tokens issued by the PFY application adapter.

## Pinned versions

| Component | Version |
|---|---|
| `@lumieducation/h5p-server` | 10.0.4 |
| `@lumieducation/h5p-express` | 10.0.5 |
| `express` | 4.21.2 |
| `sanitize-html` | 2.14.0 |
| H5P core files (default CDN) | **1.27.0** via jsDelivr |

**Remediation note:** the previous default core URL pointed at git tag
`1.26.0`, which does not exist in `h5p/h5p-php-library` (verified against the
GitHub tags API — real tags are `1.26`, `1.27.0`, `1.28.0`, with inconsistent
`vX.Y`/`X.Y.Z` naming across the repo's history). Every core script/style
request 404'd, so **no H5P content could ever render in a browser**,
independent of authorization. `1.27.0` is verified reachable and matches this
`h5p-server` version's `coreApiVersion` (major 1, minor 27).

## Configuration

Required environment variables in the PFY application:

```text
PFY_H5P_RUNTIME_SECRET=<min 32 chars>
PFY_H5P_RUNTIME_URL=https://runtime.example.com
```

Required environment variables in the runtime service:

```text
PORT=3001
PFY_H5P_RUNTIME_SECRET=<same as PFY application>
PFY_H5P_ADMIN_SECRET=<min 32 chars>
PFY_H5P_CORE_URL=https://cdn.jsdelivr.net/gh/h5p/h5p-php-library@1.27.0
# No leading dots — see "Content/library whitelist" below.
PFY_H5P_CONTENT_WHITELIST=json png jpg jpeg gif bmp svg mp3 m4a ogg wav mp4 webm ogv txt pdf h5p
PFY_H5P_LIBRARY_WHITELIST=js css png jpg jpeg gif bmp svg json md
PFY_H5P_STORAGE_PATH=./storage
```

Production should self-host the H5P core files and point `PFY_H5P_CORE_URL` at
that origin.

### Content/library whitelist (remediation note)

`h5p-server`'s `PackageValidator` strips the leading dot from a file's own
extension before comparing it against these whitelist entries. The original
implementation's defaults (and `.env.example`) included leading dots (e.g.
`.json`), so **every file in every imported package failed
`not-in-whitelist` validation** — the import route was completely
non-functional, not merely insecurely ordered. Fixed defaults have no leading
dots. Verified with a real `.h5p` package fixture in
`services/h5p-runtime/tests/import.integration.test.ts`.

## Storage

Persistent runtime state lives under `PFY_H5P_STORAGE_PATH`:

```text
storage/
├── content/        # imported H5P content
├── libraries/      # installed H5P libraries
├── temporary/      # temporary package-import/editor state (not publicly served)
└── user-data/      # H5P user state and finished data
```

### Temporary files and editor boundary

Package import uses Lumi's temporary storage internally while validating and
extracting an upload, then copies referenced assets into permanent content
storage during the final sanitized save. Learner playback reads those permanent
assets through the token-protected
`/h5p/content/:contentId/files/*` route; it does not require HTTP access to
temporary storage.

The runtime does not expose a public static route for `temporary/`:
`/h5p/temp/*` returns 404. Lumi's editor integration generates temporary-file
URLs using its configured `temporaryFilesUrl` (default `/temp-files`), and the
optional `@lumieducation/h5p-express` adapter maps that route to Lumi's
permission-checked `getTemporaryFile` method. The current PFY runtime does not
mount the editor routes or expose an editor workflow. In this pinned setup,
Lumi's default permission system is permissive, so mounting the optional route
alone would not provide PFY user authorization. Any future editor integration
must establish authenticated PFY user context and a restrictive Lumi
permission system before enabling temporary-file HTTP access.

### Local development

`PFY_H5P_STORAGE_PATH=./storage` (a relative directory on the developer's
filesystem) is adequate — restarting the dev process must not lose content
mid-session, and a relative path survives ordinary restarts on a single
machine.

### Production deployment contract

SPEC-005 does not select a hosting provider (Implementation Freedom §17). The
infrastructure that runs this service **must** satisfy the following
contract, independent of which provider is chosen:

- **Persistent volume**: `PFY_H5P_STORAGE_PATH` must be mounted on storage
  that survives container/process restarts, redeployments and host failures
  — e.g. a Kubernetes `PersistentVolumeClaim` with a durable
  `StorageClass`, an attached cloud block-storage volume, or an equivalent
  platform-managed persistent disk. An ephemeral container filesystem
  (the container's writable layer with no volume mount) is **not**
  acceptable for production — content and libraries would be silently lost on
  every redeploy.
- **Mount/path configuration**: the deployment must set
  `PFY_H5P_STORAGE_PATH` to the mount point of that persistent volume, and
  the runtime process's filesystem user must have read/write access to it.
- **Restart behavior**: on restart, the runtime re-reads existing
  `content/`, `libraries/`, `temporary/` and `user-data/` directories from
  the mounted volume — no explicit re-provisioning step is required as long
  as the mount is present at the configured path.
- **Backup responsibility**: the platform/infrastructure operator owns
  scheduling and retention of backups for the persistent volume (this is
  infrastructure, not application, responsibility — SPEC-005 does not
  implement a backup mechanism). Recommended minimum: daily snapshot of the
  volume, retained per the platform's standard data-retention policy.
- **Backup procedure**: snapshot/back up the entire `PFY_H5P_STORAGE_PATH`
  directory tree as a unit. Do not back up `content/` without `libraries/`
  — restoring content without the libraries it depends on leaves it
  unplayable.
- **Restore procedure**: restore the full directory tree to a volume mounted
  at `PFY_H5P_STORAGE_PATH`, then restart the runtime process. No database
  migration or reconciliation step is required on the runtime side; the PFY
  application's `exercise_h5p_mappings` table is the source of truth for
  which `lumi_content_id` values are expected to exist and must be restored
  independently if lost (it lives in the PFY PostgreSQL database, not on
  this volume).
- **Failure behavior**: if the persistent volume is unavailable, the
  `/ready` endpoint returns `503` (it checks `fs.access` on `content/` and
  `libraries/`) so orchestration platforms can hold traffic until storage
  recovers. The runtime does not silently fall back to ephemeral storage.
- **Library persistence**: installed libraries live under
  `libraries/` on the same volume as content. There is currently no
  separate library-registry service; library availability is entirely a
  function of this directory's contents.

## Health and readiness

- `GET /health` — returns `{ status: "ok" }`
- `GET /ready` — returns `{ status: "ready" }` when storage is accessible,
  `503` otherwise

## Authorized playback flow

1. Learner opens an Activity containing an H5P-backed Exercise.
2. PFY application verifies the learner has access (published + `free`, or
   future entitlement resolution from SPEC-009).
3. PFY application verifies the Exercise belongs to the Activity.
4. PFY application resolves `exercise_id` → `lumi_content_id` using the
   `exercise_h5p_mappings` table (service-role only).
5. PFY application signs a runtime token with `sub`, `cid`, `eid`, `act` and
   `exp`.
6. Browser receives an iframe `src` pointing at the runtime service with the
   token.
7. Runtime service validates the token signature, expiration, header/algorithm
   and content-id match before rendering the H5P player.
8. **The player HTML itself embeds the same verified token into every
   content-file/media URL it generates** (`contentFilesUrlPlayerOverride`),
   so subsequent in-page asset requests are authorized identically to the
   initial player load — not just the player's own top-level request.

## Security controls

- Lumi content IDs are not exposed as canonical PFY identifiers.
- The `exercise_h5p_mappings` table is denied to ordinary database users, and
  `lumi_content_id` is `unique` (one Exercise maps to exactly one Lumi
  content id and vice versa — see "Mapping cardinality" below).
- Direct access to `/h5p/play/:contentId` **and** to
  `/h5p/content/:contentId/files/*` (the actual content/media asset route)
  without a valid, content-matching token is rejected. A token issued for one
  content id cannot be replayed against a different content id in either
  route. **Remediation note:** the original implementation only gated
  `/h5p/play/:contentId`; the content-file route was served by unauthenticated
  `express.static`, so knowing/guessing a Lumi content id was sufficient to
  read its files directly — the exact bypass ADR-001/SPEC-005 prohibit. Fixed
  by routing content-file requests through `H5PAjaxEndpoint.getContentFile`
  behind the same token check, and by having the rendered player HTML embed
  the verified token in its own generated asset URLs.
- `/h5p/libraries` remains unauthenticated: it serves H5P core/runtime
  JavaScript and CSS shared by every piece of content, not PFY-protected
  learner content.
- Temporary upload/extraction files are never served with `express.static`.
  The unguarded `/h5p/temp` mount was removed; import accesses temporary files
  through Lumi's owner-scoped storage manager and promotes them to permanent
  content before learner playback. Regression tests prove temporary files are
  not readable through the former path and imported assets remain available
  to the protected content-file route.
- Import sanitization runs on parameters returned by `uploadPackage`
  (temporary-storage extraction) **before** the single, final
  `saveOrUpdateContentReturnMetaData` persistence call — see "Import
  pipeline" below.
- Malformed, truncated, tampered or wrong-algorithm runtime tokens fail
  closed (return `null`/401) and never throw. Verified with a dedicated
  regression suite covering too-short/too-long signatures, malformed
  base64url, missing segments, malformed JSON, invalid header/algorithm,
  invalid payload types, missing claims and tampering.
- Library installation requires the `PFY_H5P_ADMIN_SECRET`, compared with
  `crypto.timingSafeEqual` (constant-time; rejects mismatched-length secrets
  without leaking timing information).
- Service/admin credentials never reach the browser.

The player and successful permanent content-file responses, including `206`
byte-range responses, set `Referrer-Policy: strict-origin-when-cross-origin`
and `X-Content-Type-Options: nosniff`. The HTTP integration tests assert both
headers on normal and partial content-file responses.

## Import pipeline (remediation note — Finding 3)

**Verified behavior of `addPackageLibrariesAndContent`** (the method used by
the original implementation): it calls `PackageImporter.processPackage` with
`copyMode: Install`, which delegates to
`ContentStorer.copyFromDirectoryToStorage`. That method calls
`contentManager.createOrUpdateContent(metadata, parameters, ...)` — with the
**raw, unsanitized** parameters read from the package — and persists them to
permanent content storage **before returning**. The original route then called
`sanitizeH5pParameters` and issued a **second**
`createOrUpdateContent` call with the sanitized version. This means:

- unsanitized, attacker-controlled parameters were briefly the durable,
  readable persisted state;
- any failure between the two calls (process crash, timeout) would leave the
  **unsanitized** version persisted permanently, with no cleanup.

**Fix:** the import route now calls `editor.uploadPackage(packagePath, user)`
— Lumi's own "extract to temporary storage, install libraries, do not persist
content" path (the same one its editor-upload flow uses) — sanitizes the
returned parameters, then makes exactly **one** persistence call via
`editor.saveOrUpdateContentReturnMetaData`. That call additionally runs
Lumi's own trusted `SemanticsEnforcer` (the same sanitizer the H5P editor's
save action uses, driven by each library's declared `semantics.json`) — see
"Sanitization layering" below. Verified end-to-end with real `.h5p` package
fixtures in `services/h5p-runtime/tests/import.integration.test.ts`, asserting
against content read back from persistent storage (not the sanitizer's return
value).

```text
package
   ↓
archive/path validation           (PackageValidator, via editor.uploadPackage)
   ↓
file/extension validation         (PackageValidator, via editor.uploadPackage)
   ↓
semantic parameter sanitization   (our sanitize-html layer, applied to the
   ↓                               uploadPackage result)
residual dangerous-markup         (Lumi's own SemanticsEnforcer, inside
validation                         saveOrUpdateContentReturnMetaData)
   ↓
trusted library resolution        (already completed by uploadPackage)
   ↓
persistence                       (the ONE saveOrUpdateContentReturnMetaData
                                    call — sanitized parameters only)
```

### Sanitization layering (remediation note — Finding 4)

Two independent layers now run on every import, not one:

1. **Lumi's own trusted editor-save sanitizer** (`SemanticsEnforcer`), via the
   `saveOrUpdateContentReturnMetaData` call above. This is the SAME code path
   the H5P editor's save action uses. It scopes `sanitize-html` per-field to
   exactly the tags/styles each library's `semantics.json` declares for that
   field, and unconditionally strips `script`/`style`/`textarea`/`option`
   everywhere regardless of a library's declared tags. Verified running on
   imported (not just editor-saved) content by a dedicated test asserting a
   restrictive `semantics.json` field's declared tag allowlist is enforced on
   import.
2. **`services/h5p-runtime/src/sanitize.ts`** (independent, PFY-owned): a
   defense-in-depth backstop for content the semantics tree does not
   describe — free-form/dynamic keys, libraries with incomplete semantics,
   and arbitrary nested structures the ADR-001 spike identified as
   historically present in legacy WordPress H5P content. It is not a
   replacement for (1); it exists for what (1) cannot see.

## Mapping cardinality (remediation note — Finding 6)

`exercise_h5p_mappings.lumi_content_id` now carries a `unique` constraint
(migration `20260929000000_exercise_h5p_mapping_lumi_content_id_unique.sql`,
additive — the original mapping migration is not rewritten because it may
already be applied). **Authority:** ADR-002 defines the mapping as
bidirectional (`PFY Exercise UUID <-> PFY H5P Adapter <-> Lumi content id`),
not many-Exercise-to-one-Lumi-content, and SPEC-005 §6.2 requires "one Lumi
content identity per H5P-backed Exercise." Sharing one Lumi content id across
two Exercises would let editing or attempting through one Exercise silently
mutate content/state visible through the other, breaking Exercise-level
content-lifecycle ownership and (once SPEC-006 lands) Attempt isolation.

## iframe sandbox and token transport (remediation note)

The Activity Workspace's `<iframe>` (`src/app/h5p-exercise-block.tsx`) keeps
`sandbox="allow-scripts allow-same-origin allow-forms allow-popups
allow-popups-to-escape-sandbox"`. Each permission is required by H5P's own
documented embedding contract and by representative content types
(state-persisting content, quiz/fill-in inputs, external-link/embed dialogs
respectively) — narrowing further breaks real content rather than closing an
actual gap, because `allow-same-origin` scopes the iframe to the **runtime's**
origin (a separate origin from the PFY app per ADR-001's isolation
requirement), not the parent page's session/cookies. See the in-file comment
for the full per-permission rationale.

The runtime token travels as an iframe `src` query parameter. This was
reviewed for exposure via browser history, `Referer` headers and access logs;
`Referrer-Policy: strict-origin-when-cross-origin` is set on both the player
and content-file responses to prevent forwarding to third-party origins, and
the token's 1-hour TTL bounds the exposure window. A cookie/session-based
transport was considered and rejected as out of SPEC-005's scope (it would
require building cross-origin session infrastructure the isolated-runtime
architecture does not otherwise need). See the in-code comment in
`src/lib/h5p/adapter.ts` for the full analysis.

## Import / library administration

Package ingestion and library installation are privileged operator/admin
operations against the runtime service:

```sh
curl -X POST http://localhost:3001/h5p/admin/import \
  -H "Content-Type: application/json" \
  -H "X-PFY-H5P-Admin-Secret: $PFY_H5P_ADMIN_SECRET" \
  -d '{"packagePath":"/path/to/content.h5p"}'

curl -X POST http://localhost:3001/h5p/admin/libraries \
  -H "Content-Type: application/json" \
  -H "X-PFY-H5P-Admin-Secret: $PFY_H5P_ADMIN_SECRET" \
  -d '{"directoryPath":"/path/to/extracted/Library.Name-1.0"}'
```

Negative-path coverage (no secret, wrong secret, wrong HTTP method) is
verified in `services/h5p-runtime/tests/http.integration.test.ts`.

## Local development

1. Start the runtime service:

```sh
cd services/h5p-runtime
cp .env.example .env
# edit .env
npm run dev
```

2. Start the PFY application with `PFY_H5P_RUNTIME_URL` pointing at the runtime.

3. To run the cross-origin Playwright E2E test
   (`tests/e2e/h5p-playback.spec.ts`), the H5P runtime is booted automatically
   by `playwright.config.ts` when `PFY_H5P_RUNTIME_SECRET` and
   `PFY_H5P_ADMIN_SECRET` are set in the environment, alongside the existing
   Supabase/Inbucket variables required by `tests/e2e/auth.spec.ts`.

## Upgrade policy

Major or security-relevant Lumi/H5P runtime upgrades require deliberate
compatibility and security validation, including re-running:

- the import sanitizer regression tests
  (`services/h5p-runtime/tests/sanitize.test.ts`,
  `services/h5p-runtime/tests/import.integration.test.ts`);
- the runtime token regression tests
  (`tests/h5p-token.test.ts`, `services/h5p-runtime/tests/token.test.ts`,
  `tests/h5p-token-parity.test.ts`);
- the runtime HTTP authorization tests
  (`services/h5p-runtime/tests/http.integration.test.ts`).

## Open gate

Production rollout remains gated by the GPL/legal review identified in
ADR-001. Do not mark the runtime production-rollout ready until that review is
complete.
