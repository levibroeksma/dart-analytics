# Score Training

Current version: V1 (shipped 2026-07-16)
Entry points: standalone, routine step
Game type: `SCORE_TRAINING`
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (Mode + duration) | V1 | All | |
| Fixed number of visits (N turns, default 10) | V1 | All | |
| N editable (1–100) | V1 | All | |
| Timed session (minutes, default 5) | V1 | All | |
| Runs as a routine step (timed) | V1 | All | |
| Minutes editable (3–30) | V1 | All | |
| Score as high as possible (face value) | V1 | All | |
| All board segments count | V1 | All | |
| Bulls count (25 / 50) | V1 | All | |
| Visit = 3 darts | V1 | All | |
| Track total score | V1 | All | |
| Track 3-dart average | V1 | All | |
| Target score / challenge goal | V2+ | All | Wanted, unscheduled: `ScoreTrainingConfig` carries only `duration_type`, `duration_value`, `max_darts_per_turn` and `max_visit_score` — there is no goal field, and a goal also needs a pass/fail result the session has no notion of |
| Big Bull variant | V2+ | All | Wanted, unscheduled: every inner single and the outer bull score 50 and the inner bull 70, so a visit total is game points, not board score. That total must be derived per dart from the zone, and only VISUAL_BOARD records `INNER_SINGLE` apart from `OUTER_SINGLE` (`board-geometry.module.ts:87-94`); QUICK_SCORE keeps no dart rows, so it cannot play it (see Capture). `ScoreTrainingConfig` also has no variant key (`types.ts:16-22`) |
| Multiple Count-Up variant | V2+ | All | Wanted, unscheduled: the 1st, 2nd and 3rd dart of a visit score 1×, 2× and 3×, so the total needs each dart's place in the visit. Only dart rows carry that (`dart.sequence`, VISUAL_BOARD); QUICK_SCORE keeps none (see Capture). `ScoreTrainingConfig` also has no variant key (`types.ts:16-22`) |
| Standard dartboard scoring (assumed) | V1 | All | |
| Eagle's Eye (bull-only scoring) | V2+ | All | Wanted, unscheduled: a rule switch of this ruleset, not a distinct game, but the engine scores every board segment and `ScoreTrainingConfig` has no scoring-restriction field (`app/src/lib/game/rulesets/types.ts:16-22`); V1 is shipped, so it cannot be V1 |
| Streak (best 5 consecutive visits) | V2+ | All | Wanted, unscheduled: a rule switch of this ruleset, not a distinct game — visits score as V1 and only the result differs; V1 reports total and average, not a windowed best, and V1 is shipped |
| Up Down Count-Up (alternating add and subtract visits) | V2+ | 1v1 | Wanted, unscheduled: a rule switch of this ruleset, not a distinct game — V1 only ever adds a visit to the total; the source lists 2–4 players, but this ruleset's seat cap is 2 (`app/src/services/session-seats.service.ts:29`), so 3–4 would also need a cap change |

## Identity

Simple scoring practice: throw for **N** visits and pile up as many points as you can. No checkout, no bust — pure scoring volume. Standard dartboard scoring is assumed. (Source note: “n turns, score as high as you can.”)

## Tags

### Standalone

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary) |
| Session role | CORE, BENCHMARK |
| Format | SOLO, ONE_V_ONE |
| Difficulty | BEGINNER |
| Mechanic | ACCUMULATION |
| Pressure | NONE |
| Family | STANDARD |

### Routine step

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary) |
| Session role | CORE |
| Format | SOLO |
| Difficulty | BEGINNER |
| Mechanic | ACCUMULATION |
| Pressure | NONE |

## Objective

- **Visit:** score the sum of three darts (face values, including doubles/trebles/bulls).
- **Session (V1), Rounds mode:** complete **N** visits; highest total wins (solo: beat your own total / chase a personal best).
- **Session (V1), Timed mode:** score for **M** minutes; total at time-up is the result.
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest total score wins (score-compare, ties possible). <!-- 2026-08-22 -->

## Config & presets

Before play, a **config screen** shows the session config. Setup radios select the **mode** (Rounds / Timed), not preset names.

| Setting    | Preset / default                         | On config screen     |
| ---------- | ----------------------------------------- | --------------------- |
| Players    | 1 seat, or 2 (guest or DartBot), Rounds mode only | Editable       |
| Mode       | Rounds or Timed                           | Radios                 |
| Visits (N) | Default **10** (min **1**, max **100**)   | Editable when Rounds   |
| Minutes    | Default **5** (min **3**, max **30**)     | Editable when Timed    |
| Scoring    | Full board, standard values               | Shown, locked          |

