---
id: D0515
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Mickey Mouse V1 is its own ruleset on the Marks kernel; the kernel gains `dipOf`

## Context and Problem Statement
the double-dip needs two marks from one dart, which `MarksHit` could not express; the kernel rule M4 lands a feature with its first caller. The rules doc left the closed-number and Tactics-variant questions open; the plan's calls C1–C6 settle them.

## Decision Drivers
* Marks kernel rule M4: a kernel feature lands with its first caller (plan header, citing `docs/superpowers/specs/2026-10-28-marks-kernel-design.md`).
* A dart "can count toward more than one category simultaneously" in the rules source (plan C1).
* Cricket and Tactics set no `dipOf`, so their goldens stay unchanged (plan, test 6).

## Considered Options
* Mickey Mouse as its own ruleset `MICKEY_MOUSE_V1` (chosen).
* Mickey Mouse as a Tactics variant: plan C6 rejects it, because the objective set, the double-dip and the absence of points differ.

## Decision Outcome
Chosen option: "`MICKEY_MOUSE_V1` is a one-seat Marks game with twelve objectives (20…12, Doubles, Triples, Bull) and no points. `MarksRules.dipOf?(seat, observation)` returns a second `MarksHit` a dart earns on another objective; `tallyMarksDart`/`applyMarksDart` take it as an optional `dip`, applied after the primary hit under the same cap, with `spare` and treble tallies from the primary hit only. A double or treble on a number already closed still marks Doubles or Triples; on 1–11 it marks only the category. Overflow marks are dropped. Mickey Mouse is not a Tactics variant.".

### Consequences
Cricket and Tactics set no `dipOf` and their goldens do not change. Scored Mickey Mouse (V2+) revisits the duel path when a scoring dip is written. Plan: `docs/superpowers/plans/2026-10-30-mickey-mouse-v1.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
* Scored Mickey Mouse (V2+): plan C5 says the duel path is revisited when the rules for a scoring dip are written.

### Confirmation
`app/tests/modules/game/marks-kernel.module.test.ts` covers `dipOf` and rules without it; `app/tests/modules/game/mickey-mouse.engine.module.test.ts` covers the engine.

## Pros and Cons of the Options
### Its own ruleset (`MICKEY_MOUSE_V1`)
* Good, because the objective set, the double-dip and the absence of points differ from Tactics (plan C6).

## Evidence / More Information
Decided: 2026-10-30

* `docs/superpowers/plans/2026-10-30-mickey-mouse-v1.md` (header, C1–C6, test list): rebuilt Decision Drivers, Considered Options, Revisit When, Confirmation and Pros and Cons.
* Commit `8b102ebd` (PR #1190): adds the D515 row.
