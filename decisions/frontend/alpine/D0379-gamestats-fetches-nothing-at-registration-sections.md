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
<!-- backfill: pending -->

# `gameStats` fetches nothing at registration; sections settle independently

## Context and Problem Statement
the store is registered on every page, so its `init()` spent Neon and Worker calls on gameplay, login and settings pages against the cache's fetch rule (`10-Statistics/00-Overview.md` §7). `Promise.all` let one over-cap section blank every card as zeros, reading as "no data".

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`gameStatsStore().init()` is a no-op, so no page but `/statistics` reads statistics. `/statistics` loads through `selectGame`, called from the Games tab's `x-effect` only while `tab === 'games'`, matching `routineStats.activate()`. `load()` reads sections with `Promise.allSettled`: a rejected section is recorded in `sectionErrors` (surfaced by `failedSectionsMessage`) and the other sections and the session list still render; `error` now reports only a session-list failure.".

### Consequences
re-selecting the Games tab reloads through the cache, not the network, for closed buckets. A failed section shows no card plus one line naming it; there is no per-card retry.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-01