As a routine step the duration is the step's allocation and replaces this setting.

## How to play

### Visit

Exactly **three darts** (or up to three — all count toward the visit total). Sum their standard values and add to the running session score.

### Progress

Rounds mode: repeat until **N** visits are done. Timed mode: keep throwing visits until the **M**-minute clock runs out (engine already supports a `MINUTES` duration type). Either way, every dart that scores on the board counts; there is no “wrong” target.

### Finishing

Rounds mode: session ends after visit N. Timed mode: session ends when the clock reaches 0, after the visit in progress completes. Report total points (and optionally 3-dart average = total ÷ visits played).

### Bust

N/A.

### Ends when

Whichever bound the chosen mode sets, and nothing else:

- **Rounds mode** — after visit **N** (1–100, default 10).
- **Timed mode** — when the **M**-minute clock reaches 0 (3–30, default 5); the
  visit in progress finishes first.

**Single:** the one seat plays its own budget out.

**1v1:** Rounds mode only. Both seats play the full round budget and neither is
cut short; the match ends once both are done. Highest total wins; equal totals
is a tie, with no tiebreak. A DartBot seat counts as the opponent seat.

### Result

The total score and the 3-dart average, with visits played. In 1v1, the winning
seat beside both seats' totals, or a tie.

## Later versions

### Variants

