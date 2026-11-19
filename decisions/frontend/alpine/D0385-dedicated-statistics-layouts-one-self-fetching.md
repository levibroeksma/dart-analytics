---
id: D0385
status: accepted
date: 2026-10-02
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, stores, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Dedicated statistics layouts: one self-fetching Alpine factory per section

## Context and Problem Statement
one store loading every section couples unrelated cards and fetches cards that aren't shown; per-section factories keep fetch, state and failure local and let sections be added one at a time.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A game listed in `DEDICATED_STATS_LAYOUTS` renders its own layout on `/statistics`, mounted by `x-if` only while selected; `gameStats.selectGame` returns without fetching for it. Each section is its own component with its own `*.data.ts` factory that fetches in `init()` and on its own range change through the shared cached `loadGameSection`. Score Training is first, with the score-trend section.", because one store loading every section couples unrelated cards and fetches cards that aren't shown; per-section factories keep fetch, state and failure local and let sections be added one at a time.

### Consequences
the default `/statistics` state fetches only the score-trend section; Score Training has no session list or other cards until they are built as sections. Remounting refetches through the IndexedDB cache. Until the remaining sections are rebuilt, `/statistics` shows a placeholder for every other game and for the Routines tab: the generic cards, `gameStats` loading and `routineStats` activation are unwired from the page, while their stores and components stay in the tree.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (refines D379).
