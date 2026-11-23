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

# Track exercises bind through trackExerciseSpec; one seed per engine PR

## Context and Problem Statement
the third Track exercise reopened the Track spec §3 deferral: Hit Count, SwitchBlade and Doubles Lock differ only in rules and projection, so binding each by hand would repeat the seat setup, fold and visit rule three times. A seed per PR keeps every merged PR a playable type.

## Decision Drivers
* Hit Count, SwitchBlade and Doubles Lock differ only in rules and projection, so hand-binding each would repeat the seat setup, fold and visit rule (spec § 1, record Context).
* Each merged PR should ship a playable type, so each engine PR carries its own seed (spec § 1).

## Considered Options
* Land a `trackExerciseSpec` helper in T1.1 and seed one file per engine PR (chosen).
* Bind each exercise by hand, as Target Scoring does; the spec does not retrofit it in this wave.
* One seed file per wave (the parent spec § 8 wording, refined by the wave spec).

## Decision Outcome
Chosen option: "a Track-family exercise is a `TrackExerciseDefinition` (key, parse, rules, initial ext, projection, intent) turned into a `DartExerciseSpec` by `modules/training/exercises/track-exercise-spec.module.ts`'s `trackExerciseSpec`, which folds the solo seat through `foldTrackDarts` and closes visits at three darts. `scripts/check-engine-kernels.sh` accepts `./<kernel>-exercise-spec.module` as a KERNEL_BOUND import. `BoardTarget` gains `TREBLE`. Track waves seed one file per engine PR. Hit Count is the first caller.".

### Consequences
Target Scoring and Switching Target Scoring still bind by hand until issue #993. SwitchBlade and Doubles Lock (T1.2, T1.3) use the helper. Spec: `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md`; plan: `docs/superpowers/plans/2026-10-17-track-t1-hit-count.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/track-exercise-spec.module.test.ts` covers the helper. `scripts/check-engine-kernels.sh` accepts `./<kernel>-exercise-spec.module` as a KERNEL_BOUND import.

## Pros and Cons of the Options
### `trackExerciseSpec` helper, one seed per engine PR
* Good, because the three exercises share the seat setup, fold and visit rule once.
* Good, because every merged PR is a playable type.

### Bind each exercise by hand
* Bad, because the seat setup, fold and visit rule repeat three times (spec § 1).

## Evidence / More Information
Decided: 2026-10-17

* `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (§ 1, 2.1): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `4fb44d4e` (2026-10-18, adds the D469 row): the decision row with the routines, stats catalog and inventories.
* Applied in: `docs/superpowers/plans/2026-10-17-track-t1-hit-count.md`, `docs/superpowers/plans/2026-10-17-track-kernel-pr2-bobs27.md`, `docs/superpowers/plans/2026-10-17-track-kernel-pr3-singles.md`, `docs/superpowers/plans/2026-10-18-track-t1-switchblade.md`, `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md`.
