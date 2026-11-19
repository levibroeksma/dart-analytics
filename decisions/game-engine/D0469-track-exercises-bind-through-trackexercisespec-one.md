---
id: D0469
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Track exercises bind through trackExerciseSpec; one seed per engine PR

## Context and Problem Statement
the third Track exercise reopened the Track spec §3 deferral: Hit Count, SwitchBlade and Doubles Lock differ only in rules and projection, so binding each by hand would repeat the seat setup, fold and visit rule three times. A seed per PR keeps every merged PR a playable type.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a Track-family exercise is a `TrackExerciseDefinition` (key, parse, rules, initial ext, projection, intent) turned into a `DartExerciseSpec` by `modules/training/exercises/track-exercise-spec.module.ts`'s `trackExerciseSpec`, which folds the solo seat through `foldTrackDarts` and closes visits at three darts. `scripts/check-engine-kernels.sh` accepts `./<kernel>-exercise-spec.module` as a KERNEL_BOUND import. `BoardTarget` gains `TREBLE`. Track waves seed one file per engine PR. Hit Count is the first caller.".

### Consequences
Target Scoring and Switching Target Scoring still bind by hand until issue #993. SwitchBlade and Doubles Lock (T1.2, T1.3) use the helper. Spec: `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md`; plan: `docs/superpowers/plans/2026-10-17-track-t1-hit-count.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-17
