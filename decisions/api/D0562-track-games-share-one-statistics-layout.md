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

# Track games share one statistics layout over the page Period

## Context and Problem Statement
the owner asked for per-target hit rate and the targets failed most on the games that walk a target path, matching the Doubles Training page. One page per rule-kernel family keeps four games on one set of cards; the sections already return per-target data for all four.

## Decision Drivers
* The owner wants one shared page for the four target-path games: hit rate per target and the targets that fail most (spec, Intent).
* Games in one rule-kernel family share one page, and the other families follow as separate projects (spec, Intent).
* No second copy of the sector, band or near-miss logic, and no second copy of the Doubles join (spec, Anti-goals).
* A rate is not shown from too few darts, and a tie never reorders between renders (spec, Anti-goals).

## Considered Options
* One shared layout for the four games with a per-game key set (chosen).
* A page per game.
* The heatmap-only layout, which the four games render today.

## Decision Outcome
Chosen option: "`SINGLES_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1` and `BOBS27_V1` leave `HEATMAP_ONLY_LAYOUTS` for `TRACK_LAYOUTS` and render `TrackGamesStatsOverview.astro`: the completion tile, three tiles (best target, most failed target, weakest three), a targets table with a sort toggle (target order or hit rate lowest first), the heatmap and the session list. The table reuses the Doubles Training derivation (D561) over a per-game key set, `trackRowKeys` (the picker keys of `heatmap-targets.ts`, plus `OUTER_SINGLE:n` for Around the Clock's outer-single segment rule, which reads as its own row "n outer"). The tiles consider rows of at least 30 darts (`MIN_TARGET_SAMPLE`): best is the highest hit rate, most failed the lowest, weakest three the three lowest; ties go to more darts, then the lower number. The sort changes the table only. Baseball stays on the heatmap layout: it has no per-target sections.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.12.0. The Doubles derivation takes an optional key set, so its page is unchanged. `training-result`, `confusion`, `grouping` and the game-specific cards (`bobs27-survival`, `shanghai-count`, `atc-darts-per-target`) are not on this page.

* Neutral, because a row under 10 darts shows its count only. With no qualifying row each tile reads "Not enough darts yet" (spec, Card rules).
* Neutral, because Baseball stays on the heatmap layout: it has no target picker and no per-target sections (spec, Non-goals).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec Constraints require a test per changed runtime `.ts` file. `tests/lib/stats/track/track-games-keys.test.ts`, `track-games-card.test.ts` and `track-games-lines.test.ts` exist today.

## Pros and Cons of the Options
### One shared layout with a per-game key set
* Good, because every number derives at read time from existing sections, with no migration, endpoint or section id (spec, Goals).
* Good, because the Doubles derivation generalises behind a key set instead of being copied, which follows D513 (spec, Constraints).
* Bad, because new `lib/stats/` files may trip the `mi_average` floor of 91.0, so the spec prefers extending the existing doubles modules (spec, Constraints).

### A page per game
Rationale unknown — no source found.

### The heatmap-only layout
* Bad, because it does not show a hit rate per target (spec, Intent).

## Evidence / More Information
Decided: 2026-11-17

* `docs/superpowers/specs/2026-11-17-track-games-statistics-page-design.md` (Intent, Goals, Anti-goals, Card rules, Constraints, author's calls; cites D561, not D562): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* `docs/superpowers/plans/2026-11-17-track-games-statistics-page.md` (the decision step; lists what the decision block records): rebuilt no section.
* Commit `4a88af67` (PR #1344, 2026-11-17; adds the D562 row): source of the Context and Decision Outcome text.
* Applied in: `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md`.
