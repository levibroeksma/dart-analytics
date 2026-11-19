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

# Dedicated statistics layouts: one self-fetching Alpine factory per section

## Context and Problem Statement
one store loading every section couples unrelated cards and fetches cards that aren't shown; per-section factories keep fetch, state and failure local and let sections be added one at a time.

The default `/statistics` state is meant to fetch only the score-trend section.

## Decision Drivers
* One store loading every section couples unrelated cards.
* Cards that are not shown still get fetched.
* Sections should be added one at a time, each keeping fetch, state and failure local.

## Considered Options
* One self-fetching Alpine factory per section on the shared cached `loadGameSection` loader (spec approach A).
* Per-section stores or uncached direct fetches, which the spec rules out.

## Decision Outcome
Chosen option: "A game listed in `DEDICATED_STATS_LAYOUTS` renders its own layout on `/statistics`, mounted by `x-if` only while selected; `gameStats.selectGame` returns without fetching for it. Each section is its own component with its own `*.data.ts` factory that fetches in `init()` and on its own range change through the shared cached `loadGameSection`. Score Training is first, with the score-trend section.", because one store loading every section couples unrelated cards and fetches cards that aren't shown; per-section factories keep fetch, state and failure local and let sections be added one at a time.

### Consequences
the default `/statistics` state fetches only the score-trend section; Score Training has no session list or other cards until they are built as sections. Remounting refetches through the IndexedDB cache. Until the remaining sections are rebuilt, `/statistics` shows a placeholder for every other game and for the Routines tab: the generic cards, `gameStats` loading and `routineStats` activation are unwired from the page, while their stores and components stay in the tree.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit adds `app/tests/lib/stats/load-game-section.test.ts` and extends `register-route-data.test.ts` and `constants.test.ts`. The spec covers `.astro` markup with `astro check` instead of unit tests (D101).

## Pros and Cons of the Options
### Per-section factory
* Good, because fetch, state and failure stay local and sections can be added one at a time.
* Bad, because until the other sections are rebuilt `/statistics` shows a placeholder for every other game and for the Routines tab.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (refines D379).

* `docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md` (Decisions taken in brainstorming, § 1): rebuilt Context, Considered Options and Confirmation.
* `docs/superpowers/plans/2026-10-01-score-training-trend-section.md` (the D385 entry step): rebuilt Decision Drivers.
* Commit `be9cc0be` (PR #698, 2026-10-02): rebuilt Pros and Cons and Confirmation.
