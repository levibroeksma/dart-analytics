---
id: D0495
status: accepted
date: 2026-10-25
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Shanghai V3 adds a round range and Score-only as a new ruleset version

## Context and Problem Statement
the shipped range and instant win were fixed, so a shorter or later slice and a scoring-only mode were schema changes; a new version keeps V1/V2 sessions folding unchanged (D245). Carrying the settings on the seat spares the replay presenter, derived aims and stats from threading config.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SHANGHAI_V3` is a new ruleset version beside the untouched V1 and V2. Its config is `{ difficulty, range_start, range_end, instant_win }` (wire snake_case, snapshot camelCase), refined so `range_start <= range_end`; the five presets (1–7, 1–10, 1–20, 11–20, 13–20) live in the setup form, not the schema. `ShanghaiSeatState` carries `rangeStart`, `rangeEnd` and `instantWin`, and `activeNumberOf`, `roundOf` and `roundCountOf` in `shanghai.engine.module.ts` are the one home of the range math. With `instant_win` off the Shanghai win policy is not applied, so a seat plays the whole range and the highest total wins (equal totals tie).".

### Consequences
no migration; seed `0053` adds the `ruleset_versions` row and two capability rows go in `0007`. V1/V2 golden snapshots gain exactly the three seat fields. `shanghai-count` keys a Shanghai by the number it landed on (the round on 1–20) and skips Score-only sessions. Play Again keeps the variant through `variantsPlayAgain`. Free start/end and match structure stay `V2+` in `docs/game-rules/rulesets/shanghai.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-25
