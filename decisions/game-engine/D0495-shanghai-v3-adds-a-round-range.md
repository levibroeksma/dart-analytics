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

# Shanghai V3 adds a round range and Score-only as a new ruleset version

## Context and Problem Statement
the shipped range and instant win were fixed, so a shorter or later slice and a scoring-only mode were schema changes; a new version keeps V1/V2 sessions folding unchanged (D245). Carrying the settings on the seat spares the replay presenter, derived aims and stats from threading config.

## Decision Drivers
* V1 and V2 fix the range at 1–20 and always end the match on a Shanghai; a shorter or later slice of the board and a scoring-only mode need a setting that V1/V2 lack (spec § 1).
* V1 and V2 behaviour must stay untouched, so no shipped rule changes (spec § 2, § 11).

## Considered Options
* `SHANGHAI_V3` as a new ruleset version beside V1 and V2 (spec § 1).
* Keep V1 and V2 as shipped, with the range fixed at 1–20 and the instant win always on (spec § 1).

## Decision Outcome
Chosen option: "`SHANGHAI_V3` is a new ruleset version beside the untouched V1 and V2. Its config is `{ difficulty, range_start, range_end, instant_win }` (wire snake_case, snapshot camelCase), refined so `range_start <= range_end`; the five presets (1–7, 1–10, 1–20, 11–20, 13–20) live in the setup form, not the schema. `ShanghaiSeatState` carries `rangeStart`, `rangeEnd` and `instantWin`, and `activeNumberOf`, `roundOf` and `roundCountOf` in `shanghai.engine.module.ts` are the one home of the range math. With `instant_win` off the Shanghai win policy is not applied, so a seat plays the whole range and the highest total wins (equal totals tie).".

### Consequences
no migration; seed `0053` adds the `ruleset_versions` row and two capability rows go in `0007`. V1/V2 golden snapshots gain exactly the three seat fields. `shanghai-count` keys a Shanghai by the number it landed on (the round on 1–20) and skips Score-only sessions. Play Again keeps the variant through `variantsPlayAgain`. Free start/end and match structure stay `V2+` in `docs/game-rules/rulesets/shanghai.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
* Score-only players lose the "Shanghai" moment; spec § 11 says "Revisit with a result stat if wanted".

### Confirmation
`app/tests/modules/game/shanghai.golden.test.ts` holds golden snapshots; the spec plans a differential test that folds V1 and V2 goldens byte-identically after the `settingsOf` refactor (spec § 9.4).

## Pros and Cons of the Options
### `SHANGHAI_V3` as a new ruleset version
* Good, because the `settingsOf` defaults keep V1 and V2 folding unchanged (spec § 11).
* Good, because seat-carried settings remove config threading from the replay presenter, derived aims, the stats section and the play screen (spec § 6).

## Evidence / More Information
Decided: 2026-10-25

* `docs/superpowers/specs/2026-10-25-shanghai-v3-design.md` (§ 1, § 2, § 6, § 9, § 11): rebuilt Decision Drivers, Considered Options, Confirmation, Revisit When and Pros and Cons.
* Commit `188e8d74` (2026-10-25): adds the D495 row.
