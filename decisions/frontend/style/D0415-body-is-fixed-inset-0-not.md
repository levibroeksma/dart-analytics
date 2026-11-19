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

# `body` is `fixed inset-0`, not `h-dvh`

## Context and Problem Statement
in an iOS standalone web app `dvh` stopped short of the screen bottom, leaving a dead band under the bottom nav. Pinning `body` to the viewport edges fills it; the top inset is untouched.

## Decision Drivers
* In an iOS standalone web app `dvh` stopped short of the screen bottom, leaving a dead band under the bottom nav.
* The top inset stays untouched.

## Considered Options
* `body` is `fixed inset-0` (chosen).
* `body` stays `relative h-dvh max-h-dvh`.

## Decision Outcome
Chosen option: "`global.css` `body` uses `fixed inset-0 overflow-hidden` in place of `relative h-dvh max-h-dvh overflow-hidden`; `padding-top: env(safe-area-inset-top)` is unchanged. `html` keeps `h-dvh max-h-dvh`.", because in an iOS standalone web app `dvh` stopped short of the screen bottom, leaving a dead band under the bottom nav. Pinning `body` to the viewport edges fills it; the top inset is untouched.

### Consequences
bottom nav sits flush with the screen edge, under the home indicator. `.astro`/CSS carry no unit test (D101); the proof is the rule in `global.css`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### `body` is `fixed inset-0`
* Good, because pinning `body` to the viewport edges fills the band under the nav.

### `body` is `relative h-dvh max-h-dvh`
* Bad, because in an iOS standalone web app `dvh` stops short of the screen bottom.

## Evidence / More Information
Decided: 2026-10-05
Supersedes: none (amends the sizing clause of D174).
Referenced by D0417's `Supersedes:` line.

* Commit `81e6caa0` (PR #788, 2026-10-05; `global.css` `body` rule): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
