---
id: D0448
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/astro, component]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Remove the dead `routineStats.stepGame` view

## Context and Problem Statement
Its only consumer was the generic `GameSectionCards`, deleted in D446. Nothing else read it; two tests pinned behaviour no component used (#921).

## Decision Drivers
* The only consumer of `stepGame` was the generic `GameSectionCards`, deleted in D446.
* Nothing else read it, and two tests pinned behaviour no component used (#921).

## Considered Options
* Leave `stepGame` in the store, as D446 did.
* Remove `stepGame` and its three writes (chosen).

## Decision Outcome
Chosen option: "`routine-stats.store.ts` no longer holds `stepGame` (a `gameStatsStore()` fed from `stepSections`) or its three writes in `resetStep`/`selectStep`. `stepSections` and `stepGameType()` stay.", because Its only consumer was the generic `GameSectionCards`, deleted in D446. Nothing else read it; two tests pinned behaviour no component used (#921).

### Consequences
A GAME step in the Routines tab reads `stepSections` directly. A future cards component builds on the dedicated section factories (D385).

* Good, because dead state and the two tests that pinned it leave the store.
* Neutral, because a GAME step in the Routines tab reads `stepSections` directly.
* Neutral, because a future cards component builds on the dedicated section factories (D385).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Leave `stepGame` in the store
* Bad, because it keeps a view and two tests for behaviour no component uses.

### Remove `stepGame`
* Good, because `stepSections` and `stepGameType()` stay, so the live GAME-step read path is untouched.

## Evidence / More Information
Decided: 2026-10-11
Supersedes: none (completes the cleanup D446 deferred).

* Commit `a21d6384` (2026-10-11; drops the store field, its three writes and the two tests, and closes #921): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
