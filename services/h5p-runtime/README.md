# PFY H5P Runtime

Isolated Node/Lumi H5P runtime service for the PFY platform.

## Responsibility

This service runs Lumi H5P as an isolated process behind the PFY H5P Adapter.
It does not own PFY Activity, Exercise or authorization semantics. It accepts
only short-lived signed runtime tokens issued by the PFY application adapter.

## Required environment

```text
PFY_H5P_RUNTIME_SECRET=<min 32 chars; shared with PFY application adapter>
PFY_H5P_ADMIN_SECRET=<min 32 chars; privileged operator/admin library install>
PFY_H5P_CORE_URL=https://cdn.jsdelivr.net/gh/h5p/h5p-php-library@1.26.0
PFY_H5P_STORAGE_PATH=./storage
PORT=3001
```

`PFY_H5P_CORE_URL` may point to a self-hosted copy of the H5P core files for
strict isolation. The default is a pinned jsDelivr tag; production deployments
should self-host.

## Run

```sh
npm install
npm run dev
```

## Endpoints

- `GET /health` — runtime health
- `GET /ready` — readiness probe (storage accessible)
- `GET /h5p/play/:contentId?token=...` — authorized H5P player
- `POST /h5p/admin/import` — import a `.h5p` package (admin secret)
- `POST /h5p/admin/libraries` — install library from directory (admin secret)

Static H5P libraries and content files are served from `PFY_H5P_STORAGE_PATH`.

## Operational notes

- H5P content, libraries, temporary files and user data are persisted under
  `PFY_H5P_STORAGE_PATH`.
- Backup this directory for disaster recovery.
- Library installation is restricted to the admin secret; ordinary users cannot
  install libraries.
- The service intentionally does not persist PFY Attempts or Results; that
  boundary belongs to SPEC-006.