- Challenge: beat a **target total**
- Restricted scoring (e.g. only trebles, only 20s) as optional modes
- Multiplayer: highest total after N visits wins
- **Big Bull:** a scoring variant for the full board. A dart in any inner single (the band between the outer bull and the treble ring) scores **50**, whatever its number; the outer bull scores **50**; the inner bull (the **Super Bull**) scores **70**. Treble, outer single and double keep face value × 3, × 1 and × 2; a dart off the board or bounced out scores 0. No bust. Visit maximum is 210 (three Super Bulls). It needs a dart's zone, so only VISUAL_BOARD can play it. Source: https://dolfdarts.com/games/big-bull, an electronic-board game — on a steel board the dart is tapped where it landed. Session length, 1v1 and tie rules are the ones above (Rounds mode only in 1v1, seat cap 2 at `session-seats.service.ts:29`); the source's 8 rounds map to N, and its by-agreement tiebreak is not adopted.
- **Multiple Count-Up:** a scoring variant for the full board. The 1st dart of a visit scores its board value × 1, the 2nd × 2, the 3rd × 3 (a treble 19 as 3rd dart is 57 × 3 = 171). A dart off the board or bounced out scores 0 in its place, and still takes its place in the order. No bust. Visit maximum is 360 (three treble 20s). It needs each dart's place in the visit, so only VISUAL_BOARD can play it. Source: https://dolfdarts.com/games/multiple-count-up, an electronic-board game — on a steel board the dart order is the throw order. Session length, 1v1 and tie rules are the ones above (Rounds mode only in 1v1, seat cap 2 at `session-seats.service.ts:29`); the source's 8 rounds map to N, and its by-agreement tiebreak is not adopted.
- **Eagle's Eye** — Rounds mode where only bull darts score: outer bull 25,
  bullseye 50, every other dart 0. Standard format 8 visits (N = 8, inside
  the 1–100 range); a visit tops out at 150 and the run at 1,200. No bust,
  no void visit; a dart that falls off the board scores 0. Source:
  dolfdarts.com, "Eagle's Eye" (https://dolfdarts.com/games/eagles-eye). Its
  "Streak Bonus" variation (bonus points for consecutive bulls in a visit,
  values never fixed by the source) is not recorded as a feature: it has no
  settled table to write.
- **Streak** — Rounds mode with N = 20; every dart scores board value as in
  V1. The result is the **streak score**: the highest sum of any 5 visits in a
  row (16 windows, strictly adjacent, no skipping). A visit tops out at 180,
  so the result is 900 at most; the streak average is the streak score ÷ 5.
  Source: dolfdarts.com, "Streak" (https://dolfdarts.com/games/streak). Its
  tiebreak: compare each seat's second-best 5-visit streak, then the higher
  single-visit maximum.
  Its variations (window of 3 or 7, timed run, doubles mix) are not features.
- **Up Down Count-Up** — Rounds mode; visits alternate sign. Visit 1 is Plus
  (the three-dart total is added), visit 2 is Minus (it is subtracted), and so
  on. Total starts at 0 and may go negative; no bust, no void visit; highest
  signed total after the last visit wins. N is even so both signs are played
  equally often. **1v1:** both seats throw the same sign in the same visit
  number. Source: dolfdarts.com, "Up Down Count-Up"
  (https://dolfdarts.com/games/up-down-count-up), which lists an electronic
  board (DARTSLIVE) as equipment; its rules text describes a standard board
  and scoring by hand, so only that is recorded here. Its "Reverse Start"
  variation (Minus first) is not a feature.

### Match structure

- Best of / first to across multiple score-training blocks

### Other

- Track history / personal bests

## Glossary

| Term      | Version | Meaning                                         |
| --------- | ------- | ----------------------------------------------- |
| **Visit** | V1      | Three darts; sum is added to the session total. |
| **N**     | V1      | How many visits in the session (Rounds mode).   |
| **M**     | V1      | How many minutes in the session (Timed mode).   |
| **Mode**  | V1      | Rounds or Timed; picked on the config screen.   |
| **Big Bull** | V2+ | Variant: inner singles and outer bull score 50, inner bull 70, the rest as normal. |
| **Multiple Count-Up** | V2+ | Variant: 1st, 2nd and 3rd dart of a visit score 1×, 2× and 3×. |
| **Eagle's Eye** | V2+ | Rounds mode where only bull darts score (25 / 50). |
| **Streak** | V2+ | Rounds mode of 20 visits; the result is the best 5 visits in a row. |
| **Up Down Count-Up** | V2+ | Odd visits are added to the total, even visits subtracted. |

## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (typed visit total, **no dart rows**) or VISUAL_BOARD (tapped darts, one dart row each). `capabilities.ts` offers both.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit. VISUAL_BOARD: the dart's board position, segment and multiplier. Board-based statistics (heatmap, treble rate, personal best) populate only from VISUAL_BOARD sessions.
- **Stage type:** one `EXERCISE_BLOCK` for the whole session.
- **Derived, never stored:** the running total and three-dart average.
- **Variants (V2+):** Big Bull and Multiple Count-Up play under VISUAL_BOARD only (`capabilities.ts:42` also lists QUICK_SCORE, which has no dart rows to derive from). Per dart: `score` stays the board score (`board-geometry.module.ts:46-56`), and `hitZoneKey` (`INNER_SINGLE`, `OUTER_BULL`, `INNER_BULL`, …) and `sequence` carry the rest. The 50 / 70 or 1× / 2× / 3× point values are derived from those, never stored in `score` or in a turn's `totalScore`, which VISUAL_BOARD checks against the sum of board scores (`visual-board.validator.ts:142`). Stage type is unchanged.
- **Eagle's Eye (V2+):** VISUAL_BOARD only. Dart rows keep their board score
  (a non-bull dart stores its board score, not the 0 game points it earns); bull
  points are derived from them, never typed. QUICK_SCORE cannot carry it, as a
  typed total would be game points, not board score.
- **Streak and Up Down Count-Up (V2+):** the best 5-visit window and the signed
  total are derived from visit totals, so capture is unchanged.

## Open questions

- Whether missed board / bounce-outs are entered as 0 only or have a separate miss track.
- Whether Big Bull and Multiple Count-Up refuse a dartless keypad visit: a VISUAL_BOARD session accepts one as a bare total (`visual-board.validator.ts:96-105`), and neither variant can score it, since it has no zones or dart order.
- Eagle's Eye ties: the source throws one extra three-dart visit each until broken; V1's 1v1 rule is a tie with no tiebreak. Which applies?
- Eagle's Eye capture: V2+ reads it as VISUAL_BOARD only (see Capture). Should QUICK_SCORE ever carry it by typing a visit's bull points, accepting that a typed total is game points and cannot be checked against the darts?
- Streak with 2 seats: the source gives playerCountMax 1 yet describes head-to-head play and a tiebreak. This draft reads it as allowed; confirm. Is "second-best 5-visit streak" allowed to overlap the best window?
- Up Down Count-Up: must N be forced even (the source says "an even number") or may an odd N end on an extra Plus visit?
- Up Down Count-Up with a DartBot seat: how does the bot play a Minus visit, where the aim is to score low?
- Up Down Count-Up solo: the source lists 2–4 players; is a single-player run (net total versus your own best) allowed? This draft says 1v1 only.
