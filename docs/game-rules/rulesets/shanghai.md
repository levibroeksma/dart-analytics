# Shanghai

Current version: V2 (shipped 2026-08-28)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Rounds 1–7 | V2+ | All | Wanted, unscheduled: the shipped range is fixed at 1–20 (`ShanghaiConfig` is an empty `.strict()` object; seed `0008`), so a shorter range is a schema change |
| Rounds 1–20 | V1 | All | |
| Other round ranges | V2+ | All | Wanted, unscheduled: same fixed-range gap as Rounds 1–7 |
| Only active number scores | Dropped | All | Not a separate feature: only the Active number has ever scored — it is the V1 rule (see Progress / scoring), not an option that could be turned off |
| Active number: single / double / treble count | V1 | All | |
| Shanghai instant win (S+D+T in one visit) | V1 | All | |
| Highest total wins if no Shanghai | V1 | All | |
| Disable instant-win (score only) | V2+ | All | Wanted, unscheduled: no config key expresses it — `ShanghaiV2Config` carries `difficulty` and nothing else |
| Visit = 3 darts per round | V1 | All | |
| Track per-round score | V1 | All | |
| Target Needed difficulty (Normal/Hard) | V2 | All | Shipped as `ShanghaiV2Config.difficulty`: V1 scoring left a round with no target hit indistinguishable from a cautious one, so there was nothing to punish aimless rounds |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

Round-by-round target game: each round has one **active number** (1, then 2, then 3, …). Score only on that number; chase the high total — or win instantly with a **Shanghai** (single, double, and treble of the active number in one three-dart visit). Standard dartboard scoring is assumed. (Empty source file — rules filled from common Shanghai practice.)

## Objective

- **Round:** with three darts, score as much as possible on the active number only.
- **Session (V1):** complete the round range (fixed at **1–20**). Highest cumulative score wins, unless someone hits a **Shanghai** for an instant win.
- **1v1:** a Shanghai ends the match immediately for whoever hits it; otherwise both seats play all 20 rounds and the higher score wins (ties possible). <!-- 2026-08-22 -->

## Config & presets

Before play, a **config screen** shows the session presets.

| Setting              | V1 preset                              | On config screen (V1) |
| -------------------- | -------------------------------------- | --------------------- |
| Players              | 1 seat, or 2 (guest or DartBot)        | Editable              |
| Rounds               | **1–20**                               | Shown, locked         |
| Shanghai instant win | On                                     | Shown, locked         |
| Scoring              | Only active number (S/D/T face values) | Shown, locked         |

## How to play

### Visit

Each round, the player throws **three darts** at the **active number** for that round (round 1 → number 1, round 2 → number 2, …).

### Progress / scoring

Only darts in the active number’s single, double, or treble score:

- Single → face value
- Double → 2× face value
- Treble → 3× face value

Anything else (wrong number, bull, miss) scores **0** for that dart. Add the visit total to the running score, then advance to the next number.

### Shanghai (instant win)

If one visit contains the **single, double, and treble** of the active number (**any order**), that is a **Shanghai** — the player **wins immediately**, regardless of totals.

### Finishing

If no Shanghai occurs, after the last round the **highest total** wins (solo: personal best / complete the run).

### Bust

N/A.

### Ends when

The last round of the range is played out — round 20, the range being fixed at
1–20 — or a **Shanghai** lands, which ends it immediately. Nothing else bounds a
session: no clock, no visit budget.

**Single:** the one seat plays all 20 rounds, or ends early on a Shanghai.

**1v1:** a Shanghai ends the match immediately for whoever hits it, and the
other seat gets no further rounds. Otherwise both seats play all 20 rounds and
the higher total wins; equal totals is a tie, with no tiebreak. A DartBot seat
counts as the opponent seat.

### Result

The total score, the per-round scores, and whether the session ended on a
Shanghai. In 1v1, the winning seat beside both seats' totals, or a tie.

## Later versions

### Target Needed

A difficulty toggle, **Normal** (default) or **Hard**:

- **Normal:** identical to V1 — only hits on the round's own number score; anything else scores 0 for that dart.
- **Hard:** a round must land at least one dart in the round's own single, double, or treble. A round with zero target hits halves the player's running total score (round-half-up) instead of merely adding 0. A round with at least one target hit is never penalized, whatever it scores.

Available under both Recreational and Analytical capture modes, same as V1.

### Variants

- Round ranges: **1–20**, custom start/end
- **Score-only** mode (no instant-win Shanghai)
- Multiplayer: all players take each round; first Shanghai in throwing order wins that path; else highest total

### Match structure

- First to N Shanghai wins; best of N full boards

## Glossary

| Term              | Version | Meaning                                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------------------------- |
| **Active number** | V1      | The only scoring segment for the current round.                                          |
| **Shanghai**      | V1      | Single + double + treble of the active number in one visit → instant win (when enabled). |
| **Normal**        | V2      | Target Needed off: a round with no target hit simply scores 0.                            |
| **Hard**          | V2      | Target Needed on: a round with no target hit halves the running total (round-half-up).    |

## Capture

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — every dart thrown is
  recorded. Also implemented: ANALYTICS + VISUAL_BOARD, the same darts with real
  landing coordinates.
- **One dart's fact:** intended = **nothing stored** — both the target number
  and the ring are null. Single, double and treble of the round's number are all
  legitimate aims (and all three in one visit is the Shanghai), so recording one
  ring would fabricate an intent the player never held; the round's number is
  recoverable from the visit index instead. Hit = whatever landed; `score` = the
  **board** score of that dart (S7 = 7, T7 = 21, miss or wrong number = that
  dart's own board score, which the game then ignores) — never the round's
  Shanghai points.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole session — stage
  ownership is `PER_SEAT`, so a 1v1 match holds one block per seat. A round is a
  turn inside that block, not a stage of its own.
- **Derived, never stored:** the running total, the per-round scores, whether a
  visit was a Shanghai, and the Hard-mode halving — all folded from the dart
  facts against the round's own number.

## Open questions

- ~~Default round length for product (7 vs 20).~~ **Resolved:** 20 — the shipped
  ruleset fixes the range at 1–20 with nothing configurable (`ShanghaiConfig` is
  an empty `.strict()` object; seed `0008`).
- Multiplayer tie if two Shanghais in the same round (usually first in order).
