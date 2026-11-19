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
<!-- backfill: pending -->

# Around the Clock training variants are a V2 ruleset served by the V1 engine class

## Context and Problem Statement
V1's empty `.strict()` schema is live against real sessions, so the variants cannot widen it (D243/D245/D247). Keeping one engine class avoids a second fold that would drift from V1's rota and completion rules. Keypad capture records an unbanded `SINGLE`, so outer single only needs board positions.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`AROUND_THE_CLOCK_V2` (seed `0027`) adds path direction, odds first, outer single only, Easy/1/2/3-dart difficulty with a one-target step back (floored at the first target), and an untimed or 3–30 minute timed run whose bull hit restarts the lap and closes the visit. One `AroundTheClockEngine` serves both keys: `rulesOf(config)` resolves a snapshot without `pathDirection` to V1's fixed rules, so V1 folds unchanged. Timed completion enters only through `expireTimer()`; a seat is complete once its open visit closes after expiry. Outer single only is refused outside ANALYTICS + VISUAL_BOARD by the V2 validator. A seated DartBot resolves setup to V1; seating a guest forces untimed.".

### Consequences
a DartBot strategy for V2 or a timed 1v1 is a later change, not a config toggle. The timed run is the hook PR2 uses to make V2 routine-eligible. Rules: `docs/game-rules/rulesets/around-the-clock.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-23
