---
id: D0415
status: accepted
date: 2026-10-05
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `body` is `fixed inset-0`, not `h-dvh`

## Context and Problem Statement
in an iOS standalone web app `dvh` stopped short of the screen bottom, leaving a dead band under the bottom nav. Pinning `body` to the viewport edges fills it; the top inset is untouched.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`global.css` `body` uses `fixed inset-0 overflow-hidden` in place of `relative h-dvh max-h-dvh overflow-hidden`; `padding-top: env(safe-area-inset-top)` is unchanged. `html` keeps `h-dvh max-h-dvh`.", because in an iOS standalone web app `dvh` stopped short of the screen bottom, leaving a dead band under the bottom nav. Pinning `body` to the viewport edges fills it; the top inset is untouched.

### Consequences
bottom nav sits flush with the screen edge, under the home indicator. `.astro`/CSS carry no unit test (D101); the proof is the rule in `global.css`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-05
Supersedes: none (amends the sizing clause of D174).
Referenced by D0417's `Supersedes:` line.
