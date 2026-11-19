---
id: D0561
status: accepted
date: 2026-11-17
origin: contemporaneous
original-date:
tags: [api, endpoint, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Doubles Training renders a dedicated statistics layout over the page Period

## Context and Problem Statement
the owner asked for double accuracy per number, a favourite double, loose darts, left/right and inside/outside misses, and for the Period select to govern every statistics page. All three sections already return per-target data, so the page needs no new endpoint, section or migration.

## Decision Drivers
* The owner wants a page that answers which doubles they hit, which is best, where they miss and how close the misses are (spec, Intent).
* The Period select governs the card, and the same approach applies to every statistics page (spec, Goals).
* No second copy of the sector, band or near-miss logic: the card only sums and joins what the three sections return (spec, Anti-goals).
* A rate is not shown from too few darts (spec, Anti-goals).

## Considered Options
* A dedicated layout that joins `target-accuracy`, `miss-direction` and `loose-darts` by target key (chosen).
* The heatmap-only layout, `HeatmapStatsOverview.astro`, which `DOUBLES_TRAINING_V1` renders today.

## Decision Outcome
Chosen option: "`DOUBLES_TRAINING_V1` leaves `HEATMAP_ONLY_LAYOUTS` for its own `DOUBLES_TRAINING_LAYOUTS` and renders `DoublesTrainingStatsOverview.astro`: the completion tile, one DOUBLES card, the heatmap and the session list. The card joins `target-accuracy`, `miss-direction` and `loose-darts` by target key over the page Period select (every statistics page follows that select). Rows are the 20 `DOUBLE:n` keys plus the double bull `INNER_BULL:25`, only those with darts. Per row: hit rate (shown from 10 darts, `MIN_ROW_SAMPLE`), misses left (sectors 5-7), right (1-3), high (0) and low (4), misses inside, within and outside the wire, and near-miss against loose darts (D560). The headline is the favourite double: the highest hit rate among rows of at least 30 darts (`MIN_TARGET_SAMPLE`), ties to more darts, then the lower number.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.11.0. The training-result headline, session-result, volume and confusion cards are not on this page. A `loose-darts` read refused for a range over `MAX_LANDING_DARTS` errors the whole card.

* Neutral, because a row under 10 darts shows its count only. With no qualifying row the favourite double reads "not enough darts yet" (spec, Card rules).
* Neutral, because the bull row is the double bull, `INNER_BULL:25`, labelled "Bull". The outer bull is not a Doubles Training target (spec, Marked as the author's calls).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec Constraints require a test per changed runtime `.ts` file. `tests/lib/stats/doubles/doubles-training-card.test.ts`, `doubles-training-lines.test.ts` and `doubles-training-fetch.test.ts` exist today.

## Pros and Cons of the Options
### A dedicated layout over existing sections
* Good, because every number derives at read time from existing sections, with no migration, endpoint or section id (spec, Goals).
* Bad, because the `mi_average` floor sits about 0.003 under the current value, so new `lib/stats/` files may trip the quality ratchet (spec, Constraints).

### The heatmap-only layout
* Bad, because it does not answer the owner's per-double questions (spec, Intent).


## Evidence / More Information
Decided: 2026-11-17

* `docs/superpowers/specs/2026-11-17-doubles-training-statistics-page-design.md` (Intent, Goals, Anti-goals, Card rules, Constraints, author's calls; cites D560, not D561): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* `docs/superpowers/plans/2026-11-17-doubles-training-statistics-page.md` (the decision step; lists what the decision block records): rebuilt no section.
* Commit `e3eb2963` (2026-11-17, "docs(stats): Doubles Training statistics page"; adds the D561 row): source of the Context and Decision Outcome text.
* Applied in: `docs/superpowers/specs/2026-11-17-track-games-statistics-page-design.md`, `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md`, `docs/superpowers/plans/2026-11-17-ace-statistics-page.md`.
