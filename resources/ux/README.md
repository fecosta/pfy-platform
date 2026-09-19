# PFY UX References

**Status:** CURRENT  
**Last reconciled:** 2026-09-19

This directory versions UX reference material for the Portuguese for You (PFY) platform.

UX references are **not** authoritative product specifications.

## Contents

```text
resources/ux/
├── README.md                          this file
├── PROTOTYPE-CONFLICTS.md             register of known prototype conflicts and open decisions
└── prototype/
    ├── pfy-platform-prototype.dc.html navigable PFY prototype
    └── support.js                     generated prototype runtime (not application code)
```

### Current prototype snapshot

| File | SHA-256 |
|---|---|
| `prototype/pfy-platform-prototype.dc.html` | `de107b34c4c316bba24b8ed7c64b13649bfa9ac71786eaf7003530b639f6d5e9` |
| `prototype/support.js` | `8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe` |

- Snapshot date: 2026-09-18 (originally delivered as `resources/brand/PFY Platform Prototype.dc.html`).
- This is the prototype that authoritative documentation refers to as the "approved PFY prototype" / "UX reference".
- Open `prototype/pfy-platform-prototype.dc.html` in a browser. The runtime loads React, ReactDOM and Babel from `unpkg.com`, so viewing requires network access.
- `support.js` is generated prototype tooling. Do not edit it and do not copy it, or the prototype markup, into the PFY application.

When the prototype is updated, replace the snapshot, update the checksums and date above, and re-review `PROTOTYPE-CONFLICTS.md`.

## Authority

1. **Product behavior** is defined by `docs/PRODUCT_DEFINITION.md`, the accepted ADRs and `docs/ARCHITECTURE.md`, and the active specification under `resources/specs/active/`.
2. **UX references** define visual language, information hierarchy and responsive intent **only where they do not conflict** with those authoritative documents.
3. **Unsupported prototype concepts do not become requirements automatically.** A screen, label, metric, state or interaction that appears only in the prototype is not a product contract. Mock data does not establish product semantics.

Visual language itself is owned by the brand references, which the prototype applies:

```text
resources/brand/BRAND-SYSTEM.md    visual intent
        ↓
resources/brand/DESIGN-TOKENS.md   implementation-level visual semantics
        ↓
resources/ux/prototype/            application of the above to product surfaces
```

Where the prototype conflicts with the design tokens (for example, status colors), the design tokens win.

The overall source-of-truth hierarchy remains the one defined in the root `README.md` and `AGENTS.md`.

## Using the prototype

Before implementing any surface from the prototype:

1. identify the governing SPEC and authoritative contracts;
2. check `PROTOTYPE-CONFLICTS.md` for that surface;
3. do not implement items classified there as `CONFLICT`, `UNDEFINED` or `DECISION REQUIRED`;
4. treat items classified as `PROPOSAL` as input to a pending product decision, never as approved behavior.

If the prototype and an authoritative document disagree and resolving it requires changing a product contract, return `BLOCKED / DECISION REQUIRED`.
