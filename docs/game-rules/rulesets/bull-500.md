# Bull 500

Current version: none (V1 in design)
Entry points: standalone
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Config screen (presets shown) | V1 | All | |
| Visit = 3 darts, always all three | V1 | All | |
| Locked: a visit starts with no dart scoring | V1 | All | |
| Unlock: a bull (outer or inner) opens scoring for the rest of the visit | V1 | All | |
| The unlocking bull scores nothing | V1 | All | |
| Only the 20 counts after the unlock: single 20, double 40, treble 60 | V1 | All | |
| Darts before the unlock, and darts off the 20, score nothing | V1 | All | |
| Running total of points; 500 or more ends the game | V1 | All | |
| Result readouts: visits and darts to target, best visit, Useful unlock rate | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Multiplayer (2–4 seats) | V2+ | 2+ | Wanted, unscheduled: V1 is the single-player cut; a new ruleset defaults to one seat until it has an entry in `SEAT_CAPS` (`app/src/services/session-seats.service.ts:91`), and a session seats at most four (`:7`) |
| 19 Only | V2+ | All | Wanted, unscheduled: a rule switch of which segment is live; V1 locks it to 20 |
| 19 and 20 | V2+ | All | Wanted, unscheduled: a rule switch of which segments are live; V1 locks it to 20 |
| Adjusted target score | V2+ | All | Wanted, unscheduled: the source suggests 300 or 1000 for a shorter or longer game; V1 locks the target at 500 |
| Takeover rule | V2+ | 2+ | Wanted, unscheduled: scoring rights held by one seat at a time need two or more seats |
| League format | V2+ | 2+ | Wanted, unscheduled: play on until every seat's finishing place is known, which needs three or more seats |

## Identity

- Hit the bull first, then score on the 20: every visit is a bull dart
  followed by darts at the 20, and the race is to 500 points. Source:
  dolfdarts.com, "Bull 500" (https://dolfdarts.com/games/bull-500, read
  2026-10-12).
- **Not Bullseye 500.** `training/exercises/bullseye-500.md` is a
  single-target exercise: every dart goes at the bull, the bull's own board
  score (25 or 50) builds a running total, and one miss resets it to 0.
  Bull 500 is a game: the bull scores nothing and only unlocks the 20, a
  visit that misses the bull just scores 0 (nothing resets), and the total
  only ever climbs. Different rules, different file.
- Standard dartboard scoring: a dart's board score is its face value times
  its ring. The game's points are derived from those board scores.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | BULL (primary), SCORING |
| Session role | CORE |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER |
| Difficulty | ADVANCED |
| Mechanic | ACCUMULATION |
| Pressure | NONE |
| Family | PUB |

## Objective

**Single:** reach 500 points (or more) in as few visits as you can.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat | Shown, locked |
| Target | 500 | Shown, locked |
| Live segment | 20 | Shown, locked |

V1 shows these and locks them. The source lets players pick the target and
the live segment, so a later version unlocks them (see Later versions).

## How to play

### Visit

Three darts, always all three. The visit is worked dart by dart:

- Until a bull is hit in this visit, no dart scores. The visit starts
  **locked**.
- A hit on the outer bull or the inner bull is an **unlock**. The bull itself
  is worth 0 points.
- Every dart thrown after the unlock that lands in the 20 scores its board
  value: single 20 = 20, double 20 = 40, treble 20 = 60. Any other dart after
  the unlock scores 0; it is not a bust and takes nothing away.
- A second bull after the unlock scores 0, like any dart off the 20.
- The bull's position decides the visit's best case: bull on dart 1 leaves
  two scoring darts (at most 120 points); bull on dart 2 leaves one (at most
  60); bull on dart 3 leaves none, so the visit scores 0; no bull in the
  three darts also scores 0.
- The unlock does not carry to the next visit. Every visit starts locked.

### Scoring / progress

The visit's points are added to the running total. The total never goes down.

### Ends when

At the end of the visit in which the running total reaches 500 or more. The
total need not land on 500; going over is fine. The visit is still thrown in
full, so every dart of the finishing visit counts. V1 has no visit limit.

### Result

The visits and darts it took to reach the target, the final total, the best
visit, and the **useful unlock rate**: visits with an unlock that left at least
one scoring dart (a bull in the first two darts), out of all visits.

## Later versions

### Variants

- **19 Only** — the 19 is the live segment instead of the 20: single 19 = 19,
  double 19 = 38, treble 19 = 57.
- **19 and 20** — both the 19 and the 20 are live after the unlock.
- **Adjusted target score** — a target other than 500 (the source names 300
  and 1000).
- **Takeover rule** — once a seat hits the bull, only that seat may score on
  its visits until another seat hits the bull and takes over. Hitting the bull
  is then also a block on the other seats.
- **League format** — with three or more seats, play on after the first seat
  reaches the target until every seat's finishing place is set, ranked in the
  order they got there.

### Match structure

- Multiplayer: 2–4 seats, each with its own total. The first seat to reach
  the target ends the game at the end of its visit, so seats later in the
  round get no equalising visit (the source ends the game "upon completion of
  that player's turn"). Every seat's visit starts locked.

## Capture

Bull 500 is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or ANALYTICS +
  VISUAL_BOARD. A visit total cannot say whether the bull came first, so
  QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended number is the bull until the visit unlocks,
  then the 20; the rules leave the ring on the 20 free, so no intended ring
  is stored after the unlock. Hit = number and zone where it landed. `score`
  = the dart's **board** score — a bull stores 25 or 50, not the 0 points it
  is worth here. Game points are never stored.
- **Stage type:** one `EXERCISE_BLOCK` stage for the game
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts:118`);
  one `turns` row per visit with up to three `darts` rows. In the multiplayer
  version each seat's total stands alone, so one stage still serves; the
  Takeover rule would add cross-seat state.
- **Derived, never stored:** whether a visit is locked, each visit's points,
  the running total, useful unlock rate, visits and darts to the target, best
  visit.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Locked** | V1 | A visit before a bull is hit; no dart scores |
| **Unlock** | V1 | A bull hit in the visit; the darts after it may score on the 20 |
| **Useful unlock rate** | V1 | Share of visits with an unlock that left a scoring dart: a bull in the first two darts |
| **19 Only** | V2+ | The 19 is the live segment instead of the 20 |
| **19 and 20** | V2+ | Both the 19 and the 20 are live after the unlock |
| **Adjusted target score** | V2+ | A target other than 500 |
| **Takeover rule** | V2+ | One seat at a time holds the scoring rights; a bull hit by another seat takes them |
| **League format** | V2+ | Play on until every seat's place is decided |

## Open questions

- The source's objective says "exactly 500"; its winning section says exact
  landing is not required and passing 500 ends the game. V1 follows the
  winning section: 500 or more.
- The source's setup says "2 or more players", its listing says one to four.
  V1 plays one seat; multiplayer is V2+.
- Does the finishing visit count in full? V1 reads "upon completion of that
  player's turn" as yes: every dart of that visit counts.
- Takeover rule: does the first bull of the game set the holder? May the
  holder's own bull on a later visit change anything?
