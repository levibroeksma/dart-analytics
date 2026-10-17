# DOLF

Current version: none (V1 in design)
Entry points: standalone
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source suggests two to eight |
| Config screen (presets shown) | V1 | All | |
| Twenty holes: segments 1 to 20 in order; par is 0 | V1 | All | |
| Eagle: a treble of the hole's number, −2 | V1 | All | |
| Birdie: a double of the hole's number, −1 | V1 | All | |
| Par: a single of the hole's number, 0 | V1 | All | |
| Bogey: any other dart, +1 | V1 | All | |
| Bullseye Bonus: an inner bull earns 2 extra darts, stacking | V1 | All | |
| Outer bull: a re-throw that counts for nothing | V1 | All | |
| Lowest total wins; level lowest totals are reported as a tie, no winner | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Hooves | Deferred | 2+ | Blocked on: the tie-break is a dart at the bull that belongs to no hole, and a tie is judged on "closest to the center" — a separate capture problem (`501.md` §Features, multiplayer note) |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: the same capture problem as Hooves |
| 9-Hole DOLF | V2+ | All | Wanted, unscheduled: the source plays holes 1–9 or 11–19; V1 plays all twenty |
| Match Play | V2+ | 1v1 | Wanted, unscheduled: a second win rule — most holes won — V1 does not need |
| Skins | V2+ | 2+ | Wanted, unscheduled: a second win rule with carried hole values; V1 does not need it |
| Stroke Play Tournament | V2+ | All | Wanted, unscheduled: several rounds summed over a day or weekend; V1 plays one round |

## Identity

- Golf on the dartboard: the 20 segments are 20 holes, played in order, and
  every dart is scored against par. Lowest total wins. Source: dolfdarts.com,
  "DOLF" (https://dolfdarts.com/games/dolf, read 2026-10-12), a game from the
  World Dolf Federation.
- **Aliases:** Dolf Darts.
- Standard dartboard scoring is assumed, but only the zone a dart lands in
  matters here, never its points. Par for every hole is 0.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION, SEQUENTIAL |
| Pressure | PENALTY |
| Family | NOVELTY |

## Objective

**2+:** finish all twenty holes with the lowest total. A total below zero is
under par. A session seats at most four
(`app/src/services/session-seats.service.ts:7`).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Holes | 1–20, in order | Shown, locked |
| Par | 0 per hole | Shown, locked |
| Bullseye Bonus | On | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws first
on every hole. A new ruleset allows one seat until it is added to `SEAT_CAPS`
(`app/src/services/session-seats.service.ts:91`).

## How to play

**2+:** hole 1 is segment 1, then 2, up to 20. On each hole every seat takes
its turn, in seat order, before the next hole starts.

### Visit

On a hole, a seat throws at that hole's number. A visit is three **counted**
darts, plus any bonus darts. Each counted dart scores:

| Dart | Name | Score |
| --- | --- | --- |
| Treble of the hole's number | Eagle | −2 |
| Double of the hole's number | Birdie | −1 |
| Single of the hole's number | Par | 0 |
| Any other dart | Bogey | +1 |

The hole score is the sum of its darts. A seat's total is the sum of its hole
scores. "Any other" includes a dart in any other number, and an off-board dart
(see Open questions).

### Bullseye Bonus

An inner bull scores 0 and earns 2 extra darts on the same hole, scored in the
same way. An inner bull thrown with a bonus dart earns 2 more, so bonuses stack.
Because of this a visit can have more than three darts.

### Outer bull

A dart in the outer bull is thrown again. It counts for nothing, for or
against, and does not use up one of the counted darts.

### Ends when

All seats have finished hole 20.

### Result

The seat with the lowest total wins. Level lowest totals are reported as a tie
with no winner; V1 has no tie-break. Shown: each seat's total against par, hole scores, and counts
of eagles, birdies, pars and bogeys.

## Later versions

### Variants

- **Hooves** — the source's tie-break: tied seats each throw one dart at the
  bull; closest to the center wins, an inner bull beating an outer bull, an
  outer bull beating any other segment; repeat until the tie breaks.
- **9-Hole DOLF** — play only holes 1–9 or 11–19.
- **Match Play** — two seats; each hole goes to the lower hole score, and the
  most holes won takes the match.
- **Skins** — every hole is worth one skin; the lowest hole score wins it, and
  a tied hole carries its skin to the next.
- **Stroke Play Tournament** — several rounds over a day or weekend; the
  lowest cumulative total wins.

### Match structure

- More than four seats, once a session can hold them.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

DOLF is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart);
  also ANALYTICS + VISUAL_BOARD, the same darts with landing coordinates.
  QUICK_SCORE is not offered: every dart is scored on its own ring and
  number, and the bonus darts depend on which darts hit the bull.
- **One dart's fact:** intended = **nothing stored** (free aim); the hole's
  number is recoverable from the hole's position in the round. Hit = the
  number and zone where it landed, with `INNER_SINGLE` and `OUTER_SINGLE`
  distinct where the capture mode has them
  (`database/seeds/0006_single_band_dart_zones.sql:23`, `:30`). `score` = the
  dart's **board** score — never −2, −1, 0 or +1.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole round, with
  `PER_SEAT` ownership, the shape Shanghai uses (`shanghai.md` §Capture); a hole
  is a turn inside the block, not a stage. Seats never alter one another's
  totals.
- **Derived, never stored:** each dart's name and score, the hole score, the
  running total, bonus darts earned, and who is lowest.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Eagle** | V1 | A treble of the hole's number; −2 |
| **Birdie** | V1 | A double of the hole's number; −1 |
| **Par** | V1 | A single of the hole's number; 0 |
| **Bogey** | V1 | Any other dart; +1 |
| **Bullseye Bonus** | V1 | An inner bull earns 2 extra darts; bonuses stack |
| **Hooves** | Deferred | A throw at the bull to break a tie |
| **9-Hole DOLF** | V2+ | Holes 1–9 or 11–19 only |
| **Match Play** | V2+ | Two seats; most holes won |
| **Skins** | V2+ | Lowest hole score wins a skin; ties carry it forward |
| **Stroke Play Tournament** | V2+ | Several rounds; lowest cumulative total |

## Open questions

- "Single (fat section)": does par cover both bands of the hole's single, or
  the large outer band only? The source names only the "fat section" and calls
  every other segment a bogey, so an inner single has no stated score. V1 reads:
  either single band is par. Keypad capture records an unbanded `SINGLE`
  (`app/src/modules/game/types.ts:391-394`), so "both bands are par" is the only
  reading DETAILED_DARTS can play.
- An off-board dart: the source's bogey is "any other segment". V1 reads: an
  off-board dart is a bogey. How should a bounce-out be recorded?
- Visits longer than three darts: the shipped 501 play screen fixes a visit at
  three darts (`app/src/lib/game/five-oh-one-play.data.ts:123`), while the dart
  row only requires a positive number
  (`database/migrations/0006_runtime_events.sql:56`). The spec must settle how a
  hole with bonus darts is entered.
- The outer bull is thrown again and counts for nothing. Is it stored as a dart
  row (it was thrown) or left out? V1 reads: stored, scoring nothing.
- A level lowest total: V1 reports a tie with no winner and invents no
  tie-break. The source breaks it with Hooves. An inner bull beats an outer
  bull and an outer bull beats any other segment, so only a same-zone tie needs
  a measured "closest to the center", which is not a persistable fact. Should a
  tied game stay a tie until Hooves can be captured, or should Hooves be
  adopted by zone with a recorded "closer" judgement for same-zone throws?
