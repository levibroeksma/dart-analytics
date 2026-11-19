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
<!-- backfill: pending -->

# Ace statistics page: derived aim and period comparison

## Context and Problem Statement
the owner asked to measure improvement over time as less drift and a higher target percentage. Ace is the only shipped VISIT_POINTS game with an aimed target: Score Training has its own page, Bull 500 is not shipped, and Fives has no target (any guessed aim would measure the guess).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`ACE_V1` gains the `intent-derived` stats tag, and `derived-aims.module.ts` gets an `ACE` walker: the owner's dart i (in turn and dart order, owner darts only) aims at `aceTargetFor(drawSeed, floor(i / 3))`, keyed `NUMBER:n` (any ring hits) or `BULL:25` (either bull ring hits). `target-accuracy`, `miss-direction`, `loose-darts` and the heatmap target picker then serve Ace unchanged. `ACE_V1` leaves `HEATMAP_ONLY_LAYOUTS` for `ACE_LAYOUTS` and renders `AceStatsOverview.astro`: the completion tile, three tiles over the page Period against the preceding period of equal length (target hit rate; drift, the largest of the left, right, high and low miss shares by D561's sectors, named, compared with that same direction's share before; near miss share, near misses over near plus loose, D560), then the Track targets card (D562) over 1 to 20 and the bull, the heatmap and the session list. A change in points shows only when both periods have at least 30 (`MIN_TARGET_SAMPLE`) in the share's whole; All Time shows none.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.13.0; `10-Statistics/00-Overview.md` §3 lists Ace under `intent-derived`. The Track card's tile row and targets card are shared components (`StatTileRow.astro`, `TrackTargetsCard.astro`). Fives stays heatmap-only; Bull 500 waits for its V1.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-17
