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

# A single is two stored bands, not one zone

## Context and Problem Statement
"Missed high/low/left/right of T20" is unanswerable without knowing which side of the treble ring a dart landed on, and `zoneCentroid` could not answer for `SINGLE` at all — it had no single centre to name across two disjoint bands. Storing the band as two zone rows (rather than deriving it ad hoc at query time) keeps the fact log the single source of truth for what happened, per D01.

## Decision Drivers
* "Missed high/low/left/right of T20" cannot be answered without knowing which side of the treble ring a dart landed on.
* `zoneCentroid` has no single centre to name for `SINGLE`, which spans two disjoint bands.
* The fact log stays the single source of truth for what happened (D01), so the band is stored rather than derived at query time.
* Keypad capture has no coordinate and cannot know the band.

## Considered Options
* Keep one `SINGLE` zone, which leaves the miss vector against a single target uncomputable.
* Derive the band ad hoc at query time, which the source rejects in favour of storing it.
* Store two band rows, `INNER_SINGLE` and `OUTER_SINGLE`, and retain bare `SINGLE` for keypad capture.

## Decision Outcome
Chosen option: "`dart_zones` gains two rows, `INNER_SINGLE` (id 7, 15.9–97mm) and `OUTER_SINGLE` (id 8, 107–162mm), on top of D06's original six. Coordinate capture (`classify(x, y)`) always resolves a single to one of these two bands and never returns the bare `SINGLE` value. `SINGLE` is retained, not removed: keypad capture has no coordinate and genuinely cannot know which band was hit, so it keeps recording the unbanded value rather than fabricating a band.".

### Consequences
`zoneCentroid` now answers for `INNER_SINGLE` and `OUTER_SINGLE` (their band midpoints) and still returns `null` for bare `SINGLE`. Any engine that keys scoring logic on the literal `"SINGLE"` string (e.g. Singles Training) must also match `INNER_SINGLE`/`OUTER_SINGLE`, or a visual-capture dart in either band silently scores zero. `dart_zones` ids 1–6 are unchanged and still referenced by live `darts.hit_zone_id` values; 7 and 8 are additive only. (Renumbered from a draft `D187` during the rebase onto main, which had already issued `D187` for the Alpine closure rule via PR #72.)

* Good, because a miss vector against a single target becomes computable: `zoneCentroid` answers for both bands.
* Bad, because any engine that keys scoring logic on the literal `"SINGLE"` must also match the two band values, or a visual-capture dart in either band silently scores zero.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep one `SINGLE` zone
* Bad, because "missed high/low/left/right of T20" is unanswerable without the band, and `zoneCentroid` cannot answer for `SINGLE`.

### Derive the band at query time
* Bad, because the fact log stays the single source of truth for what happened only if the band is stored, per D01.

### Two stored bands, bare `SINGLE` retained
* Good, because the band is a stored fact and `zoneCentroid` answers for each band.
* Good, because keypad capture keeps recording the unbanded value instead of fabricating a band.
* Bad, because engines that match the literal `"SINGLE"` must also match the two bands.

## Evidence / More Information
Decided: 2026-08-05

* Commit `ba175815` (PR #73, 2026-08-08; adds D191 to `decisions/architecture.md`): source of Context and Consequences; rebuilt Decision Drivers.
* `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md` (Task 11b note, "Added 2026-08-05 by owner decision, mid-execution"): rebuilt Considered Options. The note names seed `database/seeds/0006_single_band_dart_zones.sql`, which exists today.
