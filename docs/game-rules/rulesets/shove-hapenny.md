# Shove Ha'penny

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats, head to head | V1 | 1v1 | |
| More than two seats | Deferred | 2+ | Blocked on: the source credits surplus marks to "the opponent", one seat; which seat receives them with three or more is unstated. A session seats at most four (`app/src/services/session-seats.service.ts:7`) |
| Config screen (presets shown) | V1 | All | |
| Nine beds, numbers 1 to 9 | V1 | All | |
| Marks by ring: single 1, double 2, treble 3 | V1 | All | |
| Closed: a bed closes at three marks | V1 | All | |
| Gifting: marks past three go to the opponent's same bed | V1 | 1v1 | |
| Gifted marks past the opponent's three are lost | V1 | 1v1 | |
| Darts outside beds 1 to 9 score nothing | V1 | All | |
| Win: first to close all nine beds | V1 | 1v1 | |
| One dart that closes both seats' last bed: the thrower wins | V1 | 1v1 | |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md:17`) |
| Extended Board | V2+ | All | Wanted, unscheduled: a longer bed range (up to 15 or another agreed range) is a configuration V1 locks at 1 to 9 |
| No-Gift Variant | V2+ | All | Wanted, unscheduled: dropping the gifting rule is a rule switch V1 does not need; the source calls it the beginner form |
| Team Shove Ha'penny | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Darts take on a pub board game: close beds 1 to 9 with three marks each.
  Marks you score past what a bed needs are handed to your opponent, so a big
  dart can help them. Source: dolfdarts.com, "Shove Ha'penny"
  (https://dolfdarts.com/games/shove-hapenny, read 2026-10-12).
- Board scores play no part: only the number and ring a dart hit. The source
  lists no points, only marks.
- Two seats only. Gifting needs an opponent, so this is not a solo game.

## Objective

**1v1:** be the first seat to close all nine beds (1 to 9).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (1v1) | Shown, locked |
| Beds | 1 to 9 | Shown, locked |
| Marks to close a bed | 3 | Shown, locked |
| Gifting | On | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md:11`); seat 1
throws first. The source decides the first thrower by a throw at the bull;
V1 does not.

## How to play

Each seat keeps a tally of marks, 0 to 3, against each bed 1 to 9. A bed with
three marks is **closed** for that seat.

### Visit

Up to **three darts**, then play passes to the other seat. The visit ends
early only when the game does.

### Marks

- A dart in bed 1 to 9 earns marks by ring: single 1, double 2, treble 3.
- Marks add up across darts and visits.
- A dart anywhere else (10 to 20, either bull, off the board) is dead.

### Gifting

- A dart earns more marks than the thrower's bed still needs: the **surplus**
  goes to the opponent's tally on the same bed. Example: a bed needs 1 more,
  you hit a treble. 1 mark closes yours, 2 are gifted.
- A bed the thrower has already closed needs none, so every mark from a dart
  in it is surplus and is gifted.
- Gifted marks fill the opponent's bed up to three. The source says surplus on
  a bed the opponent has closed is "simply lost"; V1 reads marks past the
  opponent's three the same way, so gifts are never passed back.
- Surplus is counted dart by dart, in throw order; the total is the same
  however the darts fall.

### Finishing

A seat closes its ninth bed: it wins at once, even with darts left in hand.
Gifts can close the opponent's beds, so the opponent can finish on your dart.

**1v1:** if the opponent's ninth bed is closed by a gift from your dart, the
game ends with that dart, and they win unless the same dart also closed your
own ninth bed. If one dart closes both seats' last bed, the thrower wins
(the source: the active thrower wins, as their action ended the leg).

### Ends when

One seat has closed all nine beds. A single leg: no best-of.

### Result

Winner, each seat's marks per bed, marks gifted and marks lost, and the darts
thrown.

## Later versions

### Variants

- **Extended Board** — the grid runs past 9, to 15 or another agreed range.
- **No-Gift Variant** — surplus marks are discarded instead of credited to the
  opponent. Simpler, "often preferred when teaching beginners".

### Match structure

- **Team Shove Ha'penny** — pairs or larger teams alternate visits and share
  one tally column; the gifting rule still applies.
- More than two seats, once the source says who receives gifts.
- A throw at the bull to pick the first thrower.

## Capture

Shove Ha'penny is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD. Which bed and ring each dart hit decides the
  marks, so QUICK_SCORE (visit totals) cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — any of beds 1 to 9 is a
  legitimate aim, including a closed one. Hit = number and ring where it
  landed; `score` = the dart's **board** score. Marks are derived from the
  ring, never stored.
- **Stage type:** one shared stage for the game — a dart changes the other
  seat's tally, as 501's shared leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
- **Derived, never stored:** marks per bed per seat, which beds are closed,
  gifted and lost marks, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Marks** | V1 | Progress against a bed: single 1, double 2, treble 3 |
| **Closed** | V1 | A bed with three marks for that seat |
| **Gifting** | V1 | Marks past what the thrower's bed needs go to the opponent's same bed |
| **Extended Board** | V2+ | A bed range longer than 1 to 9 |
| **No-Gift Variant** | V2+ | Surplus marks are discarded, not credited |
| **Team Shove Ha'penny** | Deferred | Teams share a tally column; gifting still applies |

## Open questions

- The source's tiebreak covers both seats closing their last bed "on the same
  visit". V1 reads "same visit" as "same dart", since the game ends the moment
  the last bed is closed. So a gift that closes the opponent's last bed on
  dart 1 ends the game for the opponent, and darts 2 and 3 are never thrown.
  Confirm.
- Gifted marks that overflow the opponent's bed (they need 1, you gift 2):
  the source covers only a bed already closed. V1 treats the overflow as
  lost; confirm.
- The source says "two or more players" in setup but lists a maximum of two.
  V1 follows the maximum; with three seats, who receives a gift?
- A dart in a bed the thrower has closed is wholly gifted. The source does not
  walk this case; it follows from "more marks than needed". Confirm.
