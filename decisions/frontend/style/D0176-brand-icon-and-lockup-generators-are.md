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

# Brand icon and lockup generators are checked in with their generated app assets

## Context and Problem Statement
Deterministic regeneration keeps source and committed outputs reviewable; Resvg otherwise renders the board black; manifest metadata must describe each asset truthfully

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Brand icon and lockup generators are checked in with their generated app assets; icon rasterization converts `oklch()` to sRGB for Resvg; `favicon.ico` remains a browser fallback but is omitted from the web manifest after its entry was mistyped as PNG", because Deterministic regeneration keeps source and committed outputs reviewable; Resvg otherwise renders the board black; manifest metadata must describe each asset truthfully.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Tests in `app/tests/scripts/generate-app-icons.test.ts` and `app/tests/scripts/generate-logo-lockup.test.ts` cover the generator helpers. The first covers the `oklch()` to sRGB conversion, the all-black raster check and the ICO writer.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-31

* Commit `29ca6447` (2026-07-31; adds the D176 row, `app/scripts/culori.d.ts` and the two generator test files): rebuilt Confirmation.
* Refined by D355 (changes the icon background, not the generator policy).
