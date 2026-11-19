---
id: D0556
status: accepted
date: 2026-11-13
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The 501 variation is a derived read-time filter on `starting_score`; 501-only, default 501, no stored column

## Context and Problem Statement
a 301 or custom-score game skews 501 averages, checkout rates and leg lengths. The variation is already stored as `starting_score` in the session snapshot, so by the principle "store what happened, derive what it means" it is derived in the read layer: no migration, no column. Rejecting rather than ignoring the parameter on other games keeps a request from silently dropping the filter. Treating an absent snapshot or score as 501 matches every pre-variation game.

## Decision Drivers
* A 301 or custom score skews averages, checkout rates, leg lengths and the inferred-aim sections. The owner wants the 501 page to describe real 501 games by default (spec, Intent).
* Store what happened, derive what it means: the variation derives from the stored `starting_score` (spec, Non-goals).
* A game that cannot honour the filter rejects it instead of silently ignoring it (spec, Anti-goals).

## Considered Options
* A read-time filter on the stored `starting_score`, 501 only, defaulting to 501 (chosen).
* Store the variation in a new column or table (the spec's Non-goals rule this out).
* Accept the parameter on other games and ignore it there.
* Keep feeding every completed 501-game session into the 501 statistics, which is today's state.

## Decision Outcome
Chosen option: "a `variation` query parameter (integer 2–999, the `starting_score`) joins the Common Query Contract for game type `501` only. Every 501 section, the aim-filtered heatmap and the session list read the sessions whose `COALESCE(configuration->>'starting_score', 501)` equals it; absent means `501`. Any other game and every routine route reject it with `VALIDATION_FAILED`, as does a non-numeric, empty or out-of-range value; with `routineStep` set no variation filter applies. A new read, `GET /api/statistics/games/501/variations`, returns `{ variations: { startingScore, sessions }[] }` over the owner's completed `VISUAL_BOARD` sessions, `501` always listed and first, the rest ascending. `dataVersion` stays game-wide and `variation` joins the client cache's `paramsKey`.".

### Consequences
`10-Statistics/00-Overview.md` 1.8.0 (§5 parameter row, §6 route row), `01-Section-Catalog.md` 1.8.0 (§2.1 paragraph) and `06-API/04-Endpoint-Contracts.md` 1.19.0 are updated. `dataVersion` over-invalidates when a game in another variation completes; accepted. The home page's first-9 average still mixes variations (out of scope). Spec: `docs/superpowers/specs/2026-11-13-x01-variation-filter-design.md`; plan: `docs/superpowers/plans/2026-11-13-x01-variation-filter.md`.

* Good, because the variations list is built from the owner's completed games and needs no hard-coded values (spec, Goals).
* Neutral, because an integer of at least 2 with no sessions returns the normal empty series, not an error (spec, Scope details).
* Neutral, because a session with no snapshot, or none with a `starting_score`, counts as 501. The spec marks this as the author's guess (spec, Behaviour 4).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec requires tests for these cases. They are the predicate in each scope kind, the 501 default with an absent snapshot and a custom 501 merging with the preset. They also cover non-501 rejection, cache key separation and the store fallback. `tests/pages/api/statistics/games-variations.test.ts`, `tests/lib/stats/variation.test.ts`, `tests/stores/stats-variation.store.test.ts` and `tests/lib/client/stats-cache/keys.test.ts` exist today.

## Pros and Cons of the Options
### A read-time filter on `starting_score`
* Good, because no migration is expected: `v_stats_session_facts.configuration` already exposes the snapshot (spec, Mechanism).
* Good, because every section read goes through the shared scope builders, so the predicate lands in one place per scope kind (spec, Mechanism).
* Bad, because `dataVersion` stays game-wide and over-invalidates the cache when a game in another variation completes. The spec accepts this as the author's call (spec, Mechanism).
* Bad, because `variation` must join the client cache `paramsKey`. Without it a switch serves the wrong cached series (spec, Mechanism).

### Store the variation in a new column or table
* Bad, because it stores a value the spec says to derive (spec, Non-goals).

### Accept the parameter on other games and ignore it there
* Bad, because the spec lists a request that silently ignores the filter as an anti-goal.

### Keep every completed 501-game session in the 501 statistics
* Bad, because a 301 or custom 1001 skews averages, checkout rates, leg lengths and the inferred-aim sections (spec, Intent).

## Evidence / More Information
Decided: 2026-11-13

* `docs/superpowers/specs/2026-11-13-x01-variation-filter-design.md` (Intent, Goals, Non-goals, Anti-goals, Behaviour, Mechanism, Scope details, Constraints): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* Commit `a9ccbc2b` (2026-11-13, "docs: 501 variation filter contract"; adds the D556 row): source of the Context and Decision Outcome text.
* Applied in: `docs/superpowers/specs/2026-11-14-x01-statistics-page-design.md`.
