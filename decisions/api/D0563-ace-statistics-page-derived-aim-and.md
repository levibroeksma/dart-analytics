---
id: D0563
status: accepted
date: 2026-11-17
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Ace statistics page: derived aim and period comparison

## Context and Problem Statement
the owner asked to measure improvement over time as less drift and a higher target percentage. Ace is the only shipped VISIT_POINTS game with an aimed target: Score Training has its own page, Bull 500 is not shipped, and Fives has no target (any guessed aim would measure the guess).

## Decision Drivers
* The owner wants improvement measured over time as less drifting and a higher target percentage, each compared with the period before.
* Ace has a real target per round, drawn from the session's `drawSeed`, but the engine stores no intent per dart (`intent: () => NO_INTENT`). No per-target section can run for Ace.
* Anti-goal: a second copy of the sector, band, near-miss or Track card logic.
* Anti-goal: a target that differs from the one the game drew, so the walker reproduces `aceTargetFor(drawSeed, round)` exactly.
* Anti-goal: a change arrow from too few darts.

## Considered Options
* Leave Ace on the heatmap-only layout (the page before this record).
* Give Ace a derived-aim walker and a new `ACE_LAYOUTS` set (chosen).
* Join Ace to `TRACK_LAYOUTS` with an Ace-only tile row. The spec leaves the choice to the builder.

## Decision Outcome
Chosen option: "`ACE_V1` gains the `intent-derived` stats tag, and `derived-aims.module.ts` gets an `ACE` walker: the owner's dart i (in turn and dart order, owner darts only) aims at `aceTargetFor(drawSeed, floor(i / 3))`, keyed `NUMBER:n` (any ring hits) or `BULL:25` (either bull ring hits). `target-accuracy`, `miss-direction`, `loose-darts` and the heatmap target picker then serve Ace unchanged. `ACE_V1` leaves `HEATMAP_ONLY_LAYOUTS` for `ACE_LAYOUTS` and renders `AceStatsOverview.astro`: the completion tile, three tiles over the page Period against the preceding period of equal length (target hit rate; drift, the largest of the left, right, high and low miss shares by D561's sectors, named, compared with that same direction's share before; near miss share, near misses over near plus loose, D560), then the Track targets card (D562) over 1 to 20 and the bull, the heatmap and the session list. A change in points shows only when both periods have at least 30 (`MIN_TARGET_SAMPLE`) in the share's whole; All Time shows none.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.13.0; `10-Statistics/00-Overview.md` §3 lists Ace under `intent-derived`. The Track card's tile row and targets card are shared components (`StatTileRow.astro`, `TrackTargetsCard.astro`). Fives stays heatmap-only; Bull 500 waits for its V1.

* Good, because `target-accuracy`, `miss-direction` and `loose-darts` run for Ace with no new section id, migration or endpoint.
* Neutral, because a session whose snapshot lacks `drawSeed`, or whose dart count mismatches, is skipped, as the other walkers do.
* Neutral, because the 30-dart floor applies to the change, not to the current value.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/stats/derived-aims.module.test.ts` covers the Ace walker against `aceTargetFor`. `app/tests/lib/stats/constants.test.ts` asserts `ACE_LAYOUTS` holds `ACE_V1` and no other layout set does. `app/tests/lib/stats/ace/` and `app/tests/lib/stats/sections/ace-comparison.data.test.ts` cover the comparison tiles.

## Pros and Cons of the Options
### Leave Ace on the heatmap-only layout
* Bad, because no per-target section can run for Ace while its target is not stored per dart.

### Derived-aim walker and an Ace layout
* Good, because it reuses the existing sections, so no new section id, migration or endpoint is needed.

## Evidence / More Information
Decided: 2026-11-17

* `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md` (Intent, Goals, Non-goals, Anti-goals, Data, Constraints, Marked as the author's calls): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons. The spec is a draft for owner approval.
* `docs/superpowers/plans/2026-11-17-ace-statistics-page.md` (Task 1 to 5 tests, Task 9 decision step): rebuilt Confirmation.
* Commit `d1010c19` (PR #1345, 2026-11-18; adds the D563 row, `ace-comparison.test.ts` and the `ACE_LAYOUTS` case in `constants.test.ts`): rebuilt Confirmation.
