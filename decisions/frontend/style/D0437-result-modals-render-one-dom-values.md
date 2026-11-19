---
id: D0437
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [frontend/style, token, colour]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Result modals render one DOM; values pulse in place while saving

## Context and Problem Statement
the old parallel loaded/skeleton blocks had different layouts, and "Saved" appeared from nothing, so the sheet jumped when the save finished; one DOM with values swapped in place keeps the height and label positions the same.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every results sheet (12 game modals + routine summary) follows Claude Design `Result Modals.dc.html` and renders one DOM in both the saving and saved states. Each dynamic value goes through `ResultValue`: the value's own line box holds either the text (once `completionStatus === 'succeeded'`) or a one-line pulse bar of a fixed width. Labels, tiles, grids, titles and overlines are static. `SaveStatus` is a fixed-height row in `ResultsModalShell` and `RoutineSummaryModal`: pulsing `SAVING…` (`text-error`) until saved, then `SAVED` (`text-success`); a failed save shows error + Retry instead. `showSavedMessage` is removed; the play-again button reads `Rematch`. Solo summaries use a hero value beside bordered side stats, then an optional tile grid (`heroSize`, `tileCols`). Cricket and Tactics get real modals: Darts used, Marks / round, Trebles (Cricket) or Bulls (Tactics), and a `TargetGrid` of darts to close per objective. Spec: `docs/superpowers/specs/2026-10-09-result-modal-skeletons-design.md`.".

### Consequences
new `skeleton` colour token (white 12%) for the pulse bar; `StatRowComparisonSkeleton.astro` is deleted; `StatTile` needs `valueExpr` and pulses only with `skeletonWidth`. `CricketSeatResult`/`TacticsSeatResult` gain `trebles`/`bulls` and `dartsToClose: (number | null)[]` (was a joined string); the tallies come from `objectiveHits`/`trebleHits` in the shared marks seat state, are derived from dart facts during the fold and never stored, and count hits even after the target closed. 2-seat comparison views reuse the relabelled solo rows. `.astro` carries no unit test (D101); the seat-result and fold tallies are tested.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-09
