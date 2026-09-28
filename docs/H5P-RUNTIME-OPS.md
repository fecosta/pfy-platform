# PFY H5P Runtime Operations

**Status:** IMPLEMENTED / PRODUCTION LEGAL GATE OPEN  
**Related:** `docs/ADR-001-LUMI-H5P-RUNTIME.md`, `docs/ADR-002-ACTIVITY-COMPOSITION-H5P-EXERCISE-BOUNDARY.md`, `docs/ARCHITECTURE.md`

## Topology

```text
PFY Web / Next.js
        |
        +--> PFY H5P Adapter (src/lib/h5p/)
                |
                +--> signed runtime token
                        |
                        v
        PFY H5P Runtime (services/h5p-runtime/)
                        |
                        +--> Lumi H5P Server 10.0.4
                        +--> filesystem / persistent storage
```

The runtime is an isolated Node process. It does not connect to the PFY
PostgreSQL database; it trusts short-lived signed runtime tokens issued by the
PFY application adapter.

## Pinned versions

| Component | Version |
|---|---|
| `@lumieducation/h5p-server` | 10.0.4 |
| `@lumieducation/h5p-express` | 10.0.5 |
| `express` | 4.21.2 |
| `sanitize-html` | 2.14.0 |
| H5P core files (default CDN) | 1.26.0 via jsDelivr |

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
PFY_H5P_CORE_URL=https://cdn.jsdelivr.net/gh/h5p/h5p-php-library@1.26.0
PFY_H5P_STORAGE_PATH=./storage
```

Production should self-host the H5P core files and point `PFY_H5P_CORE_URL` at
that origin.

## Storage

Persistent runtime state lives under `PFY_H5P_STORAGE_PATH`:

```text
storage/
├── content/        # imported H5P content
├── libraries/      # installed H5P libraries
├── temporary/      # temporary upload/editor state
└── user-data/      # H5P user state and finished data
```

Back up this directory. The runtime does not persist PFY Attempts or Results;
that boundary belongs to SPEC-006.

## Health and readiness

- `GET /health` — returns `{ status: "ok" }`
- `GET /ready` — returns `{ status: "ready" }` when storage is accessible

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
7. Runtime service validates the token signature, expiration and content-id
   match before rendering the H5P player.

## Security controls

- Lumi content IDs are not exposed as canonical PFY identifiers.
- The `exercise_h5p_mappings` table is denied to ordinary database users.
- Direct access to `/h5p/play/:contentId` without a valid token is rejected.
- Import sanitization runs after Lumi package import and before the final
  persisted content state.
- Library installation requires the `PFY_H5P_ADMIN_SECRET`.
- Service/admin credentials never reach the browser.

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

## Local development

1. Start the runtime service:

```sh
cd services/h5p-runtime
cp .env.example .env
# edit .env
npm run dev
```

2. Start the PFY application with `PFY_H5P_RUNTIME_URL` pointing at the runtime.

## Upgrade policy

Major or security-relevant Lumi/H5P runtime upgrades require deliberate
compatibility and security validation, including re-running the import
sanitizer regression test.

## Open gate

Production rollout remains gated by the GPL/legal review identified in
ADR-001. Do not mark the runtime production-rollout ready until that review is
complete.
