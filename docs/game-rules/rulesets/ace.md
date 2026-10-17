# Ace

Current version: none (V1 in design)
Entry points: standalone
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| Config screen (presets shown) | V1 | All | |
| Fixed number of rounds, 3 to 12 | V1 | All | |
| Target drawn by the app each round | V1 | All | |
| Every seat throws at the same target in a round | V1 | All | |
| Points only for darts on the target: single 1, double 2, treble 3 | V1 | All | |
| Bull as target: outer bull 4, inner bull 6 | V1 | All | |
| Highest total after the last round wins | V1 | All | |
| Equal totals: a shared win | V1 | All | |
| Target picked by an electronic board | Dropped | All | Decided against: the source's machine pick is a random draw, which the app makes itself (the source itself suggests a random number generator for a bristle board); no electronic board is involved |
| Sudden-death tiebreak round | V2+ | 2+ | Wanted, unscheduled: the source leaves "one extra round with a new random target, or accept the draw" to the players before the game, so it is a setting V1 does not need |
| Solo play | V2+ | Single | Wanted, unscheduled: the source lists two players as the minimum; a solo run has no winner, so what its result shows is undecided |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source's own maximum is also four |

## Identity

- A surprise-target scoring game: each round the app draws one target, every
  seat throws a visit at it, and only darts that land on it score. Source:
  dolfdarts.com, "Ace" (https://dolfdarts.com/games/ace, read 2026-10-12).
  The source describes an electronic-board game, "notably featured on
  Arachnid-brand boards"; V1 replaces the board's random pick with the app's.
- Ace uses its own points, not board scores: a single of the target is 1, a
  double 2, a treble 3. Only the target scores; everything else is a miss.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | ACCUMULATION |
| Pressure | NONE |
| Family | PUB |

## Objective

**2+:** have the highest total after the last round.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Rounds | 8 (min 3, max 12) | Editable |
| Targets drawn from | 1–20 and the bull | Shown, locked |
| Draw seed | minted per game | Not shown |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first in every round. A new ruleset has no entry in `SEAT_CAPS` and defaults
to one seat (`app/src/services/session-seats.service.ts:91`), so Ace needs an
entry of 4.

## How to play

### Round

A **round** is one visit for every seat, in seat order, all at the same
**target** — the number (or the bull) the app drew for that round. The next
round draws a new target.

### Visit

Up to **three darts**, then play passes to the next seat; after the last seat
the round ends.

### Scoring a dart

- Target is a number: a dart in that number's single scores **1**, its double
  **2**, its treble **3**. A dart anywhere else scores **0**, with no penalty.
- Target is the bull: the outer bull scores **4**, the inner bull **6**. Any
  other dart scores **0**.
- The best visit on a number is 9 (three trebles); on the bull, 18.

### Ends when

The last seat has thrown its visit in the last round.

### Result

The winner, or a shared win, with each seat's total and its score in every
round beside that round's target.

**2+:** the highest total wins. Equal highest totals share the win; V1 has no
tiebreak round.

## Later versions

### Variants

- **Sudden-death tiebreak round** — on equal highest totals, one more round
  with a newly drawn target; the highest score in it wins.
- **Solo play** — one seat, rounds as above; the result would be a total with
  no opponent.

### Match structure

- More than four seats, once a session can hold them.

## Capture

Ace is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — whether a dart scored, and for how much, depends
  on its number and ring (including the bull's), so a visit total alone cannot
  carry this game and QUICK_SCORE cannot.
- **One dart's fact:** intended = **nothing stored** — the aim is the round's
  target, recoverable from the draw. Hit = number and ring where it landed;
  `score` = the dart's **board** score (S17 = 17, T17 = 51, outer bull = 25,
  inner bull = 50, miss = 0) — never the 1, 2, 3, 4 or 6 Ace awards.
- **The drawn targets cannot be folded from the darts.** The game's draw seed
  in the configuration snapshot would be the stored fact; each round's target
  derives from it, as Random Checkout's `drawSeed`
  (`../training/exercises/random-checkout.md` §Capture). Without it the game
  cannot be replayed.
- **Stage type:** one stage per seat for the whole game — no seat's darts
  change another's — as Around the Clock's per-seat ownership
  (`app/src/modules/game/around-the-clock.engine.module.ts:322`). The round
  number comes from the visit order, not a stage per round.
- **Derived, never stored:** each round's target, each dart's Ace points, round
  scores, running totals, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target drawn by the app each round** | V1 | The one number, or the bull, every seat throws at in a round |
| **Sudden-death tiebreak round** | V2+ | One extra round on equal highest totals |
| **Solo play** | V2+ | One seat playing the rounds alone |

## Open questions

- Is the draw uniform over all 21 targets, and may the same target come up
  twice? The source says only "randomly selects" and "a new random target".
  Proposed reading: uniform, with repeats allowed, since each round is a fresh
  draw.
- The source puts the sudden-death-or-draw choice to the players before the
  game. V1 plays the draw; does that choice become a config setting later?
- Solo play: what would a solo result show, with no opponent to beat?
