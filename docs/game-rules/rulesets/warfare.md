# Warfare

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats, one army each | V1 | 1v1 | |
| Three or more seats | Deferred | 2+ | Blocked on: the source has two armies only, so a third seat has none. A session seats at most four (`app/src/services/session-seats.service.ts:7`) |
| Config screen (presets shown) | V1 | All | |
| Army: top half and bottom half of the board, ten numbers each | V1 | All | |
| Seat 1 picks an army | V1 | 1v1 | |
| One hit in any ring eliminates a soldier | V1 | All | |
| Friendly fire: a hit on your own soldier eliminates it | V1 | All | |
| Bulls and eliminated numbers do nothing | V1 | All | |
| Win: eliminate all ten of the opponent's soldiers | V1 | 1v1 | |
| Last soldier lost to friendly fire loses the game | V1 | 1v1 | |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md:17`) |
| Team Warfare | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Fortified Soldiers | V2+ | 1v1 | Wanted, unscheduled: a lives count and ring-weighted hits are a rule switch V1 does not need |
| Officers Only | V2+ | 1v1 | Wanted, unscheduled: counting doubles and trebles only is a rule switch V1 does not need |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- The board splits into two armies of ten numbers. Hit the other army's
  numbers to remove its soldiers; hit your own and you lose one. Source:
  dolfdarts.com, "Warfare" (https://dolfdarts.com/games/warfare, read
  2026-10-12).
- Board scores play no part: one hit is one soldier, whatever the ring.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | TERRITORIAL |
| Pressure | PENALTY |
| Family | NOVELTY |

## Objective

**1v1:** eliminate all ten of the opponent's soldiers; the last army standing
wins.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (1v1) | Shown, locked |
| Your army | Seat 1 picks Top or Bottom; seat 2 gets the other | Editable |
| Soldiers per army | 10 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md:11`); seat 1
throws first. The source gives the army choice to the first thrower, who wins
it by a throw at the bull; V1 gives it to seat 1 and skips the throw.

## How to play

The armies, read off the board:

- **Top Army:** 20, 1, 18, 4, 13, 6, 10, 15, 2, 17.
- **Bottom Army:** 11, 14, 9, 12, 5, 3, 19, 7, 16, 8.

Each number is one soldier, alive or eliminated.

### Visit

Up to **three darts**, then play passes. The visit ends early only when the
game does.

### Eliminating soldiers

- A dart in a number of the **opponent's** army eliminates that soldier.
  Single, double and treble count alike.
- **Friendly fire:** a dart in a number of **your own** army eliminates your
  soldier, exactly as if the opponent had hit it. It applies to every dart.
- A dart in an eliminated number, either bull, or off the board does nothing.
- One dart eliminates at most one soldier.

### Finishing

**1v1:** a dart eliminates the last soldier of an army and the game ends at
that dart, even with darts left in the visit. If your last soldier falls to
your own dart you lose, and the opponent's army stands. Dart order settles
any case where both armies are down to one soldier.

### Ends when

One army has no soldiers left. A single game: no best-of.

### Result

Winner, soldiers left in each army, eliminations made, friendly-fire losses,
and darts thrown.

## Later versions

### Variants

- **Fortified Soldiers** — each soldier has several lives, commonly 3. A
  single removes one, a double two, a treble all three. Longer; trebles gain
  value.
- **Officers Only** — only doubles and trebles eliminate a soldier; singles
  do nothing.

### Match structure

- **Team Warfare** — teams alternate within their side's turn (player A
  throws three darts, next turn player B); all else as above.
- More than two seats, once the source says how to split the board.
- A throw at the bull to pick the first thrower and the army.

## Capture

Warfare is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD. Which number each dart hit decides the game, so
  QUICK_SCORE (visit totals) cannot carry it.
- **One dart's fact:** intended = **nothing stored** — an opponent's number is
  the aim, but a dart's landing in either army is what counts. Hit = number
  and ring where it landed; `score` = the dart's **board** score. The ring is
  kept so Fortified Soldiers and Officers Only need no new capture.
- **Army choice** is setup configuration, to be copied into the session's
  configuration snapshot with the seat list. It is a new per-seat field that
  `SeatFact` does not carry today; `composeSeatFacts`
  (`app/src/services/session-seats.service.ts:107`) is where it would be
  projected.
- **Stage type:** one shared stage for the game — a dart removes the other
  seat's soldier, as 501's shared leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
- **Derived, never stored:** which soldiers are alive per army, friendly-fire
  losses, and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Army** | V1 | The ten numbers of one half of the board; one soldier per number |
| **Soldier** | V1 | One number of an army, alive or eliminated |
| **Friendly fire** | V1 | A dart in your own army's number eliminates your soldier |
| **Fortified Soldiers** | V2+ | Several lives per soldier; ring decides lives lost |
| **Officers Only** | V2+ | Only doubles and trebles eliminate |
| **Team Warfare** | Deferred | Teams alternate within a side's turn |

## Open questions

- The source's Winning section names only eliminating the opponent's ten
  soldiers. V1 reads its overview, "Last army standing wins", as covering a
  seat that eliminates its own last soldier. Confirm.
- Fortified Soldiers and Officers Only: does friendly fire follow the same
  ring rule? The source states the variants for attacks only.
