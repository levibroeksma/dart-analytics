# Knockout

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (3–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source calls 4–8 best |
| Config screen (presets shown) | V1 | All | |
| Visit = 3 darts, scored as the board total | V1 | All | |
| Opening visit: sets the first target, no strike | V1 | All | |
| Weak-hand opener | V2+ | All | Wanted, unscheduled: the app cannot tell which hand threw, so it can only be an on-screen instruction; V1 plays the source's No Weak-Hand Opener variant |
| Survive: total at or above the target; it becomes the new target | V1 | All | |
| Strike: total below the target; target unchanged | V1 | All | |
| Out at three strikes | V1 | All | |
| Last seat standing wins | V1 | All | |
| Sudden Death Knockout | V2+ | 2+ | Wanted, unscheduled: a second elimination rule — lowest score each round is out — V1 does not need |
| Progressive Knockout | V2+ | 2+ | Wanted, unscheduled: a target that rises a fixed step per round; its starting target is an open question |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Beat the last score or take a strike: each visit must match or beat the
  score the previous survivor set; three strikes and you are out. Source:
  dolfdarts.com, "Knockout" (https://dolfdarts.com/games/knockout, read
  2026-10-07).
- Standard dartboard scoring: a visit is the sum of its three darts' board
  scores.

## Objective

**2+:** be the last seat with fewer than three strikes. "Knockout requires a
minimum of 3 players"; a session seats at most four.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 3 seats (min 3, max 4) | Editable |
| Strikes to go out | 3 | Shown, locked |
| Opener | Seat 1, normal throw | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 opens.

## How to play

### Visit

Three darts; the visit's total is the sum of their board scores.

### Opening visit

The first seat's first visit sets the opening **target**. It cannot take a
strike. The source has the opener throw with the non-dominant hand; V1 plays
its No Weak-Hand Opener variant — "the first player simply throws normally".

### Each later visit

- **Survive:** total equal to or above the target. "Their total now becomes
  the new target."
- **Strike:** total below the target. "The target remains unchanged (it stays
  at the score set by the last player who successfully met or beat it)."
- **Out** at three strikes: the seat takes no more turns. Its last visit was
  below the target, so going out never moves the target.
- Play passes to the next seat still in.

### Ends when

One seat is left; it wins. Nothing else bounds the game.

### Result

Winner, the order seats went out, each seat's strikes and visit average.

## Later versions

### Variants

- **Weak-hand opener** — the source's default: the opening visit is thrown
  with the non-dominant hand.
- **Sudden Death Knockout** — no strikes; "the player with the lowest score in
  each complete round is immediately eliminated."
- **Progressive Knockout** — the target rises a fixed step each round ("for
  example, … 10 points per round regardless of what players actually score");
  a visit below it takes a strike.

### Match structure

- More than four seats, once a session can hold them.

## Capture

Knockout is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit totals) or
  VISUAL_BOARD (one dart row each) — the pair Score Training offers
  (`score-training.md` §Capture). Only the visit total decides anything.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit.
  VISUAL_BOARD: intended = **nothing stored** (free aim); hit = where it
  landed; `score` = the dart's **board** score.
- **Stage type:** one shared stage for the game — each visit is judged
  against a target another seat set, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:286`).
- **Derived, never stored:** the current target, strikes per seat, who is
  out, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Opening visit** | V1 | The first visit; its total is the first target |
| **Survive** | V1 | Match or beat the target; your total becomes the target |
| **Strike** | V1 | A visit below the target |
| **Out** | V1 | Three strikes; no more turns |
| **Weak-hand opener** | V2+ | Opening visit thrown with the non-dominant hand |
| **Sudden Death Knockout** | V2+ | Lowest score each round is out |
| **Progressive Knockout** | V2+ | Target rises a fixed step per round |

## Open questions

- Does the opener also throw a normal visit in round 1? Proposed reading: no
  — the opening visit is seat 1's turn, and seat 2 throws against it.
- Progressive Knockout: what is the starting target?
- Two seats: the source says minimum three. Allow a 1v1 game anyway?
