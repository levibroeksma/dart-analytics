# Lawn Darts (Indoor)

Current version: none (V1 in design)
Entry points: standalone
Kernel: HAND_WRITTEN

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (1v1) | V1 | 1v1 | |
| 2v2 teams | Deferred | 2+ | Blocked on: a session takes one seat per side, and a side of two seats is rejected (`app/src/services/session-seats.service.ts:87-88`); the source's 2–4 player range is 1v1 or 2v2 |
| Config screen (presets shown) | V1 | All | |
| Round = two darts per side at the bull | V1 | All | |
| Ringers Only: only an inner bull scores, 3 points a ringer | V1 | All | |
| Cancellation: the round's net difference goes to the side ahead | V1 | All | |
| Bust: a net gain that would pass 21 is void | V1 | All | |
| Win: first side on exactly 21 | V1 | All | |
| Handly Cup | V2+ | All | Wanted, unscheduled: adds a 1-point closest-dart award; "closest" is a judgement by eye that a dart's zone cannot express, and the source states its trigger two ways (see Open questions) |
| Best-of-N games | V2+ | All | Wanted, unscheduled: the source leaves a series to agreement; V1 plays one game |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no game are a separate capture problem (`501.md:17`) |
| Outdoor Lawn Darts | Dropped | All | The parent game: weighted darts lobbed at ground rings, not played on a dartboard. This file covers only the board adaptation |

## Identity

- Two darts a round at the bull; each inner bull is worth 3, and the two sides'
  points cancel, so only the net lead scores. First to exactly 21 wins. An
  indoor board version of lawn darts (Jarts). Source: dolfdarts.com, "Lawn
  Darts (Indoor)" (https://dolfdarts.com/games/lawn-darts-indoor, read
  2026-10-12). The source lists a standard dartboard and standard darts.
- Standard board; the only scoring zone is the inner bull, so no other
  board-scoring rule applies.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | BULL (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, TEAMS |
| Difficulty | ADVANCED |
| Mechanic | SIMULATION, ACCUMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**1v1:** be the first seat to stand on exactly 21 points. The source's player
range is 2–4 as 1v1 or 2v2; V1 plays the 1v1 half.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (1v1) | Shown, locked |
| Darts per round | 2 | Shown, locked |
| Target | At the bull | Shown, locked |
| Scoring rules | Ringers Only | Shown, locked |
| Ringer value | 3 points | Shown, locked |
| Winning total | Exactly 21 | Shown, locked |

Seat order is fixed at setup; seat 1 throws first in every round. Nothing is
editable in V1: the source fixes each of these, and the only choice it offers
(Handly Cup) is deferred. Handly Cup becomes the Scoring rules choice when it
ships.

## How to play

### Round

Both seats throw two darts at the bull, seat 1 first. A round ends once both
have thrown; points are settled then, not dart by dart.

### Ringer

A dart in the inner bull is a **ringer**, worth 3 points to the side that threw
it. An outer bull, any other bed and a miss score nothing here.

### Settling the round

Count each side's ringers times 3 (0, 3 or 6). The side with the higher count
gains the difference; on a tie nobody gains.

- Seat 1 one ringer, seat 2 none: seat 1 gains 3.
- Seat 1 two ringers, seat 2 one: seat 1 gains 3.
- One ringer each: nobody gains.

Only one seat can gain in a round.

### Bust

If the gain would take the gaining seat above 21, the round is void for it: its
total stays as it was before the round. The other seat never gains in that
round, so nothing else changes. Play goes on to the next round.

Under Ringers Only every gain is 3 or 6, so totals are multiples of 3 and 21 is
always reachable.

### Ends when

A seat's total is exactly 21 after settling a round; it wins. Nothing else
bounds the game. Both seats cannot finish together, since only one gains in a
round.

### Result

The winner, both final totals, the rounds played and each seat's ringers
thrown.

## Later versions

### Variants

- **Handly Cup** — on top of ringers, a seat can score 1 point for the dart
  closest to the bull, "provided it is closer than any of the opponent's
  darts". The source's examples: an outer bull or the nearest single segment
  counts as close. That 1 point joins the round's count before cancelling, so
  3 against 1 nets 2. The source calls it the more common competitive format.
- **Best-of-N games** — a series of games to 21, "agree on format before play
  begins".

### Match structure

- **2v2 teams** — two seats a side sharing one total; the source's second
  format. Needs a side of two seats, which a session rejects today.
- **First thrower by a throw at the bull** — the closest dart to the bull
  throws first, as the source has it.

## Capture

Lawn Darts (Indoor) is unbuilt; this is the capture shape its V1 is designed
for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart) or
  ANALYTICS + VISUAL_BOARD, as other dart-row games
  (`app/src/lib/game/rulesets/capabilities.ts:47`, `:55`). QUICK_SCORE cannot play
  it: a two-dart total of 50 is one ringer and a miss, or two outer bulls.
- **One dart's fact:** intended = the bull; hit = the zone it landed in
  (`INNER_BULL` makes it a ringer; `database/seeds/0001_reference_data.sql:418-425`
  holds the bull zones); `score` = the dart's **board** score (50 inner bull,
  25 outer bull, 0 a miss). The 3 points are derived, never stored.
- **Stage type:** one shared stage for the game, since one seat's ringers
  cancel the other's, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:380`, `:428`). A round is
  derived from the throw order, not stored.
- **Derived, never stored:** ringer counts, each round's net gain, running
  totals with busts voided, rounds played and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Ringers Only** | V1 | The scoring rule: only an inner bull scores, 3 points a ringer |
| **Cancellation** | V1 | The round's net difference goes to the side ahead; a tie gains nothing |
| **Bust** | V1 | A gain that would pass 21; void |
| **Handly Cup** | V2+ | Adds 1 point for the dart closest to the bull |
| **Best-of-N games** | V2+ | A series of games to 21 |
| **2v2 teams** | Deferred | Two seats a side sharing one total |
| **First thrower by a throw at the bull** | Deferred | Closest dart to the bull throws first |

## Open questions

- Handly Cup: when does the closest-dart point exist? The source's rules say
  "if no ringer is scored", but its worked example gives a side 1 point
  against an opponent's ringer (3 against 1, net 2). Which holds?
- Handly Cup: closeness is judged by eye. Is the winning dart picked on
  screen, and what if two darts are level?
- Seat 1 throws first every round. The source gives no order beyond a bull
  throw at the start; does the order change between rounds?
