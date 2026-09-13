# Portuguese for You — Architecture Documentation v1

**Status:** DECISION READY — ARCHITECTURE v1  
**Date:** 2026-09-13

This package consolidates the current product and architecture decisions for the greenfield rebuild of Portuguese for You (PFY).

## Authoritative documents

- `PRODUCT_DEFINITION_v1.md` — product contracts, personas, learning model, B2C/B2B access model, MVP boundary and migration boundary.
- `ARCHITECTURE_v1.md` — target technical architecture, boundaries, data ownership, security posture, deployment topology and implementation sequencing.
- `ADR-001-LUMI-H5P-RUNTIME.md` — decision record for adopting Lumi H5P as an isolated runtime and authoring engine.

## Evidence basis

The architecture is based on:

1. the PFY Product Definition decisions established during discovery;
2. the legacy WordPress database structure, used only as migration evidence;
3. the completed `fecosta/pfy-h5p-spike` technical spike;
4. the spike result `CONDITIONAL GO` for Lumi H5P.

The spike repository is disposable evidence, not the production codebase.

## Knowledge states

- **DECISION:** greenfield rebuild; Next.js + TypeScript; PostgreSQL/Supabase; Supabase Auth; relational authorization + RLS; Lumi H5P in a separate Node runtime; H5P adapter owned by PFY; append-only attempts; client-reported H5P score provenance; authoring via PFY wrapper around H5P editor.
- **PLANNED:** detailed physical schema, production deployment configuration, payment provider integration, authoring usability validation, legacy import tooling.
- **FUTURE VISION:** AI-assisted authoring across multiple H5P types, advanced institutional analytics, certificates, assignments and personal collections.
- **REVIEW REQUIRED:** GPL implications before production distribution/deployment; LGPD implementation details for pseudonymous institutional reporting.

## Next lifecycle state

The architecture is ready to be decomposed into implementation specifications. Individual specs are not implementation-ready until their product decisions, data contracts, security constraints and acceptance criteria are explicit.
