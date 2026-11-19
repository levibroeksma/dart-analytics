---
id: D0176
status: accepted
date: 2026-07-31
origin: contemporaneous
original-date:
tags: [frontend/style, manifest, icon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Brand icon and lockup generators are checked in with their generated app assets

## Context and Problem Statement
Deterministic regeneration keeps source and committed outputs reviewable; Resvg otherwise renders the board black; manifest metadata must describe each asset truthfully

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Brand icon and lockup generators are checked in with their generated app assets; icon rasterization converts `oklch()` to sRGB for Resvg; `favicon.ico` remains a browser fallback but is omitted from the web manifest after its entry was mistyped as PNG", because Deterministic regeneration keeps source and committed outputs reviewable; Resvg otherwise renders the board black; manifest metadata must describe each asset truthfully.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-31
