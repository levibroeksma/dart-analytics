---
id: D0191
status: accepted
date: 2026-08-05
origin: contemporaneous
original-date:
tags: [architecture, dart]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A single is two stored bands, not one zone

## Context and Problem Statement
"Missed high/low/left/right of T20" is unanswerable without knowing which side of the treble ring a dart landed on, and `zoneCentroid` could not answer for `SINGLE` at all — it had no single centre to name across two disjoint bands. Storing the band as two zone rows (rather than deriving it ad hoc at query time) keeps the fact log the single source of truth for what happened, per D01.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`dart_zones` gains two rows, `INNER_SINGLE` (id 7, 15.9–97mm) and `OUTER_SINGLE` (id 8, 107–162mm), on top of D06's original six. Coordinate capture (`classify(x, y)`) always resolves a single to one of these two bands and never returns the bare `SINGLE` value. `SINGLE` is retained, not removed: keypad capture has no coordinate and genuinely cannot know which band was hit, so it keeps recording the unbanded value rather than fabricating a band.".

### Consequences
`zoneCentroid` now answers for `INNER_SINGLE` and `OUTER_SINGLE` (their band midpoints) and still returns `null` for bare `SINGLE`. Any engine that keys scoring logic on the literal `"SINGLE"` string (e.g. Singles Training) must also match `INNER_SINGLE`/`OUTER_SINGLE`, or a visual-capture dart in either band silently scores zero. `dart_zones` ids 1–6 are unchanged and still referenced by live `darts.hit_zone_id` values; 7 and 8 are additive only. (Renumbered from a draft `D187` during the rebase onto main, which had already issued `D187` for the Alpine closure rule via PR #72.)

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-05
