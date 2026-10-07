# Noughts and Crosses

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two sides, one seat each | V1 | 1v1 | |
| Teams | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:86`) |
| Config screen (presets shown) | V1 | All | |
| 3×3 grid, centre square the inner bull | V1 | All | |
| Preset grid: the source's example | V1 | All | |
| Custom grid agreed at setup | V2+ | All | Wanted, unscheduled: V1 locks the preset grid; an editable grid is a config widening |
| Claim: a dart in a square's exact bed | V1 | All | |
| A claimed square is kept for the game | V1 | All | |
| More than one claim in a visit | V1 | All | |
| Visit = up to 3 darts | V1 | All | |
| Win: Three in a row — row, column or diagonal | V1 | All | |
| Draw: all nine claimed, no line | V1 | All | |
| Handicap Noughts and Crosses | V2+ | 1v1 | Wanted, unscheduled: each side needs its own targets, a second grid per side the config cannot express |
| All-Doubles or All-Trebles | V2+ | All | Wanted, unscheduled: another grid, so it depends on Custom grid |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Tic-tac-toe on a dartboard: each of nine squares is a board target; hit it
  to claim it, and three claimed squares in a line win. Source: dolfdarts.com,
  "Noughts and Crosses" (https://dolfdarts.com/games/noughts-and-crosses,
  read 2026-10-07).
- Board scores play no part; only the bed a dart lands in matters.

## Objective

**1v1:** claim three squares in a line before the other side does. All nine
claimed with no line is a draw.

**2+:** teams play as two sides (Deferred).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats, one per side | Shown, locked |
| Grid | Preset grid (below) | Shown, locked |
| First thrower | Seat 1 | Shown, locked |

Preset grid, the source's example:

| | Left | Centre | Right |
| --- | --- | --- | --- |
| Top | Treble 9 | Small 14 | Double 2 |
| Middle | Treble 5 | Inner bull | Small 17 |
| Bottom | Large 6 | Treble 7 | Double 1 |

"Small" and "Large" are single beds the source does not define — see Open
questions. Seat order is fixed at setup, as 501 (`501.md` §Features).

## How to play

### Visit

Up to **three darts**, then play passes to the other side.

### Claiming

- A dart in a square's **exact** bed **claims** it: for Treble 9, a single or
  double 9 does nothing. The centre needs the inner bull.
- A claimed square stays with its side for the game. A dart in a claimed
  square, or in no square's bed, does nothing.
- One visit may claim several squares.

### Ends when

- A side holds **three in a row** — a row, a column or a diagonal — and wins.
- Or all nine squares are claimed with no line: a **draw**.

### Result

Winner or draw, the final grid, and each side's darts thrown.

## Later versions

### Variants

- **Custom grid** — the sides agree the eight outer targets at setup.
- **Handicap Noughts and Crosses** — easier targets for the weaker side,
  harder for the stronger.
- **All-Doubles or All-Trebles** — every outer square a double, or every one a
  treble.

### Match structure

- **Teams** — two teams as two sides.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

Noughts and Crosses is unbuilt; this is the capture shape its V1 is designed
for.

- **Capture / input mode:** ANALYTICS + VISUAL_BOARD only. The preset grid
  names single beds by band; a board tap is banded into `INNER_SINGLE` or
  `OUTER_SINGLE` (`app/src/lib/game/board/board-geometry.module.ts:87`), but
  keypad entry, as Cricket's, offers an unbanded single ring
  (`app/src/lib/game/cricket-play.data.ts:145`).
- **One dart's fact:** intended = **nothing stored** — target number and ring
  both null; any unclaimed square is a legitimate aim. Hit = number and zone
  where it landed; `score` = the dart's **board** score, which the game
  ignores.
- **Stage type:** one shared stage for the game — a claim by one side closes
  that square to the other, so seats share state, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:286`; `StageOwnership`,
  `app/src/modules/game/types.ts:573`).
- **Derived, never stored:** square owners, the winning line, draw, darts
  thrown.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Claim** | V1 | Take a square by a dart in its exact bed |
| **Preset grid** | V1 | The source's example layout, locked in V1 |
| **Three in a row** | V1 | Three squares of one side in a row, column or diagonal |
| **Draw** | V1 | All nine squares claimed, no line |
| **Custom grid** | V2+ | Outer targets agreed at setup |
| **Handicap Noughts and Crosses** | V2+ | Different targets per side by ability |
| **All-Doubles or All-Trebles** | V2+ | Outer squares all doubles, or all trebles |
| **Teams** | Deferred | More than one seat per side |

## Open questions

- "Small 14" and "Large 6": inner single (bull to treble) or outer single
  (treble to double)? The source does not say; the preset grid cannot lock
  until this is settled.
- A solo mode — fewest darts to a line — is not in the source. Wanted?
- Does the game end on the dart that completes a line, or is the visit
  finished? The result is the same either way.
