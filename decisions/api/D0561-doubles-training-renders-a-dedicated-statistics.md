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
<!-- backfill: pending -->

# Doubles Training renders a dedicated statistics layout over the page Period

## Context and Problem Statement
the owner asked for double accuracy per number, a favourite double, loose darts, left/right and inside/outside misses, and for the Period select to govern every statistics page. All three sections already return per-target data, so the page needs no new endpoint, section or migration.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DOUBLES_TRAINING_V1` leaves `HEATMAP_ONLY_LAYOUTS` for its own `DOUBLES_TRAINING_LAYOUTS` and renders `DoublesTrainingStatsOverview.astro`: the completion tile, one DOUBLES card, the heatmap and the session list. The card joins `target-accuracy`, `miss-direction` and `loose-darts` by target key over the page Period select (every statistics page follows that select). Rows are the 20 `DOUBLE:n` keys plus the double bull `INNER_BULL:25`, only those with darts. Per row: hit rate (shown from 10 darts, `MIN_ROW_SAMPLE`), misses left (sectors 5-7), right (1-3), high (0) and low (4), misses inside, within and outside the wire, and near-miss against loose darts (D560). The headline is the favourite double: the highest hit rate among rows of at least 30 darts (`MIN_TARGET_SAMPLE`), ties to more darts, then the lower number.".

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.11.0. The training-result headline, session-result, volume and confusion cards are not on this page. A `loose-darts` read refused for a range over `MAX_LANDING_DARTS` errors the whole card.

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
