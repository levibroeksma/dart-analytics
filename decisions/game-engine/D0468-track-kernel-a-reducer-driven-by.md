---
id: D0468
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Track kernel: a reducer driven by a record of policy functions

## Context and Problem Statement
a pure-data enum config would force each shipped engine's special cases (Shanghai's instant win, Target Scoring's chain) into one generic switch past fallow's complexity limit; policies keep each special case local to the one ruleset that has it, and the projection lets the oracle compare old and new engines on identical state.

## Decision Drivers
* A pure-data enum config would force each shipped engine's special cases into one generic switch past fallow's complexity limit (spec § 3 requires the reducer to keep cognitive complexity at 15 or below).
* The projection lets the oracle compare old and new engines on identical state.

## Considered Options
* A pure-data enum config for the Track family.
* A `TrackRules` record of named policy functions, built per read from the configuration snapshot (chosen).

## Decision Outcome
Chosen option: "`modules/game/track-kernel.module.ts` holds the Track family's only reducer, `applyTrackDart` (judge → points → `onDart` → visit close → `onVisitClose`), and `foldTrackSeats`; a ruleset is a `TrackRules<TExt>` record of named policies (`track-policies.ts`) built per read from its configuration snapshot, with game-owned extras in `TrackSeat.ext`. A migrated engine keeps its exported reducer, fold and `state()` shape by projecting `TrackSeat` to its legacy seat state. Doubles Training is the first bound engine. Match outcome stays in each fold until a second engine shares it; the umbrella `RuleKernel` interface waits for a second family.".

### Consequences
PRs 2–7 of `docs/superpowers/specs/2026-10-17-track-kernel-design.md` add policies with their first caller and flip their `scripts/engine-kernels.txt` row. Spec: that file; plan: `docs/superpowers/plans/2026-10-17-track-kernel.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-engine-kernels.sh` checks every row of `scripts/engine-kernels.txt` against the engine's imports and its rules file `Kernel:` header. `app/tests/modules/game/track-kernel.module.test.ts` and `app/tests/modules/game/doubles-training.golden.test.ts` cover the kernel and its first bound engine.

## Pros and Cons of the Options
### Pure-data enum config
* Bad, because special cases such as Shanghai's instant win and Target Scoring's chain would collapse into one generic switch.

### Record of named policy functions
* Good, because each special case stays local to the one ruleset that has it.
* Good, because the reducer branches live in policies, keeping its cognitive complexity within the limit.

## Evidence / More Information
Decided: 2026-10-17

* `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§ 1 T1–T3, § 3, § 7, § 9): rebuilt Decision Drivers, Considered Options, Pros and Cons, Confirmation.
* `docs/superpowers/plans/2026-10-17-track-kernel.md`: named by the record as the plan; no section rebuilt.
* Commit `5d8834ab` (PR #984, 2026-10-17): the adding commit.
* Applied in: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`, `docs/superpowers/plans/2026-10-22-track-t2-nine-lives.md`.
