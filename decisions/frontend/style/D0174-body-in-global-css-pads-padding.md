---
id: D0174
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `body` in `global.css` pads `padding-top

## Context and Problem Statement
`black-translucent` status bar style + `viewport-fit=cover` (D173) already draw content edge-to-edge; with no safe-area inset anywhere in the codebase, header/title content collided with the iOS status bar's clock/battery/signal icons in a standalone-launched web app

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`body` in `global.css` pads `padding-top: env(safe-area-inset-top)` alongside its existing `h-dvh max-h-dvh overflow-hidden`".

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
Decided: 2026-07-29
