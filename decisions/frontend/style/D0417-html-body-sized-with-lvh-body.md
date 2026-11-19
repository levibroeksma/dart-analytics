---
id: D0417
status: accepted
date: 2026-10-05
origin: contemporaneous
original-date:
tags: [frontend/style, CSS]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `html`/`body` sized with `lvh`; `body` is the containing block for fixed descendants

## Context and Problem Statement
D415's `inset-0` left the gap on device: iOS standalone's fixed containing block still ended above the screen bottom, and the nav sat ~25pt above that edge.

## Decision Drivers
* D415's `inset-0` left the gap on device.
* iOS standalone's fixed containing block still ended above the screen bottom, and the nav sat about 25pt above that edge.

## Considered Options
* `html` and `body` sized with `lvh`, with `transform-gpu` on `body` (chosen).
* D415's `body` `fixed inset-0` sizing.

## Decision Outcome
Chosen option: "`html` uses `h-lvh max-h-lvh`; `body` uses `fixed inset-x-0 top-0 h-lvh max-h-lvh transform-gpu`. The transform makes `body` the containing block of every `position: fixed` descendant (bottom nav, modals, backdrop layers), so they span the full-height box. Top inset padding is unchanged.", because D415's `inset-0` left the gap on device: iOS standalone's fixed containing block still ended above the screen bottom, and the nav sat ~25pt above that edge.

### Consequences
fixed descendants no longer track the dynamic viewport; harmless in standalone, where no browser chrome resizes. `.astro`/CSS carry no unit test (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### `lvh` sizing with a transformed `body`
* Good, because every fixed descendant (bottom nav, modals, backdrop layers) spans the full-height box.

### D415's `fixed inset-0`
* Bad, because the nav still sat about 25pt above the screen edge on device.

## Evidence / More Information
Decided: 2026-10-05
Supersedes: D415 (sizing only).

* Commit `c8fc7efc` (PR #790, 2026-10-05; `global.css` `html`/`body` rules): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
