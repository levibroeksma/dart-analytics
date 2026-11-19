---
id: D0179
status: accepted
date: 2026-08-01
origin: contemporaneous
original-date:
tags: [frontend/astro, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `BaseLayout.astro`'s body-child wrapper div uses `h-full max-h-full` (was `h-dvh

## Context and Problem Statement
D174's `padding-top: env(safe-area-inset-top)` on `body` shrinks `body`'s border-box content area, but this nested div re-asserted its own full `100dvh` height regardless, overflowing `body`'s clipped bottom edge by exactly the top inset — invisible in a Safari tab (inset resolves 0 outside standalone display) but clipping `BottomNav` off-screen on an installed iOS Home Screen app, where the inset is non-zero

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`BaseLayout.astro`'s body-child wrapper div uses `h-full max-h-full` (was `h-dvh max-h-dvh`), matching the `h-full` pattern `AppLayout`/`GameLayout` already use for their own wrappers".

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
Decided: 2026-08-01
