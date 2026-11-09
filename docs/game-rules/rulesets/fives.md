# Fives

Current version: V1 (shipped 2026-11-09)
Entry points: standalone
Game type: `FIVES`
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2 seats) | V1 | 2+ | |
| Three or four seats | Deferred | 2+ | Blocked on: setup seats one guest or bot (`app/src/lib/game/guest-list.ts:19`) and the play screen draws two seats (`app/src/components/layout/games/SplitScoreboard.astro:3`); the engine already takes four |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts#MAX_SEATS`); the source allows up to six |
| Config screen (presets shown) | V1 | All | |
| Fifty-One by Fives (formal name of this game, not a variant) | V1 | All | |
| Visit = 3 darts, judged on its total | V1 | All | |
| Fives points: a total divisible by 5 scores total ÷ 5 | V1 | All | |
| Void: any dart off the board voids the visit | V1 | All | |
| Bust: a visit that would pass 51 scores nothing | V1 | All | |
| Win: first to exactly 51 | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Alternate Target | V2+ | All | Wanted, unscheduled: the source plays to 61 or 101 with identical rules; V1 locks 51, the formal name's number |
| No-Bust | V2+ | All | Wanted, unscheduled: a second overshoot rule — reach or pass the target to win — V1 does not need |
| No Void for Missed Board | V2+ | All | Wanted, unscheduled: a second miss rule — an off-board dart counts as nothing and the other darts still score — V1 does not need |
| Match of several legs | V2+ | All | Wanted, unscheduled: the source suggests best of 3 or 5; V1 plays one leg |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |

## Identity

- Add up three darts; only a total that divides by five scores, and it scores
  that total ÷ 5. First to exactly 51 points wins. Source: dolfdarts.com,
  "Fives" (https://dolfdarts.com/games/fives) and "Fifty-One by Fives"
  (https://dolfdarts.com/games/fifty-one-by-fives), both read 2026-10-12.
- **Aliases:** Fifty-One by Fives (also written 51 by 5s), 5s, Darts Fives,
  All Fives. Fifty-One by Fives is the formal name of this same game, not a
  variant: the two pages give the same rules.
- Standard dartboard scoring: a dart is worth its board score.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | CONTROL (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | ACCUMULATION |
| Pressure | NONE |
| Family | PUB |

## Objective

**2+:** be the first seat whose running total is exactly 51 fives points. A
session seats at most four (`app/src/services/session-seats.service.ts#MAX_SEATS`).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2; the engine takes up to 4) | Editable |
| Target | 51 | Shown, locked |
| Off-board dart | Voids the visit | Shown, locked |
| Overshoot | Bust | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. A new ruleset allows one seat until it is added to `SEAT_CAPS`
(`app/src/services/session-seats.service.ts#SEAT_CAPS ?? 1`).

## How to play

### Visit

Three darts, all thrown. The visit's **total** is the sum of the three board
scores.

### Fives points

- Total divisible by 5: the visit scores total ÷ 5 (45 scores 9, 180 scores
  36, the most a visit can score).
- Total not divisible by 5: the visit scores 0.
- Fives points add to the seat's running total.

### Void

If any of the three darts lands off the scoring surface of the board — "bounces
out or lands off the board" — the whole visit scores 0, whatever the other darts
hit. Because of this, the visit that brings a seat to 51 has all three darts on
the board. An off-board dart is recorded as a `MISS` zone dart with score 0 and
a landing coordinate only where the board read one (a tap outside the double
ring keeps its coordinate, a bounce-out has none); every on-board dart scores at
least 1, so a dart with score 0 voids the visit.

### Bust

If the visit's fives points would take the running total above 51, the visit
scores nothing and the total stays as it was (counted as a bust, apart from a
void).

### Finishing

A visit that brings the running total to exactly 51 wins at once, before any
later seat has thrown that round; seat 1 therefore has a first-throw edge, as in
501.

### Ends when

A seat reaches exactly 51; it wins at once, and later seats do not throw.

### Result

Winner, each seat's final total, visits taken, scoring visits, voids and busts.

## Later versions

### Variants

- **Alternate Target** — another target, e.g. 61 or 101; all else the same.
- **No-Bust** — no exact finish: reaching or passing the target wins. Removes
  the Bust rule.
- **No Void for Missed Board** — an off-board dart counts for nothing, and
  the remaining darts still score. The source's example: two darts totalling
  25 and an off-board third score 5.

### Match structure

- Several legs ("best of 3 or best of 5"); V1 plays one.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.
- More than four seats, once a session can hold them.

## Capture

Fives V1's capture shape.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart);
  also ANALYTICS + VISUAL_BOARD, the same darts with landing coordinates.
  QUICK_SCORE is not offered: a visit total cannot show that a dart was off the
  board, and an off-board visit scores 0 however its total divides.
- **One dart's fact:** intended = **nothing stored** (free aim). Hit = where it
  landed; an off-board dart is a `MISS` zone dart
  (`database/seeds/0001_reference_data.sql:432`) with `score` 0. `score` = the
  dart's **board** score — never fives points.
- **Stage type:** one shared stage for the game (the engine writes it as an
  `EXERCISE_BLOCK`) — the first seat to 51 ends it for everyone. One `turns` row
  per visit, one `darts` row per dart.
- **Derived, never stored:** the visit total, fives points, each seat's running
  total (a fold over visits with voids and busts scoring nothing), the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Fifty-One by Fives** | V1 | The formal name of this game; the target is 51 |
| **Fives points** | V1 | A divisible-by-5 visit total ÷ 5 |
| **Void** | V1 | An off-board dart: the visit scores 0 |
| **Bust** | V1 | A visit that would pass 51; it scores nothing |
| **Alternate Target** | V2+ | A target other than 51 |
| **No-Bust** | V2+ | Reach or pass the target to win |
| **No Void for Missed Board** | V2+ | An off-board dart counts for nothing; the others score |

## Open questions

- The source summary says "First to 50"; its objective, rules and the formal
  name say 51. V1 reads 51.
