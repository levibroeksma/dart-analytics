---
id: D0204
status: accepted
date: 2026-08-10
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The magnifier's resolved read prints above the circle, smaller

## Context and Problem Statement
Owner direction after using the shipped board. No architectural tradeoff beyond the geometry note above: `top`, not `bottom`, is required for the same reason `magnifierAnchorStyle` uses `top`/`left` — the anchor div has no explicit size, so any property measured from its own far edge (`bottom`, `right`) would create a circular sizing dependency.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`BoardMagnifier.astro`'s read (`TREBLE 20 · 60`) prints above the magnifier circle at `text-xs` (was `text-sm`, below). `board-input.data.ts` exports a pure `magnifierLabelStyle(view)`, mirroring `magnifierAnchorStyle`/`magnifierBoardStyle`: `top: -(magnifierSize / 2 + gap)px`, paired with a `-translate-y-full` class so the computed `top` lands under the label's own bottom edge rather than its top — the label's height depends on its font size and is never known to the data layer.".

### Consequences
`magnifierLabelStyle` is unit-tested directly (mutation-tested: reverting to the old below-placement formula fails both new tests). The visual result was verified by driving the real Alpine build in a headless browser against the project's own compiled CSS, confirming the label's bounding box sits entirely above the circle's.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-10
Supersedes: D199 (its "resolved read below it" placement clause only; the press-drag-release mechanism is unchanged)
Referenced by D0432's `Supersedes:` line.
