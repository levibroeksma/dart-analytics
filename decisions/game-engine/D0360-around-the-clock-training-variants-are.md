---
id: D0360
status: accepted
date: 2026-09-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Around the Clock training variants are a V2 ruleset served by the V1 engine class

## Context and Problem Statement
V1's empty `.strict()` schema is live against real sessions, so the variants cannot widen it (D243/D245/D247). Keeping one engine class avoids a second fold that would drift from V1's rota and completion rules. Keypad capture records an unbanded `SINGLE`, so outer single only needs board positions.

## Decision Drivers
* V1's empty `.strict()` schema is shipped, so a V2 must not widen it in place (D243/D245/D247).
* V1 must stay byte-identical: the engine reads V1-equivalent defaults for a snapshot without V2 fields.
* Keypad capture records an unbanded `SINGLE`, so `OUTER_SINGLE` is valid only under ANALYTICS + VISUAL_BOARD.

## Considered Options
* Widen V1's `AroundTheClockConfig` in place.
* Write a second engine class for V2.
* Add `AROUND_THE_CLOCK_V2` as a new ruleset version served by the V1 engine class (chosen).

## Decision Outcome
Chosen option: "`AROUND_THE_CLOCK_V2` (seed `0027`) adds path direction, odds first, outer single only, Easy/1/2/3-dart difficulty with a one-target step back (floored at the first target), and an untimed or 3–30 minute timed run whose bull hit restarts the lap and closes the visit. One `AroundTheClockEngine` serves both keys: `rulesOf(config)` resolves a snapshot without `pathDirection` to V1's fixed rules, so V1 folds unchanged. Timed completion enters only through `expireTimer()`; a seat is complete once its open visit closes after expiry. Outer single only is refused outside ANALYTICS + VISUAL_BOARD by the V2 validator. A seated DartBot resolves setup to V1; seating a guest forces untimed.".

### Consequences
a DartBot strategy for V2 or a timed 1v1 is a later change, not a config toggle. The timed run is the hook PR2 uses to make V2 routine-eligible. Rules: `docs/game-rules/rulesets/around-the-clock.md`.
* Neutral, because delivery splits into 2 PRs: the standalone V2 first, then routine-step eligibility.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/around-the-clock.engine.module.test.ts` and `app/tests/modules/game/around-the-clock.golden.test.ts` check the engine, which serves both keys.

## Pros and Cons of the Options
### Widen V1's config in place
* Bad, because it breaks D243/D245/D247 (never widen a shipped version in place).

### Second engine class for V2
* Bad, because a second fold would drift from V1's rota and completion rules.

### New ruleset version on the V1 engine class
* Good, because V1 snapshots fold unchanged.

## Evidence / More Information
Decided: 2026-09-23

* `docs/superpowers/specs/2026-09-23-around-the-clock-v2-training-design.md` (§ 1, § 2, § 3, § 4, § 11, § 12): rebuilt Decision Drivers, Considered Options, Pros and Cons and Consequences.
* Commit `a3d2fcbb` (2026-09-23; adds the D360 row): confirmed Confirmation against the tests it adds.
* Applied in: `docs/superpowers/plans/2026-10-19-switching-merge.md`, `docs/superpowers/plans/2026-10-15-training-tags.md`.
