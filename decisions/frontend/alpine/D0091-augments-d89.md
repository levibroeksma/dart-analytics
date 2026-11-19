---
id: D0091
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Augments D89

## Context and Problem Statement
Safety valve for the rare unavoidable breaking shape change. D89 forbids runtime `schemaVersion` machinery. This record keeps that rule as the norm and adds a minimal exit for a change that cannot be made additive.

## Decision Drivers
* A stale persisted store must not rehydrate into incompatible code.
* The additive-only rule (D89) stays the norm.

## Considered Options
* Additive-only with no versioning escape (D89 alone).
* A single `_v` integer per persisted store, discarded on an incompatible bump (chosen).

## Decision Outcome
Chosen option: "Augments D89: single `_v` integer per persisted store discards on incompatible bump; additive changes never bump it", because Safety valve for the rare unavoidable breaking shape change.

### Consequences
* Neutral, because additive changes never bump `_v`. Only a genuinely breaking shape change does.
* Neutral, because each persisted store discards its own state on mismatch in `init()`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit message says the handbook, `00-Overview`, the agent guide, the context map and the decisions were updated. No source names a check for `_v`.

## Pros and Cons of the Options
### `_v` safety valve
* Good, because a stale store cannot rehydrate into incompatible code.
* Good, because it avoids heavyweight `schemaVersion` machinery.

## Evidence / More Information
Decided: 2026-07-14

* Commit `84403e65` (2026-07-14; no spec; edits `03-Alpine-Patterns.md` Schema evolution and the agent guide): rebuilt Context, Drivers, Considered Options, Consequences and Pros and Cons.
* Augments D89; the first Evidence source of D89 is `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 5).
* Applied in: `docs/superpowers/specs/2026-07-16-score-training-engine-design.md`, `docs/superpowers/plans/2026-07-28-alpine-loading-state.md`.
