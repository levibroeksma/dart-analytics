---
id: D0379
status: accepted
date: 2026-10-01
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

# `gameStats` fetches nothing at registration; sections settle independently

## Context and Problem Statement
the store is registered on every page, so its `init()` spent Neon and Worker calls on gameplay, login and settings pages against the cache's fetch rule (`10-Statistics/00-Overview.md` §7). `Promise.all` let one over-cap section blank every card as zeros, reading as "no data".

## Decision Drivers
* The `gameStats` store registers on every page, so its `init()` spent Neon and Worker calls on pages that show no statistics.
* The cache's fetch rule (`10-Statistics/00-Overview.md` § 7) forbids those calls.
* One over-cap section must not blank every card as zeros, which reads as "no data".

## Considered Options
* Keep `init()` fetching at registration and reading sections with `Promise.all` (the behaviour the Context describes before this record).
* Make `init()` a no-op, load through `selectGame` and read sections with `Promise.allSettled` (chosen).

## Decision Outcome
Chosen option: "`gameStatsStore().init()` is a no-op, so no page but `/statistics` reads statistics. `/statistics` loads through `selectGame`, called from the Games tab's `x-effect` only while `tab === 'games'`, matching `routineStats.activate()`. `load()` reads sections with `Promise.allSettled`: a rejected section is recorded in `sectionErrors` (surfaced by `failedSectionsMessage`) and the other sections and the session list still render; `error` now reports only a session-list failure.".

### Consequences
re-selecting the Games tab reloads through the cache, not the network, for closed buckets. A failed section shows no card plus one line naming it; there is no per-card retry.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `105dba75` adds 3 cases to `app/tests/stores/game-stats.store.test.ts`: "init() fetches nothing; statistics load only on selectGame/load", "one failing section keeps the other sections and the session list" and "a failing session list sets error without dropping the sections".

## Pros and Cons of the Options
### No-op `init()`, `selectGame` load, `Promise.allSettled`
* Good, because no page but `/statistics` reads statistics.
* Good, because a rejected section is recorded in `sectionErrors` while the other sections and the session list still render.
* Bad, because a failed section has no per-card retry.

### Fetch at registration with `Promise.all`
* Bad, because the Context says it spent Neon and Worker calls on gameplay, login and settings pages against the cache's fetch rule.
* Bad, because one over-cap section blanked every card as zeros, which reads as "no data".

## Evidence / More Information
Decided: 2026-10-01

* Commit `105dba75` (2026-10-01, PR #682, adds the D379 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the row's Decision, Reason and Consequences lines and its tests.
* Applied in: `docs/superpowers/plans/2026-10-01-score-training-trend-section.md` (decision text, "Supersedes: none (refines D379)"), `docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md` (§ 1).
