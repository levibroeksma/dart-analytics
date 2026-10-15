# High and Low

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Visit = 3 darts, scored as the board total | V1 | All | |
| Opening visit: sets the first target, costs no life | V1 | All | |
| Beat: total strictly above the target; it becomes the new target | V1 | All | |
| Miss: total at or below the target; lose a life | V1 | All | |
| Re-throw: the seat that lost a life throws a fresh visit that sets the new target | V1 | All | |
| Out at zero lives | V1 | All | |
| Last seat with a life wins | V1 | All | |
| Simultaneous opening throw | V2+ | 2+ | Wanted, unscheduled: the source opens with two darts released at once; V1 plays its Standard Opening Throw variant, a normal three-dart visit. The app cannot tell whether darts left the hand together, so it could only be an on-screen instruction |
| Low phase (reversed direction; bulls negative, a miss adds 25) | Deferred | 2+ | Blocked on: the source does not say when play switches between phases — "each round (or after each elimination)" — see Open questions. Its scoring also needs a dart that hit nothing recorded as a fact, which V1 does not need |
| Low Only | V2+ | 2+ | Wanted, unscheduled: the whole game in the Low phase, so no switch point is needed; V1 does not need it |
| Alternating High and Low | Deferred | 2+ | Blocked on: the same unstated switch point as the Low phase |
| Adjusted Lives | V2+ | 2+ | Wanted, unscheduled: 5 or 7 lives instead of 3 is a setting V1 locks |
| Ties Count | V2+ | 2+ | Wanted, unscheduled: a tie beats the target; a rule switch V1 does not need |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Beat the last score or lose a life: each visit must top the score before it;
  whoever fails throws again to set a fresh target, and the last seat with a
  life wins. Source: dolfdarts.com, "High and Low"
  (https://dolfdarts.com/games/high-and-low, read 2026-10-12).
- Standard dartboard scoring: a visit is the sum of its three darts' board
  scores. V1 plays the source's **High** phase only ("High Only … the simplest
  format").
- Not Knockout (`knockout.md`): a failed visit does not leave the target in
  place — the seat that failed sets the next one — and a tie fails.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | ELIMINATION |
| Pressure | PENALTY |
| Family | PUB |

## Objective

**2+:** be the last seat with a life left. Each seat starts with three; a
session seats at most four.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 3 seats (min 2, max 4) | Editable |
| Lives | 3 | Shown, locked |
| Phase format | High only | Shown, locked |
| Tie | Fails the target | Shown, locked |
| Opener | Seat 1, three darts | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 opens.

## How to play

### Visit

Three darts; the visit's total is the sum of their board scores. A dart that
misses the board scores 0. A total of 0 is a legal visit.

### Opening visit

The first seat's first visit sets the opening **target**. It cannot lose a
life. The source opens with two darts released at once; V1 plays its Standard
Opening Throw variant — "a standard three-dart throw to set the initial
target".

### Each later visit

The seat throws three darts against the target:

- **Beat:** total strictly above the target. "Ties do not count as beating the
  number — you must strictly surpass it." The total becomes the new target and
  play passes to the next seat still in.
- **Miss:** total equal to or below the target. The seat loses one life and
  must "throw a fresh set of three darts to establish a new target". That
  re-throw is the same seat's next visit, it cannot lose a life, and whatever
  it totals — 0 included — is the new target. Play then passes to the next
  seat still in.
- **Out** at zero lives: the seat throws its re-throw, then takes no more
  turns. The source has the seat that lost a life re-throw, and lists no
  exception for the one that lost its last; V1 follows it (see Open
  questions). If one seat is left, there is
  no further throw and the game ends.
- A seat that is out is skipped.

### Ends when

One seat is left with a life; it wins at once. Nothing else bounds the game.
Two or more seats can go out in the same round — "eliminated simultaneously" —
and the survivors play on; the last one standing still wins.

### Result

Winner, the order seats went out (seats out in the same round shown level),
each seat's lives left and visit average.

## Later versions

### Variants

- **Simultaneous opening throw** — the source's default: the first seat throws
  two darts released at once; their values added are the opening target. Every
  seat after it throws three darts one at a time.
- **Low phase** — the beat direction reverses: a visit must score strictly
  below the target; a miss still costs a life and the seat re-throws to set
  the target. Scoring changes: the outer bull counts −25, the inner bull −50,
  and a dart that misses the board adds +25; every other dart keeps its board
  score. The lowest possible visit is −150.
- **Low Only** — every visit in the Low phase.
- **Alternating High and Low** — the game switches between phases "each round
  (or after each elimination)"; the source gives both and does not choose.
- **Adjusted Lives** — 5 or 7 lives instead of 3, agreed before play.
- **Ties Count** — a total equal to the target beats it.

### Match structure

- More than four seats, once a session can hold them.
- Throwing order by a throw at the bull; deferred, as 501's.

## Capture

High and Low is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit totals) or
  VISUAL_BOARD (one dart row each) — the pair Score Training offers
  (`score-training.md` §Capture). Only the visit total decides anything.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit.
  VISUAL_BOARD: intended = **nothing stored** (free aim); hit = where it
  landed; `score` = the dart's **board** score. The Low phase would not change
  `score`: its −25, −50 and +25 values are derived from the hit, and a dart
  that hit nothing needs a record to derive from (deferred with the phase).
- **Stage type:** one shared stage for the game — each visit is judged
  against a target another seat set, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
- **Derived, never stored:** the current target, which visits were re-throws,
  lives per seat, who is out, the winner. A re-throw is the visit that follows
  a missed one by the same seat; it needs no flag of its own.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Opening visit** | V1 | The first visit; its total is the first target |
| **Beat** | V1 | A total strictly above the target; it becomes the target |
| **Miss** | V1 | A total at or below the target; costs a life |
| **Re-throw** | V1 | The visit a seat throws right after losing a life; its total is the new target |
| **Out** | V1 | Zero lives; no more turns |
| **Simultaneous opening throw** | V2+ | Opening target set by two darts released at once |
| **Low phase** | Deferred | Reversed direction; bulls negative, a miss adds 25 |
| **Low Only** | V2+ | Every visit in the Low phase |
| **Alternating High and Low** | Deferred | Phase switches by round or by elimination |
| **Adjusted Lives** | V2+ | 5 or 7 starting lives |
| **Ties Count** | V2+ | A tie beats the target |

## Open questions

- When does play switch between phases in Alternating High and Low: every
  round, or after each elimination? The source offers both. Blocks the Low
  phase and the alternating format.
- Does a seat that loses its last life still re-throw? The source says the
  seat that lost a life re-throws, yet explains simultaneous eliminations as
  "consecutive players all fail against the same target", which only holds if
  the target stays when a seat goes out. Proposed reading: it re-throws, and
  only a case with three or more seats left depends on it.
- Seats: the setup text says "2 or more players"; the source's metadata gives
  a minimum of 3. V1 allows two; confirm.
