---
id: D0562
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

# Track games share one statistics layout over the page Period

## Context and Problem Statement
the owner asked for per-target hit rate and the targets failed most on the games that walk a target path, matching the Doubles Training page. One page per rule-kernel family keeps four games on one set of cards; the sections already return per-target data for all four.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SINGLES_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1` and `BOBS27_V1` leave `HEATMAP_ONLY_LAYOUTS` for `TRACK_LAYOUTS` and render `TrackGamesStatsOverview.astro`: the completion tile, three tiles (best target, most failed target, weakest three), a targets table with a sort toggle (target order or hit rate lowest first), the heatmap and the session list. The table reuses the Doubles Training derivation (D561) over a per-game key set, `trackRowKeys` (the picker keys of `heatmap-targets.ts`, plus `OUTER_SINGLE:n` for Around the Clock's outer-single segment rule, which reads as its own row "n outer"). The tiles consider rows of at least 30 darts (`MIN_TARGET_SAMPLE`): best is the highest hit rate, most failed the lowest, weakest three the three lowest; ties go to more darts, then the lower number. The sort changes the table only. Baseball stays on the heatmap layout: it has no per-target sections.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.12.0. The Doubles derivation takes an optional key set, so its page is unchanged. `training-result`, `confusion`, `grouping` and the game-specific cards (`bobs27-survival`, `shanghai-count`, `atc-darts-per-target`) are not on this page.

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
