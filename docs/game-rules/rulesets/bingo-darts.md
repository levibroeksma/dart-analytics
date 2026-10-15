# Bingo Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Card: a personal set of numbers from 1–20, dealt at random | V1 | All | |
| Short-Form Bingo (5-number card) | V1 | All | |
| Visit = 3 darts at any number on your own card | V1 | All | |
| Marks: single 1, double 2, treble 3; three marks close a number | V1 | All | |
| Closed number: three marks; later darts on it change nothing | V1 | All | |
| Excess marks on a closing dart are lost | V1 | All | |
| Darts outside your own card score nothing | V1 | All | |
| Free-Play Bingo | V1 | All | |
| Win: first seat to close every number on its card | V1 | All | |
| Long-Form Bingo | V2+ | All | Wanted, unscheduled: a longer card (up to 9 numbers) is a setting V1 does not need |
| Sequential Bingo | V2+ | All | Wanted, unscheduled: a second closing rule — card order is binding — that V1 does not need |
| Shared-Number Bingo | V2+ | 2+ | Wanted, unscheduled: one card for every seat instead of a dealt one; V1 plays without it |
| Team Bingo | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:88`) |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Each seat is dealt a card of numbers from 1–20 and must close every one of
  them, three marks each. The first seat to clear its card wins. Source:
  dolfdarts.com, "Bingo Darts" (https://dolfdarts.com/games/bingo-darts, read
  2026-10-12).
- Standard dartboard rings (single, double, treble) set the marks. Board
  points are not scored; no dart helps an opponent.
- Multiplayer only: the source needs "two or more players" and a race needs a
  rival.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | BEGINNER |
| Mechanic | SIMULATION, TERRITORIAL |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**2+:** be the first seat to close every number on its own card. The winning
dart is the one that closes the last number.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Card size | 5 numbers (Short-Form Bingo) | Shown, locked |
| Closing order | Any order (Free-Play Bingo) | Shown, locked |
| Card deal | Random, 1–20, one card per seat | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. Each seat's card is dealt at random when the game is set up and does
not change. Whether two cards may share a number is open (see Open questions).

## How to play

### Card

Each seat has its own **card**: a set of numbers drawn from 1–20. The
bullseye is never on a card. Every number starts with 0 marks.

### Visit

Three darts. A dart counts only if it lands in a segment whose number is on
the thrower's own card; any other number, the bull, or a miss scores nothing
for that seat. In **Free-Play Bingo** the thrower may aim each dart at any
number on the card, in any order.

### Marks

- Single: 1 mark. Double: 2 marks. Treble: 3 marks, closing the number at
  once.
- A number with 3 marks is **closed**. Marks beyond the third are lost; they
  never move to another number. (A double on a number with 2 marks closes it;
  the extra mark is lost.)
- A dart on a closed number changes nothing.
- A dart that closes the last open number ends the game at once; the
  thrower's remaining darts in that visit are not thrown.

### Ends when

A seat closes every number on its card. That seat wins at once. Nothing else
bounds the game.

### Result

Winner; for each seat, numbers closed and marks on the numbers still open;
darts thrown.

## Later versions

### Variants

- **Long-Form Bingo** — a 9-number card; the source allows any card from 5
  up to 9. Same marks and win.
- **Sequential Bingo** — numbers must be closed in the order listed on the
  card. Only darts on the current number count; closing it opens the next
  number at once, even within the same visit.
- **Shared-Number Bingo** — every seat gets the same card, so luck of the
  deal is gone and the game is a pure race of skill.

### Match structure

- **Team Bingo** — teams of seats share a win; the first member to throw
  decides a same-round finish.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.
- More than four seats (the source allows up to eight).

## Capture

Bingo Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or ANALYTICS +
  VISUAL_BOARD — a mark is read off the dart's number and ring, so the visit
  total cannot express it and QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — in Free-Play Bingo any
  number on the card is a legitimate aim and the thrower may switch between
  darts. Hit = number and ring where it landed; `score` = the dart's
  **board** score (S14 = 14, T14 = 42, outer bull = 25, miss = 0) — never the
  marks it earned.
- **Seat cards** are setup configuration, to be copied into the session's
  configuration snapshot with the seat list. A card is a new per-seat field
  that `SeatFact` does not carry today; `composeSeatFacts`
  (`app/src/services/session-seats.service.ts:107`) is where it would be
  projected. The deal is a fact of the game, not a fold over darts.
- **Stage type:** one shared stage for the game — the first seat to clear its
  card ends it for everyone, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:380`).
- **Derived, never stored:** marks per number, closed numbers, numbers left,
  darts to close, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Card** | V1 | The numbers a seat must close; dealt at random from 1–20 |
| **Mark** | V1 | One step toward closing a number: single 1, double 2, treble 3 |
| **Closed** | V1 | A number with three marks |
| **Short-Form Bingo** | V1 | A 5-number card |
| **Free-Play Bingo** | V1 | Card numbers may be closed in any order |
| **Long-Form Bingo** | V2+ | A longer card, up to 9 numbers |
| **Sequential Bingo** | V2+ | Card numbers must be closed in card order |
| **Shared-Number Bingo** | V2+ | Every seat plays the same card |
| **Team Bingo** | Deferred | Teams of seats share a card race |

## Open questions

- May two seats be dealt the same number? The source says each card is
  "different" and a card is a "set" of numbers, but does not say whether
  cards may overlap. No V1 default is set. Within one card, numbers do not
  repeat. A deal without replacement across seats still fits Short-Form
  (4 seats x 5 numbers = 20); it would limit Long-Form (V2+) cards.
- Single-seat play: a solo race to clear a card is not in the source. Wanted?
