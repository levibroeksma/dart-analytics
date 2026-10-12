# Mulligan

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows six |
| Teams | Deferred | 2+ | Blocked on: one seat per side only, teams rejected (`app/src/services/session-seats.service.ts:87-88`); the source lists Mulligan as a team game |
| Config screen (presets shown) | V1 | All | |
| Six target numbers, set in order on the config screen | V1 | All | |
| Bull as the seventh and last target | V1 | All | |
| Visit = 3 darts | V1 | All | |
| Mark: a treble of the current target | V1 | All | |
| Close: three marks close a number; the next target opens | V1 | All | |
| Current target: the first unclosed number, then the bull | V1 | All | |
| Each seat keeps its own progress | V1 | 2+ | |
| Bull finish: inner or outer bull wins at once | V1 | All | |
| First seat to hit the bull wins | V1 | 2+ | |
| Standard dartboard scoring (assumed) | V1 | All | |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note); V1 seat 1 throws first |
| Number picking: each seat picks three numbers | V2+ | 2+ | Wanted, unscheduled: V1 takes the six numbers as setup input and does not model who picked which; the split only makes sense for two seats |
| Handicap Mulligan | V2+ | 2+ | Wanted, unscheduled: needs per-seat rules (doubles count, or two marks per number); V1 gives every seat the same rules |
| Preset Numbers | V2+ | All | Wanted, unscheduled: a one-tap fixed set such as 15–20; V1 lets the player enter the six numbers by hand |
| Free-Order Mulligan | V2+ | All | Wanted, unscheduled: a second progress rule — any open target in any order — V1 does not need |
| Match play (best of N) | V2+ | 2+ | Wanted, unscheduled: the source lets groups play a match of games; needs a series above a single game |

## Identity

- A race down a list: hit three trebles on each of six numbers, in order, then
  the bull. Singles and doubles are worth nothing. Source: dolfdarts.com,
  "Mulligan" (https://dolfdarts.com/games/mulligan, read 2026-10-12).
- The source calls it a variant of Cricket: marks close targets, but only a
  treble is a mark and the targets must be closed in a fixed order.
- Standard dartboard scoring is assumed. The game has no points; only marks.

## Objective

**2+:** be the first seat to close all six numbers in order and then hit the
bull. The source requires two or more players, and a session seats at most
four, so Mulligan has no single-player mode.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Target numbers | Six different numbers from 1–20, in the order they close | Editable |
| Marks to close a number | 3 | Shown, locked |
| Counts as a mark | Treble of the current target only | Shown, locked |
| Last target | Bull (inner or outer) | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws first.

A new ruleset allows one seat until it is added to the seat caps
(`app/src/services/session-seats.service.ts:7` sets the maximum; the cap lookup
defaults an unlisted ruleset to 1 at line 91), so the 2–4 seat range is a
requirement on that file, not something it does today.

The six numbers are one shared list, the same for every seat. Each seat closes
the same numbers in the same order, with its own marks.

## How to play

### Visit

Three darts, then play passes to the next seat.

### Progress

Each seat has a **current target**: the first number in the list it has not yet
closed, or the bull once all six are closed. Every dart is judged against the
target current when it is thrown.

- **Mark:** a dart in the treble ring of the current target number. One mark.
- Anything else is nothing: a single or double of the current number, any dart
  at another number (even the treble of a later target or an earlier, closed
  one), any miss. There is no penalty.
- **Close:** the third mark on a number closes it. The next number in the list
  becomes the current target for the next dart.
- Marks carry between visits: two marks this visit, one more next visit.
- There are no points and nothing accumulates beyond marks.

Example: the list is 17, 14, 20, 9, 11, 3. A seat throws T17, S17, T17: two
marks on 17, since the single does not count. A triple 20 thrown while 17 is
current is wasted.

### Finishing

With all six numbers closed, the current target is the bull. A dart in the
inner bull or the outer bull wins at once; the visit and the game end.

### Seats do not interact

A mark, a close or a finish by one seat changes nothing for another. The seats
race on identical lists.

**2+:** the first seat to hit the bull wins at once; later seats in that round
get no last visit. Two seats cannot finish together, because one dart ends the
game.

### Ends when

A seat hits the bull with all six numbers closed.

### Result

Winner, and per seat: numbers closed, marks on the current number, darts
thrown, and treble hit rate at the current target.

## Later versions

### Variants

- **Handicap Mulligan** — a weaker seat may count doubles as marks as well as
  trebles, or need only two marks per number. Needs a rule set per seat.
- **Preset Numbers** — the six numbers are fixed in advance rather than picked,
  for example 15, 16, 17, 18, 19 and 20.
- **Free-Order Mulligan** — no sequence: a seat may work on any of the six
  numbers in any order.
- **Number picking** — each seat picks three numbers; all six are agreed in a
  sequence before play. V1 takes the finished list as setup input.

### Match structure

- **Match play** — a series of games, e.g. best of 3 or 5, with the picking or
  throwing order alternating between games.
- **First thrower by a throw at the bull** — the source throws one dart each
  at the bull; the closest throws first. Deferred as 501's.
- **Teams** and **more than four seats** wait on the seat limits above.

## Capture

Mulligan is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — a mark is read off the dart's number and ring, so
  the visit total cannot express it and QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — the current target is
  recoverable from the seat's progress. Hit = number and ring where it landed;
  `score` = the dart's **board** score (T17 = 51, inner bull = 50, outer
  bull = 25, miss = 0), never the mark it produced.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game, as Around
  the Clock (`around-the-clock.md` §Capture): no seat affects another, and no
  stage opens per target. The config snapshot would carry the six
  numbers in order.
- **Derived, never stored:** marks per number, the current target, numbers
  closed, who has won — folded from the dart facts against the configured list.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Mark** | V1 | A dart in the treble ring of the current target |
| **Close** | V1 | The third mark on a number; the next target opens |
| **Current target** | V1 | The first unclosed number in the list, or the bull when all six are closed |
| **Handicap Mulligan** | V2+ | Doubles also count, or two marks close a number, for a weaker seat |
| **Preset Numbers** | V2+ | The six numbers fixed in advance rather than entered |
| **Free-Order Mulligan** | V2+ | The six numbers may be closed in any order |
| **Number picking** | V2+ | Each seat picks three of the six numbers |
| **Match play** | V2+ | A series of games |

## Open questions

- Darts after a close in the same visit: V1 judges each dart against the
  target current when thrown, so a close on dart 1 lets darts 2 and 3 count
  toward the next number. The source's tip about the bull says darts after
  closing the last number "won't count as marks", which could mean closing
  ends the visit's progress. Which reading?
- Duplicate numbers: the source describes six numbers from three picks each.
  V1 requires six different numbers. If two seats pick the same number, is
  the list shorter, or is a pick refused?
- Picking with other than two seats: three picks each gives six numbers only
  for two seats. How do three or four seats fill the list?
- First-thrower advantage: the first seat can finish a round before the others
  throw. Is that accepted, as the source gives no equalizing visit?
